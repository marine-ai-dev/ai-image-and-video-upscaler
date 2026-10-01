import io

import numpy as np
from PIL import Image

from .helpers import decode, encoded, gradient_png, png_bytes, upload


def test_healthz_needs_no_auth(client):
    r = client.get("/healthz", headers={"Authorization": ""})
    assert r.status_code == 200 and r.json()["status"] == "ok"


def test_models_endpoint(client):
    body = client.get("/v1/models").json()
    assert [s["id"] for s in body["sizes"]] == ["small", "medium", "large"]
    assert [c["id"] for c in body["contents"]] == ["rl", "an", "3d"]
    assert body["default_size"] == "medium" and body["default_content"] == "rl"
    assert body["limits"]["max_passes"] == 4 and body["limits"]["max_upload_bytes"] > 0
    assert body["native_scale"] == 2


def test_openapi_docs_are_served(client):
    assert client.get("/docs").status_code == 200
    spec = client.get("/openapi.json").json()
    assert "/v1/upscale" in spec["paths"] and "/v1/jobs" in spec["paths"]


def test_sync_upscale_defaults(client):
    r = client.post("/v1/upscale", files=upload(png_bytes(32, 24), "My Photo!.png"))
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/png"
    img = decode(r.content)
    assert img.size == (64, 48) and img.format == "PNG"
    assert r.headers["X-Upscale-Width"] == "64" and r.headers["X-Upscale-Height"] == "48"
    assert r.headers["X-Upscale-Passes"] == "1"
    assert r.headers["X-Upscale-Model"] == "medium" and r.headers["X-Upscale-Content"] == "rl"
    assert r.headers["X-Upscale-Source-Width"] == "32"
    assert 'filename="My Photo_upscaled_64x48.png"' in r.headers["content-disposition"]
    assert "no-store" in r.headers["cache-control"]


def test_passes_double_each_time_without_resampling(client):
    for passes in (1, 2, 3):
        r = client.post("/v1/upscale", data={"passes": str(passes), "model": "small"}, files=upload(png_bytes(16, 12)))
        assert r.status_code == 200, r.text
        assert decode(r.content).size == (16 * 2**passes, 12 * 2**passes)
        assert r.headers["X-Upscale-Passes"] == str(passes)


def test_target_long_edge_follows_the_site_rule(client):
    # long edge 32: 2 passes -> 128 reaches 100; 1 pass (64) does not
    r = client.post("/v1/upscale", data={"target_long_edge": "100", "model": "small"}, files=upload(png_bytes(32, 24)))
    assert r.status_code == 200
    assert decode(r.content).size == (128, 96)
    assert r.headers["X-Upscale-Passes"] == "2"
    assert r.headers["X-Upscale-Requested-Long-Edge"] == "100"
    assert r.headers["X-Upscale-Target-Exact"] == "false"
    exact = client.post("/v1/upscale", data={"target_long_edge": "64", "model": "small"}, files=upload(png_bytes(32, 24)))
    assert exact.headers["X-Upscale-Passes"] == "1" and exact.headers["X-Upscale-Target-Exact"] == "true"


def test_every_model_and_content_type_runs(client):
    for model in ("small", "medium", "large"):
        for content in ("rl", "an", "3d"):
            r = client.post("/v1/upscale", data={"model": model, "content": content}, files=upload(gradient_png(16, 16)))
            assert r.status_code == 200, (model, content, r.text)
            assert decode(r.content).size == (32, 32)


def test_output_format_defaults_to_input_and_can_be_changed(client):
    jpeg_in = encoded(24, 16, "JPEG")
    r = client.post("/v1/upscale", data={"model": "small"}, files=upload(jpeg_in, "x.jpg", "image/jpeg"))
    assert r.headers["content-type"] == "image/jpeg" and decode(r.content).format == "JPEG"
    assert r.headers["content-disposition"].endswith('.jpg"')

    for fmt, pil, mime in (("webp", "WEBP", "image/webp"), ("png", "PNG", "image/png"), ("jpg", "JPEG", "image/jpeg")):
        r = client.post("/v1/upscale", data={"model": "small", "format": fmt}, files=upload(png_bytes(16, 16)))
        assert r.status_code == 200 and decode(r.content).format == pil and r.headers["content-type"] == mime


def test_type_is_decided_by_decoding_not_by_name_or_header(client):
    r = client.post("/v1/upscale", data={"model": "small"}, files=upload(encoded(16, 16, "JPEG"), "really.png", "image/png"))
    assert r.status_code == 200
    assert decode(r.content).format == "JPEG"  # default format = what the bytes really were


def test_png_with_transparency_keeps_alpha_other_formats_drop_it(client):
    rgba = png_bytes(16, 16, "RGBA", seed=3)
    r = client.post("/v1/upscale", data={"model": "small"}, files=upload(rgba))
    out = decode(r.content)
    assert out.mode == "RGBA" and out.size == (32, 32)
    r = client.post("/v1/upscale", data={"model": "small", "format": "jpeg"}, files=upload(rgba))
    assert decode(r.content).mode == "RGB"


def test_opaque_input_gives_rgb_png(client):
    # an RGBA file whose alpha is 255 everywhere has no transparency to preserve
    arr = np.full((16, 16, 4), 255, np.uint8)
    arr[..., :3] = np.random.default_rng(0).integers(0, 256, (16, 16, 3))
    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, format="PNG")
    r = client.post("/v1/upscale", data={"model": "small"}, files=upload(buf.getvalue()))
    assert decode(r.content).mode == "RGB"


def test_16bit_and_palette_and_gray_inputs_decode(client):
    gray = Image.fromarray((np.arange(256 * 8, dtype=np.uint16).reshape(8, 256) * 16).astype(np.uint16))
    buf = io.BytesIO()
    gray.save(buf, format="PNG")
    pal = Image.new("P", (16, 16))
    pbuf = io.BytesIO()
    pal.save(pbuf, format="PNG", transparency=0)
    for data in (buf.getvalue(), pbuf.getvalue(), encoded(16, 16, "PNG", "L")):
        r = client.post("/v1/upscale", data={"model": "small"}, files=upload(data))
        assert r.status_code == 200, r.text
