#!/usr/bin/env python3
"""Compose, check and export the R3 kumiko/wagara silkscreen patterns (back side, both halves).

Same pipeline as R2 (tools/prepare_silkscreen_r2.py): one continuous composition across both
halves seen from below, clipped around pads, holes, legends and part bodies, with the Flan36
plate in a cartouche, injected into scratch boards, KiCad DRC and readback. Boards that carry
an installed pattern are checked with it removed. Previews go to design/proposals/silkscreen-r3/.
SPDX-License-Identifier: GPL-3.0-or-later
"""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from silkscreen import patterns, patterns_jp     # noqa: E402
from prepare_silkscreen_r2 import run            # noqa: E402

REGISTRY = {**patterns_jp.PATTERNS, "meandro": patterns.meandro, "vias": patterns.vias}
ORDER = ["asanoha", "kikko", "sayagata", "seigaiha", "shippo", "meandro", "vias"]

if __name__ == "__main__":
    run("r3", REGISTRY, ORDER, ROOT / "design/proposals/silkscreen-r3", ROOT / "build/silkscreen-r3",
        strip_installed=True, doc=__doc__)
