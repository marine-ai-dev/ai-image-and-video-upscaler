"""Parity with outputs captured from the real browser app (tests/reference/).

The harness captures (tests/reference/harness/) are produced by the website's own padding
code (src/lib/render-chain.ts) around the real @websr/websr; see manifest.json.

Interior = everything except a 2 px border; border = the outermost 2 px ring.
Targets from the brief: interior max <= 2 and mean <= 0.5 (on 0-255).
"""
import json

import numpy as np
import pytest
from PIL import Image

from app.config import DEFAULT_WEIGHTS_DIR
from app.engine.pipeline import process_image
from app.engine.weights import load_network
from app.imageio import decode_image

from .conftest import PARITY_ROWS, REFERENCE

CASES = [
    # (label, input, reference, model, passes)
    ("small  rl 1 pass", "input_64.png", "browser_small_rl_1pass.png", "small", 1),
    ("medium rl 1 pass", "input_64.png", "browser_medium_rl_1pass.png", "medium", 1),
    ("large  rl 1 pass", "input_64.png", "browser_large_rl_1pass.png", "large", 1),
    ("medium rl 2 passes", "input_64.png", "browser_medium_rl_2pass.png", "medium", 2),
    ("medium rl 1 pass, alpha input (PNG)", "input_alpha_192.png", "browser_medium_rl_1pass_alpha192.png", "medium", 1),
]

INTERIOR_MAX = 2
INTERIOR_MEAN = 0.5


def _stats(diff, mask):
    chans = diff.shape[2]
    sel = diff[mask]  # (n, C)
    mx = [int(sel[:, c].max()) for c in range(chans)]
    mean = [float(sel[:, c].mean()) for c in range(chans)]
    return mx, mean


def _harness_cases():
    manifest = json.loads((REFERENCE / "harness" / "manifest.json").read_text())
    return manifest["cases"]


def _fmt(vals, f):
    return ",".join(f.format(v) for v in vals)


@pytest.mark.parametrize("label,inp,ref,model,passes", CASES, ids=[c[0] for c in CASES])
def test_matches_browser(label, inp, ref, model, passes):
    decoded = decode_image((REFERENCE / inp).read_bytes())
    net = load_network(DEFAULT_WEIGHTS_DIR, model, "rl")
    out = process_image(net, decoded.rgb, decoded.alpha, passes, "png", 512 * 512)

    expected = np.asarray(Image.open(REFERENCE / ref).convert("RGBA")).astype(np.int32)
    if out.shape[2] == 3:  # opaque input -> RGB PNG; the browser's PNG has alpha == 255
        assert np.all(expected[..., 3] == 255)
        out = np.dstack([out, np.full(out.shape[:2], 255, np.uint8)])
    assert out.shape == expected.shape, "output dimensions differ from the browser's"

    diff = np.abs(out.astype(np.int32) - expected)
    h, w = diff.shape[:2]
    interior = np.zeros((h, w), bool)
    interior[2:-2, 2:-2] = True
    for region, mask in (("interior", interior), ("border", ~interior)):
        mx, mean = _stats(diff, mask)
        PARITY_ROWS.append((label, region, _fmt(mx, "{:d}"), _fmt(mean, "{:.4f}")))
        assert max(mx) <= INTERIOR_MAX, f"{label} {region}: max abs diff {mx}"
        assert max(mean) <= INTERIOR_MEAN, f"{label} {region}: mean abs diff {mean}"


