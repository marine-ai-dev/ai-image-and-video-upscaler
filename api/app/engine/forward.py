"""Forward pass of one horizontal band of an image.

The browser runs every layer over the whole image with flat storage-buffer
indexing, so its edge behaviour is a property of that indexing, not of
convolution padding. Measured on this project's target (Chrome/Metal, see
README "How parity works"):

* Reading a storage buffer at flat index ``g`` with ``g < 0`` or ``g >= N``
  returns element ``N - 1`` (the *last* pixel of the whole image at that layer).
  Negative indices do not clamp to 0.
* A 3x3 tap that leaves the image on the left/right therefore reads the
  neighbouring row's far edge (``g = y*W + x`` wraps across rows).
* ``textureLoad`` outside the input texture clamps each axis, with negative
  coordinates going to the *last* texel (``-1 -> size-1``).
* Compute passes are dispatched as ``floor(W/8) x floor(H/8)`` workgroups of
  8x8. Every pass therefore runs on an input padded to a multiple of 8 (see
  ``padding.py``), so each pixel of the buffers passed in here is computed.

Because flat indexing only couples a row with its two neighbours, a band of
full-width rows plus ``spatial_depth`` rows of context on each side reproduces
the whole-image result exactly; the only global dependency is the value of the
last pixel of every buffer ("corner"), which the top band needs and which is
captured from the bottom band first.
"""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Dict, List, Optional, Tuple

import numpy as np
from numpy.lib.stride_tricks import sliding_window_view

from .weights import Network, PackedLayer


@dataclass
class BandGeometry:
    """Where a band sits inside the full image."""

    height: int  # full image height H
    width: int  # full image width W
    first_row: int  # global row of the band's first row (ia)
    rows: int  # number of rows in the band (ib - ia)

    @property
    def is_image_top(self) -> bool:
        return self.first_row == 0

    @property
    def is_image_bottom(self) -> bool:
        return self.first_row + self.rows == self.height


Corners = Dict[str, np.ndarray]


@lru_cache(maxsize=64)
def _ring(h: int, w: int) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Border cells of an (h+2, w+2) padded array and their flat source index."""
    py, px = np.meshgrid(np.arange(h + 2), np.arange(w + 2), indexing="ij")
    mask = (py == 0) | (py == h + 1) | (px == 0) | (px == w + 1)
    py, px = py[mask], px[mask]
    g = (py - 1) * w + (px - 1)
    n = h * w
    # index n is the appended "corner" element (what g < 0 reads)
    idx = np.where(g < 0, n, np.minimum(g, n - 1))
    return py, px, idx


def _pad_flat(buf: np.ndarray, corner: Optional[np.ndarray]) -> np.ndarray:
    """(h, w, C) -> (h+2, w+2, C) with the browser's flat-index out-of-range rules."""
    h, w, c = buf.shape
    flat = buf.reshape(h * w, c)
    if corner is None:
        corner = flat[-1]
    ext = np.concatenate([flat, corner.reshape(1, c)], axis=0)
    py, px, idx = _ring(h, w)
    out = np.empty((h + 2, w + 2, c), dtype=np.float32)
    out[1:-1, 1:-1] = buf
    out[py, px] = ext[idx]
    return out


def _crelu_stack(layer: PackedLayer, bufs: Dict[str, np.ndarray]) -> np.ndarray:
    first = bufs[layer.segs[0].buf]
    h, w, _ = first.shape
    out = np.empty((h, w, 4 * len(layer.segs)), dtype=np.float32)
    for s, seg in enumerate(layer.segs):
        src = bufs[seg.buf]
        dst = out[:, :, 4 * s : 4 * s + 4]
        if seg.sign > 0:
            np.maximum(src, 0.0, out=dst)
        else:
            np.maximum(-src, 0.0, out=dst)
    return out


def _stack_corner(layer: PackedLayer, corners: Dict[str, np.ndarray]) -> np.ndarray:
    parts = []
    for seg in layer.segs:
        v = corners[seg.buf]
        parts.append(np.maximum(v if seg.sign > 0 else -v, 0.0))
    return np.concatenate(parts).astype(np.float32)


def _matmul(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    # numpy 2.0 on macOS/Accelerate raises spurious FP flags in float32 matmul.
    with np.errstate(all="ignore"):
        return a @ b


def run_band(
    net: Network,
    padded_rgb: np.ndarray,
    geo: BandGeometry,
    corners_in: Optional[Corners] = None,
) -> Tuple[List[np.ndarray], Corners]:
    """Evaluate the network on one band.

    ``padded_rgb`` is (rows + 2, W + 2, 3) float32 in [0, 1]: the band's input
    rows with the *global* texture out-of-range rules already applied around it.

    ``corners_in`` supplies the global last-pixel value of each buffer; it is only
    consulted when the band starts at the top of the image but does not reach the
    bottom (otherwise the band's own last pixel *is* the global one).

    Returns (result buffers in display order, corners captured from this band).
    """
    h, w = geo.rows, geo.width
    bufs: Dict[str, np.ndarray] = {}
    captured: Corners = {}
    use_global_corner = corners_in is not None and geo.is_image_top and not geo.is_image_bottom

    for layer in net.layers:
        if layer.kind == "tex":
            win = sliding_window_view(padded_rgb, (3, 3), axis=(0, 1))  # (h, w, 3, 3, 3)
            cols = np.ascontiguousarray(win).reshape(h * w, 27)
            out = _matmul(cols, layer.wmat)
        elif layer.kind == "spatial":
            stack = _crelu_stack(layer, bufs)
            corner = _stack_corner(layer, corners_in) if use_global_corner else None
            padded = _pad_flat(stack, corner)
            win = sliding_window_view(padded, (3, 3), axis=(0, 1))  # (h, w, C, 3, 3)
            cols = win.reshape(h * w, -1)
            out = _matmul(cols, layer.wmat)
        else:
            stack = _crelu_stack(layer, bufs)
            out = _matmul(stack.reshape(h * w, -1), layer.wmat)
        out += layer.bias
        out = out.reshape(h, w, -1)
        for g, name in enumerate(layer.outs):
            buf = np.ascontiguousarray(out[:, :, 4 * g : 4 * g + 4])
            bufs[name] = buf
            captured[name] = buf[-1, -1].copy()

    return [bufs[name] for name in net.spec.results], captured
