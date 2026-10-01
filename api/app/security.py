"""Authentication, rate limiting and request-size enforcement.

All of it runs as one ASGI middleware *before* the request body is read, so
unauthenticated callers never get to upload anything and oversized bodies are
cut off while streaming.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import threading
import time
from collections import deque
from typing import Deque, Dict, Optional, Tuple

from .config import Settings
from .errors import ApiError

ANONYMOUS = "anonymous"


class Authenticator:
    def __init__(self, settings: Settings):
        self._digests = settings.api_key_digests
        self._disabled = settings.auth_disabled

    @staticmethod
    def key_id(key: str) -> str:
        """Stable non-reversible id for a key (used to scope jobs and limits)."""
        return hashlib.sha256(b"key-id:" + key.encode("utf-8")).hexdigest()[:16]

    def authenticate(self, authorization: Optional[str]) -> str:
        if self._disabled:
            return ANONYMOUS
        key = self._extract(authorization)
        if key is None:
            raise ApiError(
                401, "unauthorized", "Missing or malformed Authorization header; use 'Bearer <key>'.",
                {"WWW-Authenticate": "Bearer"},
            )
        presented = hashlib.sha256(key.encode("utf-8")).digest()
        ok = False
        for digest in self._digests:  # no early exit: time does not depend on which key matched
            ok |= hmac.compare_digest(presented, digest)
        if not ok:
            raise ApiError(401, "unauthorized", "Invalid API key.", {"WWW-Authenticate": "Bearer"})
        return self.key_id(key)

    @staticmethod
    def _extract(header: Optional[str]) -> Optional[str]:
        if not header:
            return None
        parts = header.strip().split(None, 1)
        if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
            return None
        return parts[1].strip()


class RateLimiter:
    """Sliding-window limiter, per key, in memory (per process)."""

    def __init__(self, per_minute: int, window: float = 60.0, clock=time.monotonic):
        self.limit = per_minute
        self.window = window
        self._clock = clock
        self._hits: Dict[str, Deque[float]] = {}
        self._lock = threading.Lock()

    def check(self, key_id: str) -> Tuple[bool, int, float]:
        """(allowed, remaining, retry_after_seconds)."""
        if self.limit <= 0:
            return True, 10**9, 0.0
        now = self._clock()
        with self._lock:
            q = self._hits.setdefault(key_id, deque())
            while q and now - q[0] >= self.window:
                q.popleft()
            if len(q) >= self.limit:
                return False, 0, max(self.window - (now - q[0]), 0.0)
            q.append(now)
            return True, self.limit - len(q), 0.0


def _json_response(error: ApiError) -> Tuple[int, list, bytes]:
    body = json.dumps(error.body()).encode("utf-8")
    headers = [
        (b"content-type", b"application/json"),
        (b"content-length", str(len(body)).encode()),
        (b"cache-control", b"no-store"),
    ]
    for k, v in (error.headers or {}).items():
        headers.append((k.lower().encode("latin-1"), v.encode("latin-1")))
    return error.status_code, headers, body


class SecurityMiddleware:
    """Guards everything under ``/v1``."""

    def __init__(self, app, settings: Settings, authenticator: Authenticator, limiter: RateLimiter):
        self.app = app
        self.settings = settings
        self.auth = authenticator
        self.limiter = limiter
        # Allow multipart framing and the small form fields on top of the file itself.
        self.body_limit = settings.max_upload_bytes + 64 * 1024

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or not scope["path"].startswith("/v1"):
            await self.app(scope, receive, send)
            return
        if scope["method"] == "OPTIONS":  # CORS preflight carries no credentials
            await self.app(scope, receive, send)
            return

        headers = {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope["headers"]}
        try:
            key_id = self.auth.authenticate(headers.get("authorization"))
            scope.setdefault("state", {})["key_id"] = key_id
            extra_headers: list = []
            if scope["method"] == "POST":
                allowed, remaining, retry = self.limiter.check(key_id)
                if self.limiter.limit > 0:
                    extra_headers.append((b"x-ratelimit-limit", str(self.limiter.limit).encode()))
                    extra_headers.append((b"x-ratelimit-remaining", str(remaining).encode()))
                if not allowed:
                    raise ApiError(
                        429, "rate_limited", "Too many requests; slow down.",
                        {"Retry-After": str(int(retry) + 1)},
                    )
                length = headers.get("content-length")
                if length is not None and length.isdigit() and int(length) > self.body_limit:
                    raise ApiError(
                        413, "payload_too_large",
                        f"Upload exceeds the {self.settings.max_upload_bytes} byte limit.",
                    )
        except ApiError as exc:
            status, hdrs, body = _json_response(exc)
            await send({"type": "http.response.start", "status": status, "headers": hdrs})
            await send({"type": "http.response.body", "body": body})
            return

        received = 0
        limit = self.body_limit
        max_upload = self.settings.max_upload_bytes

        async def limited_receive():
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
                    raise ApiError(413, "payload_too_large", f"Upload exceeds the {max_upload} byte limit.")
            return message

        async def send_with_headers(message):
            if extra_headers and message["type"] == "http.response.start":
                message = dict(message)
                message["headers"] = list(message.get("headers", [])) + extra_headers
            await send(message)

        await self.app(scope, limited_receive, send_with_headers)
