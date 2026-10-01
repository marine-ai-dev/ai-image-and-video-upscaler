"""Request parameters, limit checks and the decode -> upscale -> encode run.

Everything that can be rejected without doing real work is rejected here first,
from the image header alone (dimensions) and the requested passes.
"""
from __future__ import annotations

import os
import re
import threading
from dataclasses import dataclass
from typing import Callable, Optional

from .config import Settings
from .engine.pipeline import process_image
from .engine.weights import CONTENTS, SIZES, load_network
from .errors import ApiError, invalid
from .imageio import (
    FORMAT_EXT,
    FORMAT_MAX_EDGE,
    FORMAT_MIME,
    decode_image,
    encode_image,
    peek_dimensions,
)
from .planning import MAX_PASSES, TargetPlan, dimensions_after_passes, plan_for_target

# The upper bound on target_long_edge is arbitrary but keeps arithmetic sane.
MAX_TARGET_LONG_EDGE = 1_000_000


@dataclass(frozen=True)
class UpscaleParams:
    model: str = "medium"
    content: str = "rl"
    passes: Optional[int] = None  # None -> use target_long_edge, or 1 if both are None
    target_long_edge: Optional[int] = None
    format: Optional[str] = None  # None -> same as input
    filename: Optional[str] = None


@dataclass(frozen=True)
class Plan:
    model: str
    content: str
    passes: int
    source_width: int
    source_height: int
    width: int
    height: int
    format: str
    target: Optional[TargetPlan]


@dataclass
class UpscaleResult:
    data: bytes
    mime: str
    format: str
    width: int
    height: int
    passes: int
    plan: Plan


_FORMAT_ALIASES = {"png": "png", "jpeg": "jpeg", "jpg": "jpeg", "webp": "webp"}


def normalise_params(
    model: Optional[str],
    content: Optional[str],
    passes: Optional[str],
    target_long_edge: Optional[str],
    fmt: Optional[str],
    settings: Settings,
    filename: Optional[str] = None,
) -> UpscaleParams:
    """Validate raw form strings. Raises ApiError(422) with a stable code."""
    model = (model or "medium").strip().lower()
    if model not in SIZES:
        raise invalid("invalid_model", f"model must be one of: {', '.join(SIZES)}.")
    content = (content or "rl").strip().lower()
    if content not in CONTENTS:
        raise invalid("invalid_content", f"content must be one of: {', '.join(CONTENTS)}.")

    has_passes = passes is not None and passes.strip() != ""
    has_target = target_long_edge is not None and target_long_edge.strip() != ""
    if has_passes and has_target:
        raise invalid("conflicting_parameters", "Give either passes or target_long_edge, not both.")

    n_passes: Optional[int] = None
    if has_passes:
        try:
            n_passes = int(passes.strip())  # type: ignore[union-attr]
        except ValueError:
            raise invalid("invalid_passes", "passes must be an integer.") from None
        if not 1 <= n_passes <= min(MAX_PASSES, settings.max_passes):
            raise invalid("invalid_passes", f"passes must be between 1 and {min(MAX_PASSES, settings.max_passes)}.")

    target: Optional[int] = None
    if has_target:
        try:
            target = int(target_long_edge.strip())  # type: ignore[union-attr]
        except ValueError:
            raise invalid("invalid_target", "target_long_edge must be an integer.") from None
        if not 1 <= target <= MAX_TARGET_LONG_EDGE:
            raise invalid("invalid_target", f"target_long_edge must be between 1 and {MAX_TARGET_LONG_EDGE}.")

    out_fmt: Optional[str] = None
    if fmt is not None and fmt.strip() != "":
        out_fmt = _FORMAT_ALIASES.get(fmt.strip().lower())
        if out_fmt is None:
            raise invalid("invalid_format", "format must be one of: png, jpeg, webp.")

    return UpscaleParams(model, content, n_passes, target, out_fmt, filename)


