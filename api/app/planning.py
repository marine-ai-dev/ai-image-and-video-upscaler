"""Pass planning. A straight port of ``src/lib/upscale-math.ts`` (planForTarget,
dimensionsAfterPasses): the model's native step is 2x, the API never resamples
between or after passes, and a target resolves to the *fewest* native passes
whose result reaches it."""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Tuple

NATIVE_SCALE = 2
MAX_PASSES = 4


@dataclass(frozen=True)
class TargetPlan:
    passes: int
    width: int
    height: int
    requested_long_edge: int
    exact: bool
    capped_by_max_passes: bool
    already_at_or_above_target: bool


def dimensions_after_passes(width: int, height: int, passes: int) -> Tuple[int, int]:
    factor = NATIVE_SCALE ** max(0, passes)
    return width * factor, height * factor


def plan_for_target(width: int, height: int, requested_long_edge: float, max_passes: int = MAX_PASSES) -> TargetPlan:
    source_long = max(width, height)
    target = max(1, math.floor(requested_long_edge))

    capped = False
    already = source_long >= target
    if already:
        passes = 1
    else:
        candidate = 1
        while source_long * NATIVE_SCALE ** candidate < target and candidate < max_passes:
            candidate += 1
        if source_long * NATIVE_SCALE ** candidate < target:
            capped = True
        passes = candidate

    w, h = dimensions_after_passes(width, height, passes)
    return TargetPlan(
        passes=passes,
        width=w,
        height=h,
        requested_long_edge=target,
        exact=max(w, h) == target,
        capped_by_max_passes=capped,
        already_at_or_above_target=already,
    )
