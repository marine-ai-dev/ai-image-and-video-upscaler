"""One 2x model pass over an image, optionally split into overlapping bands."""
from __future__ import annotations

from typing import Callable, List, Optional, Tuple

import numpy as np

from .forward import BandGeometry, Corners, run_band
from .weights import Network

MIN_CORE_ROWS = 8


def plan_bands(height: int, width: int, depth: int, tile_pixels: int) -> List[Tuple[int, int]]:
    """Split ``height`` rows into core ranges so a band (core + ``depth`` context rows
    on each side) stays near ``tile_pixels`` pixels. A single band is used when the
    image already fits."""
    if height * width <= tile_pixels:
        return [(0, height)]
    core = max(MIN_CORE_ROWS, tile_pixels // max(width, 1) - 2 * depth)
    if core >= height:
        return [(0, height)]
    return [(a, min(a + core, height)) for a in range(0, height, core)]


def _texture_pad(img: np.ndarray, ia: int, ib: int) -> np.ndarray:
    """Rows [ia-1, ib] and columns [-1, W] as float32 in [0, 1], with the browser's
    textureLoad rule: coordinates < 0 map to the last texel, > max clamp to it."""
    h, w, _ = img.shape
    ys = np.arange(ia - 1, ib + 1)
    ys = np.where(ys < 0, h - 1, np.minimum(ys, h - 1))
    xs = np.arange(-1, w + 1)
    xs = np.where(xs < 0, w - 1, np.minimum(xs, w - 1))
    out = img[ys][:, xs].astype(np.float32)
    out *= np.float32(1.0 / 255.0)
    return out


def _display(img: np.ndarray, a: int, b: int, res: List[np.ndarray], display_3c: bool) -> np.ndarray:
    """display.ts / display_3c.ts for core rows [a, b): repeat-sampled linear 2x of the
    input plus the pixel-shuffled residual, rounded to 8 bit."""
    h, w, _ = img.shape
    hc = b - a
    ys = np.arange(a - 1, b + 1) % h
    xs = np.arange(-1, w + 1) % w
    src = img[ys][:, xs].astype(np.float32)
    src *= np.float32(1.0 / 255.0)  # (hc+2, w+2, 3)

    # Output pixel 2k samples input texel k-0.25 -> 0.75*k + 0.25*(k-1);
    # pixel 2k+1 samples k+0.25 -> 0.75*k + 0.25*(k+1).
    cur = src[1:-1]
    up, down = src[:-2], src[2:]
    rows = np.empty((hc, 2, w + 2, 3), dtype=np.float32)
    rows[:, 0] = cur * np.float32(0.75) + up * np.float32(0.25)
    rows[:, 1] = cur * np.float32(0.75) + down * np.float32(0.25)
    ccur = rows[:, :, 1:-1]
    left, right = rows[:, :, :-2], rows[:, :, 2:]
    out = np.empty((hc, 2, w, 2, 3), dtype=np.float32)  # [y, py, x, px, ch]
    out[:, :, :, 0] = ccur * np.float32(0.75) + left * np.float32(0.25)
    out[:, :, :, 1] = ccur * np.float32(0.75) + right * np.float32(0.25)

    # pixel_shuffle: component c = px + 2*py of the residual buffer
    for py in range(2):
        for px in range(2):
            c = px + 2 * py
            if display_3c:
                for ch in range(3):
                    out[:, py, :, px, ch] += res[ch][:, :, c]
            else:
                out[:, py, :, px, :] += res[0][:, :, c][..., None]

    out *= np.float32(255.0)
    out += np.float32(0.5)
    np.floor(out, out=out)
    np.clip(out, 0, 255, out=out)
    return out.astype(np.uint8).reshape(hc * 2, w * 2, 3)


def upscale_pass(
    img: np.ndarray,
    net: Network,
    tile_pixels: int = 131072,
    compat: bool = True,
    on_band: Optional[Callable[[int, int], None]] = None,
    bands: Optional[List[Tuple[int, int]]] = None,
) -> np.ndarray:
    """Upscale an (H, W, 3) uint8 image 2x -> (2H, 2W, 3) uint8."""
    if img.ndim != 3 or img.shape[2] != 3 or img.dtype != np.uint8:
        raise ValueError("expected an (H, W, 3) uint8 image")
    h, w, _ = img.shape
    depth = net.spec.band_margin
    bands = bands or plan_bands(h, w, depth, tile_pixels)
    out = np.empty((2 * h, 2 * w, 3), dtype=np.uint8)

    # The bottom band goes first: its last pixel is the global "corner" that the top
    # band reads for out-of-range indices.
    order = list(reversed(range(len(bands))))
    corners: Optional[Corners] = None
    done = 0
    for bi in order:
        a, b = bands[bi]
        ia, ib = max(0, a - depth), min(h, b + depth)
        geo = BandGeometry(height=h, width=w, first_row=ia, rows=ib - ia, compat=compat)
        padded = _texture_pad(img, ia, ib)
        res, captured = run_band(net, padded, geo, corners_in=corners)
        if bi == order[0]:
            corners = captured
        core = [r[a - ia : b - ia] for r in res]
        out[2 * a : 2 * b] = _display(img, a, b, core, net.spec.display_3c)
        done += 1
        if on_band:
            on_band(done, len(bands))
    return out
