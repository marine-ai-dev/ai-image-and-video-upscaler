"""ASGI entry point: ``uvicorn app.asgi:app``.

Importing this module builds the app from the environment and therefore refuses to
start (non-zero exit with a clear message) when API_KEYS is unset and
API_AUTH_DISABLED=1 was not given.
"""
import sys

from .config import ConfigError
from .main import create_app

try:
    app = create_app()
except ConfigError as exc:
    sys.stderr.write(f"FATAL: {exc}\n")
    raise SystemExit(2)
