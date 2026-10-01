"""The image pipeline around the model: matte, passes, alpha. Mirrors worker.ts."""
from __future__ import annotations

from pathlib import Path
from typing import Callable, Optional

import numpy as np

from .resample import upscale_plane
from .upscale import plan_bands, upscale_pass
from .weights import Network

# worker.ts: createMattedImageBitmap() fills this colour before drawing the bitmap,
# so semi-transparent pixels are rendered against a light matte.
MATTE = (255, 250, 242)

ProgressFn = Callable[[int, int, int, int], None]  # (pass_no, passes, band_no, bands)


ROW_BLOCK_PIXELS = 1 << 20  # per-block pixel budget for the uint32 temporaries below


def _blocks(h: int, w: int):
    rows = max(1, ROW_BLOCK_PIXELS // max(w, 1))
    for r0 in range(0, h, rows):
        yield r0, min(r0 + rows, h)


def matte_composite(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """Canvas ``drawImage`` of a premultiplied bitmap onto a #fffaf2 fill."""
    out = np.empty_like(rgb)
    matte = np.array(MATTE, dtype=np.uint32)[None, None, :]
    for r0, r1 in _blocks(*rgb.shape[:2]):
        a = alpha[r0:r1, :, None].astype(np.uint32)
        pm = (rgb[r0:r1].astype(np.uint32) * a + 127) // 255
        out[r0:r1] = np.minimum(pm + (matte * (255 - a) + 127) // 255, 255)
    return out


def premultiply_roundtrip(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """Canvas stores premultiplied colour; reading it back un-premultiplies. This is
    what ``getImageData``/PNG encoding does to colour under non-opaque alpha (fully
    transparent pixels come back as black)."""
    out = np.empty_like(rgb)
    for r0, r1 in _blocks(*rgb.shape[:2]):
        a = alpha[r0:r1, :, None].astype(np.uint32)
        pm = (rgb[r0:r1].astype(np.uint32) * a + 127) // 255
        safe = np.maximum(a, 1)
        un = (2 * pm * 255 + safe) // (2 * safe)
        out[r0:r1] = np.where(a > 0, np.minimum(un, 255), 0)
    return out


def run_passes(
    net: Network,
    rgb: np.ndarray,
    passes: int,
    tile_pixels: int,
    progress: Optional[ProgressFn] = None,
) -> np.ndarray:
    """Chain ``passes`` model passes; each pass feeds the 8-bit result of the last."""
    current = rgb
    for p in range(1, passes + 1):

        def cb(done: int, total: int, p=p) -> None:
            if progress:
                progress(p, passes, done, total)

        current = upscale_pass(current, net, tile_pixels=tile_pixels, on_band=cb)
    return current


def process_image(
    net: Network,
    rgb: np.ndarray,
    alpha: Optional[np.ndarray],
    passes: int,
    out_format: str,
    tile_pixels: int,
    progress: Optional[ProgressFn] = None,
) -> np.ndarray:
    """Return the final pixels: (H, W, 4) uint8 for PNG with real transparency,
    otherwise (H, W, 3) uint8.

    PNG (``preserveAlpha`` in worker.ts): the first pass sees the image matted onto
    #fffaf2, and the original alpha is bicubic-upscaled and put back at the end.
    Other formats: no alpha; the browser feeds the straight colour of the decoded
    (premultiplied) bitmap, so transparent pixels become black.
    """
    preserve_alpha = out_format == "png"
    if alpha is None:
        model_input = rgb
    elif preserve_alpha:
        model_input = matte_composite(rgb, alpha)
    else:
        model_input = premultiply_roundtrip(rgb, alpha)

    out = run_passes(net, model_input, passes, tile_pixels, progress)

    if alpha is None or not preserve_alpha:
        return out
    up_alpha = upscale_plane(alpha, 2**passes)
    out = premultiply_roundtrip(out, up_alpha)
    return np.dstack([out, up_alpha])
