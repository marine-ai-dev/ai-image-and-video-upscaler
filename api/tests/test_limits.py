import io

import numpy as np
from PIL import Image

import app.main as main
from .conftest import KEY, KEY2
from .helpers import encoded, png_bytes, upload


def _err(r, status, code):
    assert r.status_code == status, r.text
    body = r.json()
    assert set(body) == {"error"} and body["error"]["code"] == code, body


def test_upload_byte_limit_by_content_length(make_client):
    c = make_client(max_upload_bytes=2000)
    r = c.post("/v1/upscale", files=upload(png_bytes(64, 64)))  # random PNG, far over 2 kB
    _err(r, 413, "payload_too_large")
    r = c.post("/v1/jobs", files=upload(png_bytes(64, 64)))
    _err(r, 413, "payload_too_large")


def test_upload_byte_limit_while_streaming_without_content_length(make_client):
    c = make_client(max_upload_bytes=1000)
    boundary = "xBOUNDARYx"
    head = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.png"\r\n'
            "Content-Type: image/png\r\n\r\n").encode()
    tail = f"\r\n--{boundary}--\r\n".encode()

    def body():  # chunked: no Content-Length header is sent
        yield head
        for _ in range(200):
            yield b"A" * 1000
        yield tail

    r = c.post("/v1/upscale", content=body(), headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    _err(r, 413, "payload_too_large")


def test_input_pixel_limit(make_client):
    c = make_client(max_input_pixels=500)
    _err(c.post("/v1/upscale", files=upload(png_bytes(32, 24))), 413, "input_too_large")  # 768 px


def test_output_limit_rejected_up_front_before_any_work(make_client, monkeypatch):
    def boom(*a, **k):
        raise AssertionError("work started")

    monkeypatch.setattr(main, "run_upscale", boom)
    c = make_client(max_output_pixels=10_000)
    # 32x24 -> 3 passes = 256x192 = 49152 px > 10000
    r = c.post("/v1/upscale", data={"passes": "3"}, files=upload(png_bytes(32, 24)))
    _err(r, 413, "output_too_large")
    assert "256x192" in r.json()["error"]["message"]
    # target mode resolves to passes first, then the same check applies
    r = c.post("/v1/upscale", data={"target_long_edge": "500"}, files=upload(png_bytes(32, 24)))
    _err(r, 413, "output_too_large")
    # and for queued jobs nothing is queued
    r = c.post("/v1/jobs", data={"passes": "3"}, files=upload(png_bytes(32, 24)))
    _err(r, 413, "output_too_large")
    assert c.app.state.queue.store.count("queued") == 0


def test_output_limit_boundary(make_client):
    c = make_client(max_output_pixels=64 * 48)
    assert c.post("/v1/upscale", data={"model": "small"}, files=upload(png_bytes(32, 24))).status_code == 200
    _err(c.post("/v1/upscale", data={"passes": "2"}, files=upload(png_bytes(32, 24))), 413, "output_too_large")


def test_webp_and_jpeg_dimension_limits(make_client):
    c = make_client(max_output_pixels=10**9)
    wide = png_bytes(1100, 4)  # 4 passes -> 17600 px wide
    r = c.post("/v1/upscale", data={"passes": "4", "format": "webp"}, files=upload(wide))
    _err(r, 422, "output_too_large_for_format")


def test_max_passes_setting(make_client):
    c = make_client(max_passes=2)
    _err(c.post("/v1/upscale", data={"passes": "3"}, files=upload(png_bytes(16, 16))), 422, "invalid_passes")
    r = c.post("/v1/upscale", data={"target_long_edge": "1000000", "model": "small"}, files=upload(png_bytes(16, 16)))
    assert r.status_code == 200 and r.headers["X-Upscale-Passes"] == "2"
    assert r.headers["X-Upscale-Capped-By-Max-Passes"] == "true"


def test_decompression_bomb_is_refused(make_client):
    c = make_client(max_input_pixels=1000)
    bomb = Image.new("1", (400, 400))  # 160k px, compresses to almost nothing, > 2x the limit
    buf = io.BytesIO()
    bomb.save(buf, format="PNG")
    assert len(buf.getvalue()) < 2000
    r = c.post("/v1/upscale", files=upload(buf.getvalue()))
    _err(r, 413, "image_too_large")
    r = c.post("/v1/jobs", files=upload(buf.getvalue()))
    _err(r, 413, "image_too_large")


def test_pillow_bomb_guard_is_configured_from_settings(make_client):
    make_client(max_input_pixels=12345)
    assert Image.MAX_IMAGE_PIXELS == 12345


def test_invalid_parameters(client):
    f = lambda: upload(png_bytes(16, 16))  # noqa: E731
    _err(client.post("/v1/upscale", data={"model": "huge"}, files=f()), 422, "invalid_model")
    _err(client.post("/v1/upscale", data={"content": "sketch"}, files=f()), 422, "invalid_content")
    for bad in ("0", "5", "-1", "abc", "1.5"):
        _err(client.post("/v1/upscale", data={"passes": bad}, files=f()), 422, "invalid_passes")
    for bad in ("0", "abc", "-5", "99999999"):
        _err(client.post("/v1/upscale", data={"target_long_edge": bad}, files=f()), 422, "invalid_target")
    _err(client.post("/v1/upscale", data={"passes": "1", "target_long_edge": "100"}, files=f()), 422, "conflicting_parameters")
    _err(client.post("/v1/upscale", data={"format": "gif"}, files=f()), 422, "invalid_format")
    _err(client.post("/v1/upscale", data={"model": "small"}), 422, "missing_file")


def test_rate_limit_per_key(make_client):
    c = make_client(rate_limit_per_minute=3)
    ok = lambda: c.post("/v1/upscale", data={"model": "small"}, files=upload(png_bytes(8, 8)))  # noqa: E731
    for _ in range(3):
        assert ok().status_code == 200
    r = ok()
    _err(r, 429, "rate_limited")
    assert int(r.headers["Retry-After"]) >= 1
    # a different key has its own budget; reads are not limited
    assert c.post("/v1/upscale", data={"model": "small"}, files=upload(png_bytes(8, 8)),
                  headers={"Authorization": f"Bearer {KEY2}"}).status_code == 200
    assert c.get("/v1/models").status_code == 200
    # job submissions share the same budget
    _err(c.post("/v1/jobs", files=upload(png_bytes(8, 8))), 429, "rate_limited")


def test_rate_limiter_window_slides():
    from app.security import RateLimiter

    now = [0.0]
    rl = RateLimiter(2, window=60, clock=lambda: now[0])
    assert rl.check("k")[0] and rl.check("k")[0]
    allowed, _, retry = rl.check("k")
    assert not allowed and 0 < retry <= 60
    now[0] = 61
    assert rl.check("k")[0]


def test_rate_limit_disabled_with_zero(client):
    for _ in range(40):
        assert client.post("/v1/upscale", data={"model": "small"}, files=upload(png_bytes(4, 4))).status_code == 200
