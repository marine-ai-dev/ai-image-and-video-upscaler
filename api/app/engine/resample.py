"""Alpha-plane upscaling used for PNG output.

The site restores the original alpha after the model has run on a matted copy:
``drawImage(original, 0, 0, outW, outH)`` with ``imageSmoothingQuality = 'high'``.
In Chrome that is Skia's Mitchell bicubic (B = C = 1/3) with clamp-to-edge,
which reproduces the captured browser alpha exactly (see tests/test_parity.py).
"""
from __future__ import annotations

import numpy as np

B = 1.0 / 3.0
C = 1.0 / 3.0


def mitchell(d: np.ndarray) -> np.ndarray:
    d = np.abs(d)
    out = np.zeros_like(d)
    m1 = d < 1
    m2 = (d >= 1) & (d < 2)
    d1 = d[m1]
    d2 = d[m2]
    out[m1] = ((12 - 9 * B - 6 * C) * d1**3 + (-18 + 12 * B + 6 * C) * d1**2 + (6 - 2 * B)) / 6
    out[m2] = (
        (-B - 6 * C) * d2**3 + (6 * B + 30 * C) * d2**2 + (-12 * B - 48 * C) * d2 + (8 * B + 24 * C)
    ) / 6
    return out


def _axis_weights(n_in: int, factor: int):
    """For each output index i: source taps and weights (4 taps)."""
    n_out = n_in * factor
    i = np.arange(n_out, dtype=np.float64)
    src = (i + 0.5) / factor - 0.5
    base = np.floor(src).astype(np.int64)
    taps = base[:, None] + np.arange(-1, 3)[None, :]
    w = mitchell(taps - src[:, None])
    w /= w.sum(axis=1, keepdims=True)
    return np.clip(taps, 0, n_in - 1), w.astype(np.float32)


def upscale_plane(plane: np.ndarray, factor: int, block_rows: int = 256) -> np.ndarray:
    """Mitchell-bicubic upscale of a uint8 plane by an integer factor -> uint8.

    Works in blocks of output rows so float temporaries stay small for big images.
    """
    h, w = plane.shape
    src = plane.astype(np.float32)
    ty, wy = _axis_weights(h, factor)
    tx, wx = _axis_weights(w, factor)
    out = np.empty((h * factor, w * factor), dtype=np.uint8)
    for r0 in range(0, h * factor, block_rows):
        r1 = min(r0 + block_rows, h * factor)
        tmp = np.zeros((r1 - r0, w), dtype=np.float32)
        for t in range(4):
            tmp += src[ty[r0:r1, t]] * wy[r0:r1, t][:, None]
        blk = np.zeros((r1 - r0, w * factor), dtype=np.float32)
        for t in range(4):
            blk += tmp[:, tx[:, t]] * wx[:, t][None, :]
        np.floor(blk + 0.5, out=blk)
        np.clip(blk, 0, 255, out=blk)
        out[r0:r1] = blk
    return out
