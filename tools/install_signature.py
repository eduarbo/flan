#!/usr/bin/env python3
"""Install the Flan signature on the back of both routed revI boards.

Removes any installed "silkscreen-art" (a back pattern) and an earlier "flan-signature",
checks that what remains is the routed board byte for byte, places the lockup, rule, edition
lines and maker's URL (tools/silkscreen/signature.flan_plate), checks them against pads,
holes, edges and legends, and records validation/revI-signature.json. Patterns become
per-edition packages (tools/export_editions.py); the canonical boards carry only the
signature. Then rerun check_routed_pcb.py and export_fabrication.py.
SPDX-License-Identifier: GPL-3.0-or-later
"""
from pathlib import Path
import argparse, json, sys

from shapely.geometry import MultiPolygon, mapping
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from silkscreen.geo import Board, polys                      # noqa: E402
from silkscreen.prims import dehole                          # noqa: E402
from silkscreen import signature                             # noqa: E402
from branding.lockup import FONT, font_file                  # noqa: E402
from prepare_silkscreen_r1 import KICAD_PY, check, min_counter, kpy, sha   # noqa: E402

HW = ROOT / "hardware/revI"
BUILD = ROOT / "build/signature"
HELPERS = ROOT / "tools/silkscreen"
# routed boards (tools/check_routed_pcb.py baseline lineage) before any back-silkscreen art
ROUTED = {"left": "38c58eb3590e2dbb3abae645d75c264904683427476dbf514bda69849b4431a8",
          "right": "362f58bad47711258a11dfa2d7dcf165b7345b12d5144d3c7fa9b998b0288f43"}
MIN_STROKE = 0.17

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--kicad-python", default=KICAD_PY)
    a = ap.parse_args()
    font = font_file(ROOT)
    assert font.is_file() and sha(font) == FONT["sha256"], f"pinned font missing: fetch {FONT['file']} from {FONT['source']} into build/fonts/"
    BUILD.mkdir(parents=True, exist_ok=True)
    plan, receipt = {}, {"schema": "flan36-signature-1", "layer": "B.SilkS", "group": "flan-signature",
                         "font": FONT, "physical_acceptance": False, "halves": {}}
    for half in ("left", "right"):                 # validate both halves before writing either
        pcb = HW / f"flan36-{half}.kicad_pcb"
        base = BUILD / f"base-{half}.kicad_pcb"
        kpy([HELPERS / "kicad_strip_art.py", pcb, base, "silkscreen-art", "flan-signature"], a.kicad_python)
        assert sha(base) == ROUTED[half], f"{half}: removing installed art did not restore the routed board"
        kpy([HELPERS / "kicad_extract.py", base, BUILD / f"geo-{half}.json"], a.kicad_python)
        b = Board(half, BUILD)
        shapes, texts, zones = signature.flan_plate(half, font)
        spec = BUILD / f"texts-{half}.json"
        spec.write_text(json.dumps(texts))
        kpy([HELPERS / "kicad_text.py", spec, BUILD / f"texts-{half}-out.json"], a.kicad_python)
        text_g = unary_union([polys(v) for v in json.loads((BUILD / f"texts-{half}-out.json").read_text()).values()])
        full = shapes.union(text_g)
        e = check(b, "B", full)
        lost = shapes.difference(shapes.buffer(-MIN_STROKE / 2, quad_segs=8).buffer(MIN_STROKE / 2, quad_segs=8))
        e["largest_thin_piece_mm2"] = round(max([q.area for q in getattr(lost, "geoms", [lost])] or [0]), 4)
        e["min_counter_mm"] = min_counter(shapes)
        bad = e["keepout_overlap_mm2"] or e["existing_silk_overlap_mm2"] or e["outside_edge_clearance_mm2"] \
            or e["largest_thin_piece_mm2"] > 0.01 or e["min_counter_mm"] < 0.25
        assert not bad, f"{half}: signature fails print checks {e}"
        art = BUILD / f"art-{half}.json"
        art.write_text(json.dumps({"F": mapping(MultiPolygon()), "B": mapping(MultiPolygon(dehole(shapes))), "texts": texts}))
        plan[half] = (pcb, sha(pcb), art, e, [list(z.bounds) for z in zones])
    for half, (pcb, before, art, e, zones) in plan.items():
        base = BUILD / f"base-{half}.kicad_pcb"
        kpy([HELPERS / "kicad_inject.py", base, art, pcb, "flan-signature"], a.kicad_python)
        receipt["halves"][half] = {"pcb_before_sha256": before, "routed_base_sha256": ROUTED[half],
                                   "pcb_after_sha256": sha(pcb), "art_sha256": sha(art), "checks": e, "zones": zones}
    (ROOT / "validation/revI-signature.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print("signature installed on both halves:", json.dumps({h: v["checks"] for h, v in receipt["halves"].items()}))

if __name__ == "__main__":
    main()
