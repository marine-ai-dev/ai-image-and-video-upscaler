"""Environment-driven settings. Nothing here is read at import time."""
from __future__ import annotations

import hashlib
import os
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Mapping, Optional, Tuple

DEFAULT_WEIGHTS_DIR = Path(__file__).resolve().parent.parent / "weights"


class ConfigError(RuntimeError):
    """The service is misconfigured and must not start."""


def _int(env: Mapping[str, str], name: str, default: int, minimum: int = 0) -> int:
    raw = env.get(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        value = int(raw.strip())
    except ValueError:
        raise ConfigError(f"{name} must be an integer, got {raw!r}") from None
    if value < minimum:
        raise ConfigError(f"{name} must be >= {minimum}, got {value}")
    return value


def _digest(key: str) -> bytes:
    return hashlib.sha256(key.encode("utf-8")).digest()


@dataclass(frozen=True)
class Settings:
    # --- auth ---
    api_key_digests: Tuple[bytes, ...] = ()
    auth_disabled: bool = False
    # --- limits ---
    max_upload_bytes: int = 20 * 1024 * 1024
    max_input_pixels: int = 8_000_000
    max_output_pixels: int = 33_554_432
    max_passes: int = 4
    rate_limit_per_minute: int = 30  # 0 disables
    max_queued_jobs: int = 20
    # --- compute ---
    tile_pixels: int = 131072
    engine_concurrency: int = 1
    sync_wait_seconds: int = 60
    weights_dir: Path = DEFAULT_WEIGHTS_DIR
    # --- jobs ---
    job_ttl_seconds: int = 3600
    job_dir: Optional[Path] = None
    # --- http ---
    cors_origins: Tuple[str, ...] = ()
    log_level: str = "info"

    @property
    def jpeg_quality(self) -> int:
        return 92

    @staticmethod
    def from_env(env: Optional[Mapping[str, str]] = None) -> "Settings":
        env = os.environ if env is None else env
        raw_keys = env.get("API_KEYS", "")
        keys: List[str] = [k.strip() for k in raw_keys.split(",") if k.strip()]
        auth_disabled = env.get("API_AUTH_DISABLED", "").strip() == "1"
        if not keys and not auth_disabled:
            raise ConfigError(
                "API_KEYS is not set. Refusing to start without authentication. "
                "Set API_KEYS to a comma-separated list of keys, or set "
                "API_AUTH_DISABLED=1 explicitly for local development."
            )
        for k in keys:
            if len(k) < 16:
                raise ConfigError("every API key must be at least 16 characters long")
        job_dir_raw = env.get("JOB_DIR", "").strip()
        origins = tuple(o.strip().rstrip("/") for o in env.get("CORS_ALLOW_ORIGINS", "").split(",") if o.strip())
        weights_dir = env.get("WEIGHTS_DIR", "").strip()
        return Settings(
            api_key_digests=tuple(_digest(k) for k in keys),
            auth_disabled=auth_disabled and not keys,
            max_upload_bytes=_int(env, "MAX_UPLOAD_BYTES", 20 * 1024 * 1024, 1),
            max_input_pixels=_int(env, "MAX_INPUT_PIXELS", 8_000_000, 1),
            max_output_pixels=_int(env, "MAX_OUTPUT_PIXELS", 33_554_432, 1),
            max_passes=min(_int(env, "MAX_PASSES", 4, 1), 4),
            rate_limit_per_minute=_int(env, "RATE_LIMIT_PER_MINUTE", 30, 0),
            max_queued_jobs=_int(env, "MAX_QUEUED_JOBS", 20, 1),
            tile_pixels=_int(env, "TILE_PIXELS", 131072, 4096),
            engine_concurrency=_int(env, "ENGINE_CONCURRENCY", 1, 1),
            sync_wait_seconds=_int(env, "SYNC_WAIT_SECONDS", 60, 0),
            weights_dir=Path(weights_dir) if weights_dir else DEFAULT_WEIGHTS_DIR,
            job_ttl_seconds=_int(env, "JOB_TTL_SECONDS", 3600, 1),
            job_dir=Path(job_dir_raw) if job_dir_raw else None,
            cors_origins=origins,
            log_level=(env.get("LOG_LEVEL", "info").strip().lower() or "info"),
        )

    def resolved_job_dir(self) -> Path:
        if self.job_dir is not None:
            return self.job_dir
        return Path(tempfile.gettempdir()) / "upscaler-api-jobs"
