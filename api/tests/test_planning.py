"""target_long_edge -> passes must follow src/lib/upscale-math.ts (planForTarget)."""
import json
import shutil
import subprocess
from pathlib import Path

import pytest

from app.planning import MAX_PASSES, dimensions_after_passes, plan_for_target

REPO = Path(__file__).resolve().parent.parent.parent

SQUARE = (1024, 1024)
PORTRAIT = (768, 1024)
LANDSCAPE = (1920, 1080)


# --- the same expectations as tests/upscale-math.test.ts ----------------------------

def test_dimensions_double_per_pass_and_keep_aspect():
    assert dimensions_after_passes(*SQUARE, 1) == (2048, 2048)
    assert dimensions_after_passes(*SQUARE, 3) == (8192, 8192)
    assert dimensions_after_passes(*PORTRAIT, 2) == (3072, 4096)
    assert dimensions_after_passes(1024, 768, 2) == (4096, 3072)


def test_target_picks_fewest_passes_that_reach_it():
    exact = plan_for_target(*SQUARE, 4096)
    assert (exact.passes, exact.width, exact.height, exact.exact) == (2, 4096, 4096, True)

    overshoot = plan_for_target(*SQUARE, 3000)
    assert (overshoot.passes, overshoot.exact, overshoot.width) == (2, False, 4096)

    assert plan_for_target(*SQUARE, 4000).passes == 2


def test_target_uses_long_edge():
    plan = plan_for_target(*PORTRAIT, 4096)
    assert (plan.passes, plan.width, plan.height) == (2, 3072, 4096)


def test_target_capped_by_max_passes():
    plan = plan_for_target(*SQUARE, 100000, MAX_PASSES)
    assert plan.passes == MAX_PASSES and plan.capped_by_max_passes


def test_target_below_source_still_runs_one_pass():
    plan = plan_for_target(*LANDSCAPE, 800)
    assert plan.already_at_or_above_target and plan.passes == 1


def test_never_resamples_result_is_native_size():
    plan = plan_for_target(500, 300, 1234)
    assert (plan.width, plan.height) == (500 * 2**plan.passes, 300 * 2**plan.passes)


# --- cross-check against the real TypeScript, when node and the website source exist ---

@pytest.mark.skipif(
    shutil.which("node") is None or not (REPO / "src/lib/upscale-math.ts").exists(),
    reason="needs node and the website source next to api/",
)
def test_matches_typescript_planForTarget_on_a_grid():
    sources = [(1, 1), (64, 64), (100, 37), (768, 1024), (1024, 1024), (1920, 1080), (3000, 200), (5000, 5000)]
    targets = [1, 63, 64, 65, 100, 128, 129, 800, 1000, 1024, 2047, 2048, 3000, 4000, 4096, 4097, 8192, 20000, 100000]
    script = """
import { planForTarget } from './src/lib/upscale-math.ts';
const sources = %s, targets = %s, out = [];
for (const [w, h] of sources) for (const t of targets) {
  const p = planForTarget({ width: w, height: h }, t);
  out.push([w, h, t, p.passes, p.result.width, p.result.height, p.exact, p.cappedByMaxPasses, p.alreadyAtOrAboveTarget]);
}
console.log(JSON.stringify(out));
""" % (json.dumps(sources), json.dumps(targets))
    proc = subprocess.run(
        ["node", "--input-type=module", "-e", script], cwd=REPO, capture_output=True, text=True, timeout=60
    )
    if proc.returncode != 0:
        pytest.skip(f"node could not load the TypeScript source: {proc.stderr[:200]}")
    for w, h, t, passes, rw, rh, exact, capped, already in json.loads(proc.stdout):
        got = plan_for_target(w, h, t)
        assert (got.passes, got.width, got.height, got.exact, got.capped_by_max_passes, got.already_at_or_above_target) == (
            passes, rw, rh, exact, capped, already,
        ), (w, h, t)
