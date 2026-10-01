import logging
import os
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import security
from app.config import ConfigError, Settings
from app.main import create_app

from .conftest import KEY, KEY2, make_settings
from .helpers import png_bytes, upload

API_DIR = Path(__file__).resolve().parent.parent


def test_missing_key_is_401_with_json_error(client):
    r = client.get("/v1/models", headers={"Authorization": ""})
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "unauthorized"
    assert r.headers["www-authenticate"] == "Bearer"


def test_wrong_key_is_401(client):
    for header in ("Bearer nope-nope-nope-nope", "Basic abc", f"Bearer", KEY, f"Bearer  {KEY}x"):
        r = client.get("/v1/models", headers={"Authorization": header})
        assert r.status_code == 401, header
        assert set(r.json()) == {"error"} and set(r.json()["error"]) == {"code", "message"}


def test_every_v1_route_requires_a_key(client):
    for method, path in (
        ("GET", "/v1/models"), ("POST", "/v1/upscale"), ("POST", "/v1/jobs"),
        ("GET", "/v1/jobs/x"), ("GET", "/v1/jobs/x/result"), ("DELETE", "/v1/jobs/x"), ("GET", "/v1/unknown"),
    ):
        r = client.request(method, path, headers={"Authorization": ""})
        assert r.status_code == 401, (method, path)


def test_both_configured_keys_work(client):
    assert client.get("/v1/models", headers={"Authorization": f"Bearer {KEY2}"}).status_code == 200
    assert client.get("/v1/models", headers={"Authorization": f"bearer {KEY}"}).status_code == 200


def test_unauthenticated_upload_is_rejected_before_the_body_is_read(client, monkeypatch):
    calls = []
    import app.main as main

    monkeypatch.setattr(main, "run_upscale", lambda *a, **k: calls.append(1))
    big = b"x" * 5_000_000
    r = client.post("/v1/upscale", files=upload(big), headers={"Authorization": "Bearer wrong-wrong-wrong-wrong"})
    assert r.status_code == 401 and not calls


def test_comparison_is_constant_time_over_all_keys(client, monkeypatch):
    calls = []
    real = security.hmac.compare_digest

    def spy(a, b):
        calls.append(1)
        return real(a, b)

    monkeypatch.setattr(security.hmac, "compare_digest", spy)
    client.get("/v1/models")  # matches the first key
    assert len(calls) == 2  # still compared against both configured keys
    calls.clear()
    client.get("/v1/models", headers={"Authorization": "Bearer wrong-wrong-wrong-wrong"})
    assert len(calls) == 2


def test_keys_never_appear_in_logs(client, caplog):
    caplog.set_level(logging.DEBUG)
    client.get("/v1/models", headers={"Authorization": "Bearer wrong-key-1234567890abc"})
    client.post("/v1/upscale", files=upload(png_bytes(16, 16)))
    client.post("/v1/upscale", files=upload(b"garbage"))
    text = caplog.text
    assert "wrong-key-1234567890abc" not in text and KEY not in text


def test_key_ids_are_not_the_key():
    kid = security.Authenticator.key_id(KEY)
    assert KEY not in kid and len(kid) == 16


# --- startup refusal -----------------------------------------------------------------

def test_settings_refuse_without_keys_or_explicit_opt_out():
    with pytest.raises(ConfigError, match="API_KEYS"):
        Settings.from_env({})
    with pytest.raises(ConfigError):
        Settings.from_env({"API_KEYS": "  , ,"})
    with pytest.raises(ConfigError):
        Settings.from_env({"API_AUTH_DISABLED": "true"})  # only the literal "1" counts
    with pytest.raises(ConfigError, match="16"):
        Settings.from_env({"API_KEYS": "short"})


def test_auth_disabled_must_be_explicit():
    s = Settings.from_env({"API_AUTH_DISABLED": "1"})
    assert s.auth_disabled
    # a configured key always wins over the opt-out
    assert not Settings.from_env({"API_AUTH_DISABLED": "1", "API_KEYS": KEY}).auth_disabled


def test_create_app_refuses_to_start_without_auth_config(monkeypatch):
    monkeypatch.delenv("API_KEYS", raising=False)
    monkeypatch.delenv("API_AUTH_DISABLED", raising=False)
    with pytest.raises(ConfigError):
        create_app()


def _run_asgi_import(env_extra):
    env = {k: v for k, v in os.environ.items() if k not in ("API_KEYS", "API_AUTH_DISABLED")}
    env.update(env_extra)
    return subprocess.run(
        [sys.executable, "-c", "import app.asgi"], cwd=API_DIR, env=env, capture_output=True, text=True, timeout=60
    )


def test_server_entrypoint_exits_nonzero_without_keys(tmp_path):
    proc = _run_asgi_import({"JOB_DIR": str(tmp_path)})
    assert proc.returncode == 2
    assert "API_KEYS" in proc.stderr and "Refusing" in proc.stderr


def test_server_entrypoint_starts_with_keys_or_explicit_opt_out(tmp_path):
    assert _run_asgi_import({"API_KEYS": KEY, "JOB_DIR": str(tmp_path)}).returncode == 0
    assert _run_asgi_import({"API_AUTH_DISABLED": "1", "JOB_DIR": str(tmp_path)}).returncode == 0


def test_auth_disabled_mode_serves_without_header(tmp_path):
    app = create_app(Settings.from_env({"API_AUTH_DISABLED": "1", "JOB_DIR": str(tmp_path)}))
    with TestClient(app) as c:
        assert c.get("/v1/models").status_code == 200
        r = c.post("/v1/jobs", data={"model": "small"}, files=upload(png_bytes(16, 16)))
        assert r.status_code == 202


def test_cors_is_off_by_default_and_allow_list_works(tmp_path):
    off = TestClient(create_app(make_settings(tmp_path)))
    r = off.options("/v1/models", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in r.headers
    r = off.get("/healthz", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in r.headers

    on = TestClient(create_app(make_settings(tmp_path, cors_origins=("https://site.example",))))
    pre = on.options(
        "/v1/models",
        headers={
            "Origin": "https://site.example",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )
    assert pre.status_code == 200 and pre.headers["access-control-allow-origin"] == "https://site.example"
    bad = on.options("/v1/models", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in bad.headers
    ok = on.get("/v1/models", headers={"Origin": "https://site.example", "Authorization": f"Bearer {KEY}"})
    assert ok.headers["access-control-allow-origin"] == "https://site.example"
