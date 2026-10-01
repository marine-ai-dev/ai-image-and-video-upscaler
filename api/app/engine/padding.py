"""Multiple-of-8 edge padding around one model pass.

WebSR's compute layers dispatch ``floor(size / 8)`` workgroups of 8x8 threads, so a
side that is not a multiple of 8 would leave its last ``size % 8`` columns/rows
without any model output (only the plain linear upscale). The website therefore
runs every pass on the input padded up to the next multiple of 8 by replicating
its edge pixels, and crops the 2x result back to exactly ``2H x 2W``.

This module is the API's single definition of that rule. It must stay identical to
``paddedDimensions`` / ``passGeometry`` in ``src/lib/upscale-math.ts`` and to
``PassFrame`` in ``src/lib/render-chain.ts`` (``tests/test_padding.py`` compares the
sizes against the TypeScript implementation when Node is available).
"""
from __future__ import annotations

import numpy as np

WORKGROUP = 8
SCALE = 2


def padded_size(n: int) -> int:
    """Smallest multiple of 8 that is >= n."""
    return -(-n // WORKGROUP) * WORKGROUP


def pad_edge(img: np.ndarray) -> np.ndarray:
    """(H, W, C) -> (padded H, padded W, C), replicating the last row/column.
    Returns ``img`` itself (no copy) when both sides are already multiples of 8."""
    h, w = img.shape[:2]
    ph, pw = padded_size(h), padded_size(w)
    if ph == h and pw == w:
        return img
    return np.pad(img, ((0, ph - h), (0, pw - w), (0, 0)), mode="edge")


def crop_output(out: np.ndarray, h: int, w: int) -> np.ndarray:
    """Crop a padded pass result back to exactly (2h, 2w)."""
    return out[: h * SCALE, : w * SCALE]
