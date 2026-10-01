"""One JSON error shape for the whole API: ``{"error": {"code", "message"}}``."""
from __future__ import annotations

from typing import Dict, Optional

from fastapi import HTTPException


class ApiError(HTTPException):
    """An error with a stable machine-readable ``code``.

    Subclasses FastAPI's HTTPException so that it also passes through places (like
    multipart parsing) that re-raise HTTPException untouched.
    """

    def __init__(
        self,
        status: int,
        code: str,
        message: str,
        headers: Optional[Dict[str, str]] = None,
    ):
        super().__init__(status_code=status, detail=message, headers=headers)
        self.status = status
        self.code = code
        self.message = message

    def body(self) -> dict:
        return {"error": {"code": self.code, "message": self.message}}


def invalid(code: str, message: str) -> ApiError:
    return ApiError(422, code, message)
