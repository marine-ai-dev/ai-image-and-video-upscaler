from pathlib import Path

from scripts import sync_weights


def test_api_weights_match_website_weights():
    """src/weights is the single source of truth; api/weights must be an exact copy.
    Fix with: python scripts/sync_weights.py"""
    assert sync_weights.SOURCE.exists(), f"website weights not found at {sync_weights.SOURCE}"
    problems = sync_weights.differences()
    assert not problems, "api/weights out of sync with ../src/weights -> run scripts/sync_weights.py: " + "; ".join(problems)


def test_all_nine_files_present():
    names = {p.name for p in Path(sync_weights.DEST).glob("*.json")}
    assert names == set(sync_weights.EXPECTED)
