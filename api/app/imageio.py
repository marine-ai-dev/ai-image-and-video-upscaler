"""Decoding and encoding. The real file type is determined by decoding, never by
the extension or the Content-Type header."""
from __future__ import annotations

import io
from dataclasses import dataclass
from typing import Optional

import numpy as np
from PIL import Image, ImageCms, ImageFile, ImageOps

from .errors import ApiError

ImageFile.LOAD_TRUNCATED_IMAGES = False

FORMAT_MIME = {"png": "image/png", "jpeg": "image/jpeg", "webp": "image/webp"}
FORMAT_EXT = {"png": "png", "jpeg": "jpg", "webp": "webp"}
# Hard encoder limits (WebP stores dimensions in 14 bits, JPEG in 16).
FORMAT_MAX_EDGE = {"png": 2**31 - 1, "jpeg": 65535, "webp": 16383}
_PIL_TO_FORMAT = {"PNG": "png", "JPEG": "jpeg", "MPO": "jpeg", "WEBP": "webp"}


@dataclass
class DecodedImage:
    rgb: np.ndarray  # (H, W, 3) uint8, straight (un-premultiplied) colour
    alpha: Optional[np.ndarray]  # (H, W) uint8, or None if the image is opaque
    format: str  # "png" | "jpeg" | "webp" (what the bytes really were)

    @property
    def width(self) -> int:
        return int(self.rgb.shape[1])

    @property
    def height(self) -> int:
        return int(self.rgb.shape[0])


def peek_dimensions(data: bytes):
    """(width, height, format) from the header only, without decoding pixel data."""
    try:
        img = Image.open(io.BytesIO(data))
        fmt = _PIL_TO_FORMAT.get(img.format or "")
        size = img.size
    except Image.DecompressionBombError:
        raise ApiError(413, "image_too_large", "Image dimensions exceed the decoder safety limit.") from None
    except Exception:
        raise ApiError(422, "invalid_image", "The upload is not a valid PNG, JPEG or WebP image.") from None
    if fmt is None:
        raise ApiError(415, "unsupported_format", "Only PNG, JPEG and WebP images are supported.")
    return size[0], size[1], fmt


def _srgb_profile_name(profile_bytes: bytes) -> str:
    try:
        prof = ImageCms.ImageCmsProfile(io.BytesIO(profile_bytes))
        return ImageCms.getProfileDescription(prof) or ""
    except Exception:
        return ""


def _to_srgb(img: Image.Image) -> Image.Image:
    """Browsers colour-manage decoded images to sRGB (createImageBitmap's default)."""
    icc = img.info.get("icc_profile")
    if not icc or img.mode not in ("RGB", "RGBA", "L", "LA"):
        return img
    if "srgb" in _srgb_profile_name(icc).lower():
        return img
    try:
        src = ImageCms.ImageCmsProfile(io.BytesIO(icc))
        dst = ImageCms.createProfile("sRGB")
        if img.mode in ("L", "LA"):
            img = img.convert("RGBA" if img.mode == "LA" else "RGB")
        has_alpha = img.mode == "RGBA"
        alpha = img.getchannel("A") if has_alpha else None
        rgb = img.convert("RGB")
        out = ImageCms.profileToProfile(
            rgb, src, dst, renderingIntent=ImageCms.Intent.RELATIVE_COLORIMETRIC, outputMode="RGB"
        )
        if alpha is not None:
            out.putalpha(alpha)
        return out
    except Exception:
        return img


def decode_image(data: bytes, max_pixels: Optional[int] = None) -> DecodedImage:
    """Fully decode ``data``; raises ApiError for anything that is not a sound
    PNG/JPEG/WebP (or that is bigger than ``max_pixels``)."""
    try:
        img = Image.open(io.BytesIO(data))
        fmt = _PIL_TO_FORMAT.get(img.format or "")
        if fmt is None:
            raise ApiError(415, "unsupported_format", "Only PNG, JPEG and WebP images are supported.")
        if max_pixels is not None and img.size[0] * img.size[1] > max_pixels:
            raise ApiError(413, "input_too_large", "Image has too many pixels.")
        img.load()
    except ApiError:
        raise
    except Image.DecompressionBombError:
        raise ApiError(413, "image_too_large", "Image dimensions exceed the decoder safety limit.") from None
    except Exception:
        raise ApiError(422, "invalid_image", "The upload is not a valid, complete PNG, JPEG or WebP image.") from None

    try:
        img = ImageOps.exif_transpose(img) or img
    except Exception:
        pass
    img = _to_srgb(img)

    mode = img.mode
    try:
        if mode in ("I;16", "I;16L", "I;16B", "I"):
            arr16 = np.asarray(img, dtype=np.float64)
            scale = 65535.0 if arr16.max() > 255 else 255.0
            gray = np.clip(np.floor(arr16 / scale * 255.0 + 0.5), 0, 255).astype(np.uint8)
            rgb = np.repeat(gray[..., None], 3, axis=2)
            return DecodedImage(rgb, None, fmt)
        if mode in ("P", "PA") or "transparency" in img.info:
            img = img.convert("RGBA")
            mode = "RGBA"
        if mode == "LA":
            img = img.convert("RGBA")
            mode = "RGBA"
        if mode == "RGBA":
            arr = np.asarray(img, dtype=np.uint8)
            alpha = np.ascontiguousarray(arr[..., 3])
            rgb = np.ascontiguousarray(arr[..., :3])
            if alpha.min() == 255:
                return DecodedImage(rgb, None, fmt)
            return DecodedImage(rgb, alpha, fmt)
        rgb = np.ascontiguousarray(np.asarray(img.convert("RGB"), dtype=np.uint8))
        return DecodedImage(rgb, None, fmt)
    except ApiError:
        raise
    except Exception:
        raise ApiError(422, "invalid_image", "The image could not be converted for processing.") from None


def encode_image(pixels: np.ndarray, fmt: str, jpeg_quality: int = 92) -> bytes:
    """Encode an (H, W, 3|4) uint8 array."""
    if fmt not in FORMAT_MIME:
        raise ValueError(fmt)
    img = Image.fromarray(pixels)
    buf = io.BytesIO()
    if fmt == "png":
        img.save(buf, format="PNG", compress_level=6)
    elif fmt == "jpeg":
        img.convert("RGB").save(buf, format="JPEG", quality=jpeg_quality, optimize=False)
    else:
        img.convert("RGB").save(buf, format="WEBP", quality=jpeg_quality, method=4)
    return buf.getvalue()
