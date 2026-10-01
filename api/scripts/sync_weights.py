#!/usr/bin/env python3
"""Copy the nine weight files from the website (single source of truth) into
api/weights/ so the Docker build context (api/) is self-contained.

    python scripts/sync_weights.py          # copy
    python scripts/sync_weights.py --check  # exit 1 if they differ (used by tests/CI)
"""
from __future__ import annotations

import argparse
import filecmp
import shutil
import sys
from pathlib import Path

API_DIR = Path(__file__).resolve().parent.parent
SOURCE = API_DIR.parent / "src" / "weights"
DEST = API_DIR / "weights"
EXPECTED = [f"cnn-2x-{s}-{c}.json" for s in "sml" for c in ("rl", "an", "3d")]


def differences(source: Path = SOURCE, dest: Path = DEST) -> list:
    problems = []
    for name in EXPECTED:
        src, dst = source / name, dest / name
        if not src.exists():
            problems.append(f"missing in source: {name}")
        elif not dst.exists():
            problems.append(f"missing in api/weights: {name}")
        elif not filecmp.cmp(src, dst, shallow=False):
            problems.append(f"differs: {name}")
    return problems


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--check", action="store_true", help="only verify, do not copy")
    args = ap.parse_args()
    if args.check:
        problems = differences()
        for p in problems:
            print(p, file=sys.stderr)
        return 1 if problems else 0
    DEST.mkdir(exist_ok=True)
    for name in EXPECTED:
        src = SOURCE / name
        if not src.exists():
            print(f"missing in source: {src}", file=sys.stderr)
            return 1
        shutil.copyfile(src, DEST / name)
        print(f"copied {name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
