"""Weight loading and the layer graphs of the cnn-2x-{s,m,l} networks.

Everything here mirrors the WebSR WGSL layers (see README, "How parity works"):

* A ``mat4x4f`` is column-major, so flat weight index ``m*16 + c*4 + r`` is the
  coefficient from input channel ``c`` to output channel ``r`` of matrix ``m``.
* CReLU feeds ``max(x, 0)`` through one matrix and ``max(-x, 0)`` through
  another; which matrix index goes with which input is spelled out per layer
  type in the ``segs`` below (taken from conv2d-{8,16,56,112}x4.ts).
* The 3x3 kernels enumerate their taps with x as the *outer* loop: tap ``k``
  is ``(dx, dy) = (k // 3 - 1, k % 3 - 1)``.
"""
from __future__ import annotations

import json
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np

SIZES = {"small": "s", "medium": "m", "large": "l"}
CONTENTS = ("rl", "an", "3d")


@dataclass(frozen=True)
class Seg:
    """One CReLU half of one input buffer feeding a layer."""

    buf: str  # input buffer name
    sign: int  # +1 -> max(x, 0), -1 -> max(-x, 0)
    base: int  # matrix index (spatial layers: base + tap)


@dataclass(frozen=True)
class LayerDef:
    kind: str  # "tex" | "spatial" | "point"
    segs: Tuple[Seg, ...]  # empty for "tex"
    groups: Tuple[str, ...]  # weight-layer names; each yields one 4-channel buffer
    outs: Tuple[str, ...]  # output buffer names (same length as groups)


@dataclass(frozen=True)
class NetworkSpec:
    layers: Tuple[LayerDef, ...]
    results: Tuple[str, ...]  # buffers that feed the display layer
    display_3c: bool  # False: one scalar residual for all of R,G,B (display.ts)
    spatial_depth: int  # number of 3x3 layers that read buffers (not the texture)

    @property
    def band_margin(self) -> int:
        """Rows of context a band needs on each side for exact results.

        Flat indexing lets one 3x3 layer reach two rows across the row seam
        (``(x=W-1, dx=+1, dy=+1)`` lands on the first pixel two rows down), so the
        reach is 2 rows per layer, not 1.
        """
        return 2 * self.spatial_depth


def _chain(names: List[str], first_in: str) -> List[LayerDef]:
    layers = []
    prev = first_in
    for n, out in names:
        layers.append(
            LayerDef("spatial", (Seg(prev, 1, 0), Seg(prev, -1, 9)), (n,), (out,))
        )
        prev = out
    return layers


def _spec_small() -> NetworkSpec:
    layers = [LayerDef("tex", (), ("conv2d_tf",), ("b0",))]
    layers += _chain([("conv2d_1_tf", "b1"), ("conv2d_2_tf", "b2"), ("conv2d_last_tf", "b3")], "b0")
    return NetworkSpec(tuple(layers), ("b3",), False, 3)


def _spec_medium() -> NetworkSpec:
    layers = [LayerDef("tex", (), ("conv2d_tf",), ("b0",))]
    layers += _chain([(f"conv2d_{i}_tf", f"b{i}") for i in range(1, 7)], "b0")
    segs: List[Seg] = []
    for i in range(7):
        segs.append(Seg(f"b{i}", 1, 2 * i))
        segs.append(Seg(f"b{i}", -1, 2 * i + 1))
    layers.append(
        LayerDef("point", tuple(segs), ("conv2d_7_tf", "conv2d_7_tf1", "conv2d_7_tf2"), ("r0", "r1", "r2"))
    )
    return NetworkSpec(tuple(layers), ("r0", "r1", "r2"), True, 6)


def _spec_large() -> NetworkSpec:
    # Two parallel 4-channel streams, A ("conv2d_N_tf") and B ("conv2d_N_tf1").
    layers = [LayerDef("tex", (), ("conv2d_tf", "conv2d_tf1"), ("A0", "B0"))]
    for i in range(1, 7):
        segs = (
            Seg(f"A{i-1}", 1, 0),
            Seg(f"B{i-1}", 1, 9),
            Seg(f"A{i-1}", -1, 18),
            Seg(f"B{i-1}", -1, 27),
        )
        layers.append(
            LayerDef("spatial", segs, (f"conv2d_{i}_tf", f"conv2d_{i}_tf1"), (f"A{i}", f"B{i}"))
        )
    segs_l: List[Seg] = []
    for i in range(7):
        # conv2d-112x4: first half reads the A stream (4i, 4i+2), second half
        # the B stream (4i+1, 4i+3); Concat2 sums both halves and adds bias.
        segs_l += [
            Seg(f"A{i}", 1, 4 * i),
            Seg(f"B{i}", 1, 4 * i + 1),
            Seg(f"A{i}", -1, 4 * i + 2),
            Seg(f"B{i}", -1, 4 * i + 3),
        ]
    layers.append(
        LayerDef(
            "point",
            tuple(segs_l),
            ("conv2d_last_tf", "conv2d_last_tf1", "conv2d_last_tf2"),
            ("r0", "r1", "r2"),
        )
    )
    return NetworkSpec(tuple(layers), ("r0", "r1", "r2"), True, 6)


