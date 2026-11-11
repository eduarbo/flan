#!/usr/bin/env python3
"""Render both signatures from native PCB readbacks, viewed from below.

Run with the silkscreen environment; output docs/images/pcb-signature.png.
SPDX-License-Identifier: GPL-3.0-or-later
"""
from pathlib import Path
import subprocess
from silkscreen.geo import Board
from silkscreen.render import path_d
from prepare_silkscreen_r1 import KICAD_PY

ROOT = Path(__file__).resolve().parents[1]
out = ROOT / "build/pcb-identity"
out.mkdir(parents=True, exist_ok=True)
parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 114 18"><rect width="114" height="18" fill="#efece4"/>']
for i, half in enumerate(("left", "right")):
    subprocess.run([KICAD_PY, ROOT / "tools/silkscreen/kicad_extract.py",
                    ROOT / f"hardware/revI/flan36-{half}.kicad_pcb", out / f"geo-{half}.json"],
                   check=True, capture_output=True)
    board = Board(half, out)
    parts.append(f'<svg x="{i * 57}" y="3" width="56" height="14" viewBox="{57 if half == "left" else 53} 53 56 14">')
    for geometry, color in ((board.outline, "#1f5a3a"), (board.side["B"]["silk"], "#f4f1e8"), (board.holes, "#efece4")):
        parts.append(f'<path d="{path_d(geometry, 160)}" fill="{color}" fill-rule="evenodd"/>')
    parts.append('</svg>')
    parts.append(f'<text x="{i * 57 + 2}" y="2" font-size="1.7" font-family="sans-serif" fill="#163f29">{half.upper()} · UNDERSIDE</text>')
parts.append('</svg>')
svg = out / "signature-detail.svg"
svg.write_text(''.join(parts))
subprocess.run(["rsvg-convert", "-w", "1800", svg, "-o", ROOT / "docs/images/pcb-signature.png"], check=True)
