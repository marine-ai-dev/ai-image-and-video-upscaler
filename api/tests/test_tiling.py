"""Tiled (banded) inference must equal untiled inference."""
import numpy as np
import pytest
from PIL import Image

from app.config import DEFAULT_WEIGHTS_DIR
from app.engine.forward import BandGeometry, run_band
from app.engine.upscale import _texture_pad, plan_bands, upscale_pass
from app.engine.weights import load_network

from .conftest import TEST_MEDIA


@pytest.fixture(scope="module")
def photo():
    return np.asarray(Image.open(TEST_MEDIA / "wide.jpg").convert("RGB"))  # 320x200


@pytest.fixture(scope="module")
def odd_photo(photo):
    return np.ascontiguousarray(photo[:131, :197])  # neither side a multiple of 8


@pytest.mark.parametrize("model", ["small", "medium", "large"])
@pytest.mark.parametrize("compat", [True, False])
@pytest.mark.parametrize("which", ["photo", "odd_photo"])
def test_tiled_equals_untiled(model, compat, which, request):
    img = request.getfixturevalue(which)
    h = img.shape[0]
    net = load_network(DEFAULT_WEIGHTS_DIR, model, "rl")
    whole = upscale_pass(img, net, tile_pixels=10**9, compat=compat)
    for core in (8, 13, 40):
        bands = [(a, min(a + core, h)) for a in range(0, h, core)]
        tiled = upscale_pass(img, net, compat=compat, bands=bands)
        assert tiled.shape == whole.shape
        # Bands see the same inputs in the same order of operations, only the matmul
        # blocking differs; allow a lone LSB flip on an exact rounding tie.
        diff = np.abs(tiled.astype(int) - whole.astype(int))
        assert diff.max() <= 1
        assert (diff > 0).mean() < 1e-4


def test_residual_buffers_agree_to_float_precision(odd_photo):
    """Stronger than uint8: the float residual of a band equals the whole image's."""
    img = odd_photo
    h, w, _ = img.shape
    net = load_network(DEFAULT_WEIGHTS_DIR, "medium", "rl")
    whole, corners = run_band(net, _texture_pad(img, 0, h), BandGeometry(h, w, 0, h))
    margin = net.spec.band_margin
    a, b = 60, 80
    ia, ib = max(0, a - margin), min(h, b + margin)
    band, _ = run_band(net, _texture_pad(img, ia, ib), BandGeometry(h, w, ia, ib - ia))
    for full, part in zip(whole, band):
        assert np.abs(full[a:b] - part[a - ia : b - ia]).max() < 1e-5


def test_top_band_needs_the_global_corner(photo):
    """The top band reads 'index -1' = the last pixel of the whole image (at every layer).
    With the corner captured from the bottom band it matches the whole image; without
    it (reading its own last pixel instead) it does not."""
    img = photo
    h, w, _ = img.shape
    net = load_network(DEFAULT_WEIGHTS_DIR, "medium", "rl")
    geo_whole = BandGeometry(h, w, 0, h, compat=False)
    whole, corners = run_band(net, _texture_pad(img, 0, h), geo_whole)

    ib = 60
    geo_top = BandGeometry(h, w, 0, ib, compat=False)
    padded = _texture_pad(img, 0, ib)
    with_corner, _ = run_band(net, padded, geo_top, corners_in=corners)
    without, _ = run_band(net, padded, geo_top, corners_in=None)

    keep = ib - net.spec.band_margin  # rows not influenced by the band's bottom edge
    for full, good, bad in zip(whole, with_corner, without):
        assert np.abs(full[:keep] - good[:keep]).max() < 1e-5
        assert np.abs(full[:keep] - bad[:keep]).max() > 1e-4


def test_plan_bands_bounds_band_size():
    depth = 12
    bands = plan_bands(4000, 1000, depth, 512 * 512)
    assert bands[0][0] == 0 and bands[-1][1] == 4000
    assert all(b == bands[i + 1][0] for i, (_, b) in enumerate(bands[:-1]))
    for a, b in bands:
        assert (b - a + 2 * depth) * 1000 <= 512 * 512 + 2000
    assert plan_bands(100, 100, depth, 512 * 512) == [(0, 100)]


def test_wide_image_still_makes_progress():
    # a very wide image forces the minimum core height
    bands = plan_bands(100, 100000, 12, 512 * 512)
    assert len(bands) > 1 and all(b - a >= 1 for a, b in bands)