@pytest.mark.parametrize("case", _harness_cases(), ids=[c["reference"][:-4] for c in _harness_cases()])
def test_matches_browser_harness_captures(case):
    """Extra captures (sizes that are not multiples of 8 incl. tiny ones, other content
    types, 2-3 passes, alpha, the non-PNG path) from the real @websr/websr in Chrome,
    run through the website's padding/crop code. See the manifest."""
    base = REFERENCE / "harness"
    decoded = decode_image((base / case["input"]).read_bytes())
    net = load_network(DEFAULT_WEIGHTS_DIR, case["model"], case["content"])
    out = process_image(net, decoded.rgb, decoded.alpha, case["passes"], case["format"], 512 * 512)
    expected = np.asarray(Image.open(base / case["reference"]).convert("RGBA")).astype(np.int32)
    if out.shape[2] == 3:
        out = np.dstack([out, np.full(out.shape[:2], 255, np.uint8)])
    assert out.shape == expected.shape
    diff = np.abs(out.astype(np.int32) - expected)
    h, w = diff.shape[:2]
    interior = np.zeros((h, w), bool)
    interior[2:-2, 2:-2] = True
    label = f"[harness] {case['reference'][:-4]}"[:44]
    for region, mask in (("interior", interior), ("border", ~interior)):
        mx, mean = _stats(diff, mask)
        PARITY_ROWS.append((label, region, _fmt(mx, "{:d}"), _fmt(mean, "{:.4f}")))
        assert max(mx) <= INTERIOR_MAX, f"{label} {region}: max abs diff {mx}"
        assert max(mean) <= INTERIOR_MEAN, f"{label} {region}: mean abs diff {mean}"


def test_every_pixel_of_a_non_multiple_of_8_input_goes_through_the_model():
    """WebSR only dispatches whole 8x8 workgroups, so without padding the last
    ``size % 8`` columns/rows of a 100x76 input stay a plain linear upscale. The real
    capture of the fixed web path must instead match the API (padded) and differ from
    the linear upscale in exactly those strips."""
    from app.engine.upscale import _display

    base = REFERENCE / "harness"
    decoded = decode_image((base / "odd_100x76.png").read_bytes())
    net = load_network(DEFAULT_WEIGHTS_DIR, "medium", "rl")
    expected = np.asarray(Image.open(base / "medium_odd_100x76_p1_png.png").convert("RGB")).astype(np.int32)
    out = process_image(net, decoded.rgb, None, 1, "png", 512 * 512).astype(np.int32)
    assert np.abs(out - expected).max() <= 1

    h, w, _ = decoded.rgb.shape
    zero = [np.zeros((h, w, 4), np.float32) for _ in range(3)]
    linear = _display(decoded.rgb, 0, h, zero, True).astype(np.int32)
    right = np.abs(expected - linear)[:, 2 * (w - w % 8) :]  # last 4 input columns -> 8 output
    bottom = np.abs(expected - linear)[2 * (h - h % 8) :, :]
    assert right.max() >= 8 and bottom.max() >= 8, "strips still look like a plain linear upscale"
    assert np.abs(out - linear)[:, 2 * (w - w % 8) :].max() >= 8


def test_pixelwise_exact_for_opaque_references():
    """Stronger regression guard than the brief's thresholds: nearly bit-exact."""
    for _, inp, ref, model, passes in CASES[:4]:
        decoded = decode_image((REFERENCE / inp).read_bytes())
        net = load_network(DEFAULT_WEIGHTS_DIR, model, "rl")
        out = process_image(net, decoded.rgb, decoded.alpha, passes, "png", 512 * 512)
        expected = np.asarray(Image.open(REFERENCE / ref).convert("RGB")).astype(np.int32)
        diff = np.abs(out.astype(np.int32) - expected)
        assert diff.max() <= 1
        assert (diff > 0).mean() < 1e-4  # float-rounding ties only


def test_each_edge_rule_matters():
    """If the edge semantics were the textbook ones (zero padding) the 2 px border
    would not match; guards against 'simplifying' the flat-index emulation away."""
    from app.engine import forward

    decoded = decode_image((REFERENCE / "input_64.png").read_bytes())
    net = load_network(DEFAULT_WEIGHTS_DIR, "medium", "rl")
    good = process_image(net, decoded.rgb, None, 1, "png", 512 * 512)
    original = forward._pad_flat

    def zero_pad(buf, corner):
        h, w, c = buf.shape
        out = np.zeros((h + 2, w + 2, c), np.float32)
        out[1:-1, 1:-1] = buf
        return out

    forward._pad_flat = zero_pad
    try:
        bad = process_image(net, decoded.rgb, None, 1, "png", 512 * 512)
    finally:
        forward._pad_flat = original
    assert np.abs(good.astype(int) - bad.astype(int)).max() > 4