def make_plan(width: int, height: int, input_format: str, params: UpscaleParams, settings: Settings) -> Plan:
    """Resolve passes and output size and enforce every size limit."""
    max_passes = min(MAX_PASSES, settings.max_passes)
    target_plan: Optional[TargetPlan] = None
    if params.target_long_edge is not None:
        target_plan = plan_for_target(width, height, params.target_long_edge, max_passes)
        passes = target_plan.passes
    else:
        passes = params.passes or 1

    if width * height > settings.max_input_pixels:
        raise ApiError(
            413,
            "input_too_large",
            f"Input is {width}x{height} ({width * height} px); the limit is {settings.max_input_pixels} px.",
        )
    out_w, out_h = dimensions_after_passes(width, height, passes)
    if out_w * out_h > settings.max_output_pixels:
        raise ApiError(
            413,
            "output_too_large",
            f"The result would be {out_w}x{out_h} ({out_w * out_h} px) after {passes} pass(es); "
            f"the limit is {settings.max_output_pixels} px. Use fewer passes or a smaller input.",
        )
    out_fmt = params.format or input_format
    if max(out_w, out_h) > FORMAT_MAX_EDGE[out_fmt]:
        raise ApiError(
            422,
            "output_too_large_for_format",
            f"{out_fmt} cannot encode an edge longer than {FORMAT_MAX_EDGE[out_fmt]} px "
            f"(the result is {out_w}x{out_h}). Use png or fewer passes.",
        )
    return Plan(params.model, params.content, passes, width, height, out_w, out_h, out_fmt, target_plan)


def precheck(data: bytes, params: UpscaleParams, settings: Settings) -> Plan:
    """Header-only validation: type, dimensions, passes and output size."""
    width, height, fmt = peek_dimensions(data)
    return make_plan(width, height, fmt, params, settings)


# --- engine gate: one place that bounds concurrent CPU/memory use -------------------

class EngineGate:
    def __init__(self, concurrency: int):
        self._sem = threading.BoundedSemaphore(concurrency)

    def acquire(self, timeout: Optional[float]) -> bool:
        if timeout is None:
            self._sem.acquire()
            return True
        return self._sem.acquire(timeout=timeout)

    def release(self) -> None:
        self._sem.release()


ProgressCb = Callable[[float, int, int], None]  # (fraction 0..1, pass_no, passes)


def run_upscale(
    data: bytes,
    params: UpscaleParams,
    settings: Settings,
    progress: Optional[ProgressCb] = None,
    plan: Optional[Plan] = None,
) -> UpscaleResult:
    """Decode, upscale and encode. Caller is responsible for holding the EngineGate."""
    decoded = decode_image(data, settings.max_input_pixels)
    plan = make_plan(decoded.width, decoded.height, decoded.format, params, settings)
    net = load_network(settings.weights_dir, plan.model, plan.content)

    def on_progress(p: int, passes: int, band: int, bands: int) -> None:
        if progress:
            progress(((p - 1) + band / bands) / passes, p, passes)

    pixels = process_image(
        net,
        decoded.rgb,
        decoded.alpha,
        plan.passes,
        plan.format,
        settings.tile_pixels,
        settings.browser_compat_edges,
        on_progress,
    )
    if progress:
        progress(1.0, plan.passes, plan.passes)
    out_bytes = encode_image(pixels, plan.format, settings.jpeg_quality)
    h, w = pixels.shape[:2]
    return UpscaleResult(out_bytes, FORMAT_MIME[plan.format], plan.format, w, h, plan.passes, plan)


_BAD = re.compile(r"[^A-Za-z0-9._ ()+-]")


def output_filename(original: Optional[str], plan: Plan) -> str:
    """Mirror media-files.ts buildOutputName: ``photo.png`` -> ``photo_upscaled_4096x4096.png``."""
    base = os.path.basename((original or "image").replace("\\", "/"))
    stem = base.rsplit(".", 1)[0] if "." in base else base
    stem = _BAD.sub("_", stem).strip("._ ")[:80] or "image"
    return f"{stem}_upscaled_{plan.width}x{plan.height}.{FORMAT_EXT[plan.format]}"
