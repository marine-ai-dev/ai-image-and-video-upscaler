"""Multiple-of-8 edge padding (the fix for WebSR's floor(size/8) dispatch).

Every pass runs on the input padded to a multiple of 8 and is cropped back to exactly
2x, for any size. The website does the same (src/lib/render-chain.ts); parity with its
real captures is in test_parity.py, these tests cover the rule itself and odd sizes.
"""
import json
import shutil
import subprocess
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from app.config import DEFAULT_WEIGHTS_DIR
from app.engine.padding import WORKGROUP, crop_output, pad_edge, padded_size
from app.engine.pipeline import process_image
from app.engine.upscale import _display, upscale_pass
from app.engine.weights import load_network

from .helpers import decode, png_bytes, upload

REPO = Path(__file__).resolve().parents[2]


def _rgb(w, h, seed=0):
    return np.random.default_rng(seed).integers(0, 256, (h, w, 3), dtype=np.uint8)


@pytest.fixture(scope="module")
def net():
    return load_network(DEFAULT_WEIGHTS_DIR, "small", "rl")


def test_padded_size_rounds_up_to_a_multiple_of_8():
    assert [padded_size(n) for n in (1, 7, 8, 9, 15, 16, 17, 100, 4096)] == [8, 8, 8, 16, 16, 16, 24, 104, 4096]
    assert all(padded_size(n) % WORKGROUP == 0 and 0 <= padded_size(n) - n < WORKGROUP for n in range(1, 300))


def test_pad_edge_replicates_the_last_row_and_column():
    img = _rgb(5, 3)
    p = pad_edge(img)
    assert p.shape == (8, 8, 3)
    assert np.array_equal(p[:3, :5], img)
    assert all(np.array_equal(p[:3, c], img[:, 4]) for c in range(5, 8))  # columns
    assert all(np.array_equal(p[r, :5], img[2]) for r in range(3, 8))  # rows
    assert np.all(p[3:, 5:] == img[2, 4])  # corner = bottom-right pixel


def test_aligned_input_is_not_copied():
    img = _rgb(16, 8)
    assert pad_edge(img) is img


def test_crop_output_is_exactly_twice_the_logical_size():
    out = np.zeros((2 * 8, 2 * 8, 3), np.uint8)
    assert crop_output(out, 3, 5).shape == (6, 10, 3)  # h=3, w=5


@pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")
def test_padded_size_agrees_with_the_web_implementation(tmp_path):
    """The TypeScript rule (src/lib/upscale-math.ts) and the engine must agree."""
    script = tmp_path / "sizes.ts"
    script.write_text(
        f"import {{ paddedDimensions }} from {json.dumps(str(REPO / 'src/lib/upscale-math.ts'))};\n"
        "const out = [];\n"
        "for (let n = 1; n <= 300; n++) out.push(paddedDimensions({ width: n, height: n + 1 }).width);\n"
        "console.log(JSON.stringify(out));\n"
    )
    try:
        r = subprocess.run(["node", str(script)], capture_output=True, text=True, timeout=60)
    except subprocess.TimeoutExpired:  # pragma: no cover
        pytest.skip("node too slow")
    if r.returncode != 0:
        pytest.skip(f"this node cannot run TypeScript directly: {r.stderr[-200:]}")
    assert json.loads(r.stdout) == [padded_size(n) for n in range(1, 301)]


@pytest.mark.parametrize("w,h", [(1, 1), (3, 5), (7, 7), (5, 3), (8, 9), (9, 8), (13, 21), (17, 6), (1, 40)])
def test_any_size_gives_exactly_2x(net, w, h):
    out = upscale_pass(_rgb(w, h, seed=w * 31 + h), net)
    assert out.shape == (2 * h, 2 * w, 3) and out.dtype == np.uint8


