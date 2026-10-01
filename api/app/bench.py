"""Size the service: time one pass and report peak memory on *this* machine.

    python -m app.bench                 # all models at 512 and 1024
    python -m app.bench --model large --edge 2048

Run it inside the container (e.g. ``railway ssh``) to measure the real vCPUs.
"""
from __future__ import annotations

import argparse
import resource
import sys
import time

import numpy as np

from .config import DEFAULT_WEIGHTS_DIR, Settings
from .engine.upscale import upscale_pass
from .engine.weights import SIZES, load_network


def peak_rss_mb() -> float:
    peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return peak / (1024 * 1024) if sys.platform == "darwin" else peak / 1024


def synthetic(edge: int) -> np.ndarray:
    rng = np.random.default_rng(0)
    y, x = np.mgrid[0:edge, 0:edge]
    base = ((x * 255 // edge) ^ (y * 255 // edge)).astype(np.uint8)
    img = np.stack([base, np.roll(base, 37, 0), np.roll(base, 91, 1)], axis=2)
    noise = rng.integers(-12, 12, img.shape, dtype=np.int16)
    return np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", choices=list(SIZES), action="append")
    ap.add_argument("--edge", type=int, action="append", help="square input edge in px")
    ap.add_argument("--tile-pixels", type=int, default=Settings.tile_pixels)
    args = ap.parse_args()
    for model in args.model or list(SIZES):
        net = load_network(DEFAULT_WEIGHTS_DIR, model, "rl")
        upscale_pass(synthetic(64), net)  # warm up
        for edge in args.edge or [512, 1024]:
            img = synthetic(edge)
            w0, c0 = time.perf_counter(), time.process_time()
            out = upscale_pass(img, net, tile_pixels=args.tile_pixels)
            wall, cpu = time.perf_counter() - w0, time.process_time() - c0
            print(
                f"{model:6s} {edge:5d}px -> {out.shape[1]}x{out.shape[0]}  wall {wall:6.2f}s  "
                f"cpu {cpu:6.2f}s  peak RSS so far {peak_rss_mb():6.0f} MB"
            )


if __name__ == "__main__":
    main()