SPECS: Dict[str, NetworkSpec] = {"s": _spec_small(), "m": _spec_medium(), "l": _spec_large()}


@dataclass
class PackedLayer:
    kind: str
    segs: Tuple[Seg, ...]
    outs: Tuple[str, ...]
    wmat: np.ndarray  # (K, 4 * groups) float32, ready for ``im2col @ wmat``
    bias: np.ndarray  # (4 * groups,) float32


class Network:
    """A network with its weights packed for matrix-multiply evaluation."""

    def __init__(self, size_key: str, content: str, layers_json: dict):
        self.size_key = size_key
        self.content = content
        self.spec = SPECS[size_key]
        self.layers: List[PackedLayer] = []
        for ld in self.spec.layers:
            self.layers.append(self._pack(ld, layers_json))

    @staticmethod
    def _mats(layers_json: dict, name: str) -> Tuple[np.ndarray, np.ndarray]:
        entry = layers_json[name]
        w = np.asarray(entry["weights"], dtype=np.float32).reshape(-1, 4, 4)  # [m][c][r]
        b = np.asarray(entry.get("bias") or [0, 0, 0, 0], dtype=np.float32)
        return w, b

    def _pack(self, ld: LayerDef, layers_json: dict) -> PackedLayer:
        n_groups = len(ld.groups)
        biases = np.zeros(4 * n_groups, dtype=np.float32)
        group_mats = []
        for g, name in enumerate(ld.groups):
            w, b = self._mats(layers_json, name)
            group_mats.append(w)
            biases[4 * g : 4 * g + 4] = b

        if ld.kind == "tex":
            # Input is RGB(A) -> 4 channels, but the alpha column is all zero in
            # every shipped weight file, so only RGB is evaluated (checked below).
            k = 3 * 9
            wmat = np.zeros((k, 4 * n_groups), dtype=np.float32)
            for g, w in enumerate(group_mats):
                if w.shape[0] != 9:
                    raise ValueError("unexpected texture layer shape")
                if np.any(w[:, 3, :] != 0):
                    raise ValueError("non-zero alpha weights are not supported")
                for i in range(3):  # dy + 1
                    for j in range(3):  # dx + 1
                        tap = j * 3 + i
                        for c in range(3):
                            wmat[(c * 3 + i) * 3 + j, 4 * g : 4 * g + 4] = w[tap, c, :]
            return PackedLayer("tex", (), ld.outs, wmat, biases)

        n_seg = len(ld.segs)
        if ld.kind == "spatial":
            wmat = np.zeros((n_seg * 4 * 9, 4 * n_groups), dtype=np.float32)
            for g, w in enumerate(group_mats):
                for s, seg in enumerate(ld.segs):
                    for i in range(3):
                        for j in range(3):
                            tap = j * 3 + i
                            for c in range(4):
                                wmat[((s * 4 + c) * 3 + i) * 3 + j, 4 * g : 4 * g + 4] = w[seg.base + tap, c, :]
            return PackedLayer("spatial", ld.segs, ld.outs, wmat, biases)

        wmat = np.zeros((n_seg * 4, 4 * n_groups), dtype=np.float32)
        for g, w in enumerate(group_mats):
            for s, seg in enumerate(ld.segs):
                wmat[s * 4 : s * 4 + 4, 4 * g : 4 * g + 4] = w[seg.base]
        return PackedLayer("point", ld.segs, ld.outs, wmat, biases)


def weights_path(weights_dir: Path, size_key: str, content: str) -> Path:
    return Path(weights_dir) / f"cnn-2x-{size_key}-{content}.json"


_cache: Dict[Tuple[str, str, str], Network] = {}
_cache_lock = threading.Lock()


def load_network(weights_dir: Path, size: str, content: str) -> Network:
    """Load (and cache) a network. ``size`` is small/medium/large."""
    if size not in SIZES:
        raise KeyError(size)
    if content not in CONTENTS:
        raise KeyError(content)
    key = (str(Path(weights_dir).resolve()), size, content)
    with _cache_lock:
        net = _cache.get(key)
        if net is None:
            path = weights_path(weights_dir, SIZES[size], content)
            with open(path, "r", encoding="utf-8") as fh:
                data = json.load(fh)
            net = Network(SIZES[size], content, data["layers"])
            _cache[key] = net
        return net