def test_padding_makes_the_strips_go_through_the_model(net):
    """The pixels that WebSR never dispatched are no longer a plain linear upscale."""
    img = _rgb(21, 13, seed=5)  # 21 % 8 = 5, 13 % 8 = 5
    h, w, _ = img.shape
    out = upscale_pass(img, net).astype(int)
    linear = _display(img, 0, h, [np.zeros((h, w, 4), np.float32)] * 3, False).astype(int)
    right = np.abs(out - linear)[:, 2 * (w - w % 8) :]
    bottom = np.abs(out - linear)[2 * (h - h % 8) :, :]
    assert right.max() > 8 and bottom.max() > 8


def test_result_equals_running_the_model_on_the_padded_image(net):
    img = _rgb(13, 11, seed=2)
    full = upscale_pass(pad_edge(img), net)
    assert np.array_equal(upscale_pass(img, net), full[:22, :26])


def test_tiny_images_smaller_than_one_workgroup(net):
    for w, h in ((1, 1), (2, 3), (7, 2), (3, 7)):
        img = _rgb(w, h, seed=w + h)
        assert upscale_pass(img, net).shape == (2 * h, 2 * w, 3)
        two = process_image(net, img, None, 2, "png", 512 * 512)
        assert two.shape == (4 * h, 4 * w, 3)


@pytest.mark.parametrize("passes", [1, 2])
def test_tiled_equals_untiled_on_odd_sizes(net, passes):
    img = _rgb(37, 61, seed=9)
    whole = process_image(net, img, None, passes, "png", 10**9)
    tiled = process_image(net, img, None, passes, "png", 4096)  # forces several bands
    assert tiled.shape == whole.shape
    diff = np.abs(tiled.astype(int) - whole.astype(int))
    assert diff.max() <= 1 and (diff > 0).mean() < 1e-3


def test_alpha_png_odd_size_keeps_alpha_at_the_cropped_size(net):
    rng = np.random.default_rng(4)
    rgb = _rgb(13, 9, seed=4)
    alpha = rng.integers(0, 256, (9, 13), dtype=np.uint8)
    for passes in (1, 2):
        out = process_image(net, rgb, alpha, passes, "png", 512 * 512)
        assert out.shape == (9 * 2**passes, 13 * 2**passes, 4)


# ---------------------------------------------------------------- over HTTP


@pytest.mark.parametrize("w,h,passes", [(13, 9, 1), (13, 9, 2), (3, 5, 1), (5, 3, 2), (1, 1, 1), (23, 8, 3)])
def test_http_odd_sizes_report_and_return_exact_dimensions(client, w, h, passes):
    r = client.post("/v1/upscale", data={"model": "small", "passes": str(passes)}, files=upload(png_bytes(w, h)))
    assert r.status_code == 200, r.text
    ew, eh = w * 2**passes, h * 2**passes
    assert decode(r.content).size == (ew, eh)
    assert (r.headers["X-Upscale-Width"], r.headers["X-Upscale-Height"]) == (str(ew), str(eh))
    assert f"_upscaled_{ew}x{eh}.png" in r.headers["content-disposition"]


def test_http_alpha_png_with_odd_size(client):
    r = client.post(
        "/v1/upscale", data={"model": "small", "passes": "2"}, files=upload(png_bytes(11, 6, "RGBA", seed=8))
    )
    out = decode(r.content)
    assert r.status_code == 200 and out.mode == "RGBA" and out.size == (44, 24)
    assert len(set(np.asarray(out)[..., 3].ravel().tolist())) > 1  # real alpha survived


def test_http_odd_size_as_a_job(client):
    import time

    r = client.post("/v1/jobs", data={"model": "small", "passes": "2"}, files=upload(png_bytes(9, 7)))
    assert r.status_code == 202
    job = r.json()["id"]
    for _ in range(200):
        if client.get(f"/v1/jobs/{job}").json()["status"] == "succeeded":
            break
        time.sleep(0.05)
    res = client.get(f"/v1/jobs/{job}/result")
    assert res.status_code == 200 and decode(res.content).size == (36, 28)


def test_the_old_compat_switch_is_gone():
    from app.config import Settings

    assert not hasattr(Settings(), "browser_compat_edges")
    s = Settings.from_env({"API_AUTH_DISABLED": "1", "BROWSER_COMPAT_EDGES": "1"})  # ignored, not an error
    assert not hasattr(s, "browser_compat_edges")
