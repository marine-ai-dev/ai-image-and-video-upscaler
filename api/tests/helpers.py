import io

import numpy as np
from PIL import Image


def png_bytes(w=32, h=24, mode="RGB", seed=0):
    rng = np.random.default_rng(seed)
    channels = len(mode)
    arr = rng.integers(0, 256, size=(h, w, channels), dtype=np.uint8)
    buf = io.BytesIO()
    Image.fromarray(arr[..., 0] if channels == 1 else arr).save(buf, format="PNG")
    return buf.getvalue()


def gradient_png(w=32, h=24):
    x = np.linspace(0, 255, w, dtype=np.uint8)[None, :, None].repeat(h, 0).repeat(3, 2)
    buf = io.BytesIO()
    Image.fromarray(x).save(buf, format="PNG")
    return buf.getvalue()


def encoded(w, h, fmt, mode="RGB"):
    arr = np.random.default_rng(1).integers(0, 256, size=(h, w, len(mode)), dtype=np.uint8)
    buf = io.BytesIO()
    Image.fromarray(arr[..., 0] if len(mode) == 1 else arr).save(buf, format=fmt)
    return buf.getvalue()


def upload(data, name="photo.png", ctype="image/png"):
    return {"file": (name, data, ctype)}


def decode(data):
    return Image.open(io.BytesIO(data))
