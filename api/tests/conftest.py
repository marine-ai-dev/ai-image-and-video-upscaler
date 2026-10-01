import io
import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

API_DIR = Path(__file__).resolve().parent.parent
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from app.config import Settings  # noqa: E402
from app.main import create_app  # noqa: E402

REFERENCE = Path(__file__).resolve().parent / "reference"
TEST_MEDIA = API_DIR.parent / "src" / "test-media"
KEY = "test-key-0123456789abcdef"
KEY2 = "other-key-0123456789abcdef"

# rows collected by test_parity.py, printed in the terminal summary
PARITY_ROWS = []


def make_settings(tmp_path, **overrides):
    base = dict(
        api_key_digests=Settings.from_env({"API_KEYS": f"{KEY},{KEY2}"}).api_key_digests,
        job_dir=tmp_path / "jobs",
        rate_limit_per_minute=0,
        job_ttl_seconds=3600,
    )
    base.update(overrides)
    return Settings(**base)


@pytest.fixture
def settings(tmp_path):
    return make_settings(tmp_path)


@pytest.fixture
def client(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        c.headers.update({"Authorization": f"Bearer {KEY}"})
        yield c


@pytest.fixture
def make_client(tmp_path):
    """Factory for clients with custom settings (limits etc.)."""
    stack = []

    def factory(**overrides):
        app = create_app(make_settings(tmp_path, **overrides))
        c = TestClient(app)
        c.__enter__()
        c.headers.update({"Authorization": f"Bearer {KEY}"})
        stack.append(c)
        return c

    yield factory
    for c in stack:
        c.__exit__(None, None, None)


def pytest_terminal_summary(terminalreporter):
    if not PARITY_ROWS:
        return
    tr = terminalreporter
    tr.section("browser parity (0-255 scale, per channel)")
    header = f"{'case':44s} {'region':9s} {'max abs R,G,B,A':18s} {'mean abs R,G,B,A'}"
    tr.write_line(header)
    for case, region, mx, mean in PARITY_ROWS:
        tr.write_line(f"{case:44s} {region:9s} {mx:18s} {mean}")
