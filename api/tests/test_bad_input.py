import io

from PIL import Image

from .conftest import TEST_MEDIA
from .helpers import encoded, png_bytes, upload


def _err(r, status, code):
    assert r.status_code == status, r.text
    body = r.json()
    assert set(body) == {"error"} and set(body["error"]) == {"code", "message"}
    assert body["error"]["code"] == code, body


def test_repo_corrupt_png_is_a_clean_422(client):
    data = (TEST_MEDIA / "corrupt.png").read_bytes()
    assert data.startswith(b"\x89PNG")  # header is fine, the rest is not
    _err(client.post("/v1/upscale", files=upload(data, "corrupt.png")), 422, "invalid_image")
    _err(client.post("/v1/jobs", files=upload(data, "corrupt.png")), 422, "invalid_image")


def test_text_pretending_to_be_an_image(client):
    data = (TEST_MEDIA / "notes.txt").read_bytes()
    _err(client.post("/v1/upscale", files=upload(data, "photo.png", "image/png")), 422, "invalid_image")
    _err(client.post("/v1/upscale", files=upload(b"", "photo.png", "image/png")), 422, "invalid_image")


def test_truncated_image(client):
    good = png_bytes(64, 64)
    _err(client.post("/v1/upscale", files=upload(good[: len(good) // 2])), 422, "invalid_image")
    jpeg = encoded(64, 64, "JPEG")
    _err(client.post("/v1/upscale", files=upload(jpeg[: len(jpeg) // 2], "x.jpg", "image/jpeg")), 422, "invalid_image")


def test_truncated_image_is_rejected_at_job_submission(client):
    good = png_bytes(64, 64)
    r = client.post("/v1/jobs", files=upload(good[: len(good) // 2]))
    _err(r, 422, "invalid_image")
    assert client.app.state.queue.store.count("queued") == 0


def test_real_but_unsupported_image_formats(client):
    for fmt in ("GIF", "BMP", "TIFF"):
        buf = io.BytesIO()
        Image.new("RGB", (8, 8), (1, 2, 3)).save(buf, format=fmt)
        _err(client.post("/v1/upscale", files=upload(buf.getvalue(), "x.png", "image/png")), 415, "unsupported_format")


def test_video_upload_is_not_accepted_in_v1(client):
    mp4 = TEST_MEDIA / "clip.mp4"
    if mp4.exists():
        _err(client.post("/v1/upscale", files=upload(mp4.read_bytes()[:4096], "clip.mp4", "video/mp4")), 422, "invalid_image")


def test_error_shape_is_stable_everywhere(client):
    _err(client.get("/v1/nope"), 404, "not_found")
    _err(client.delete("/v1/models"), 405, "method_not_allowed")
    _err(client.get("/v1/jobs/does-not-exist"), 404, "job_not_found")
    _err(client.get("/v1/jobs/does-not-exist/result"), 404, "job_not_found")
    r = client.post("/v1/upscale", content=b"not multipart", headers={"Content-Type": "application/json"})
    assert r.status_code in (400, 422) and set(r.json()) == {"error"}


def test_server_error_does_not_leak_details(client, monkeypatch):
    import app.main as main

    def boom(*a, **k):
        raise RuntimeError("secret internal detail /etc/passwd")

    from fastapi.testclient import TestClient

    from .conftest import KEY

    monkeypatch.setattr(main, "run_upscale", boom)
    quiet = TestClient(client.app, raise_server_exceptions=False, headers={"Authorization": f"Bearer {KEY}"})
    r = quiet.post("/v1/upscale", files=upload(png_bytes(16, 16)))
    assert r.status_code == 500
    assert r.json() == {"error": {"code": "internal_error", "message": "Unexpected server error."}}
    assert "passwd" not in r.text
