#!/usr/bin/env python3
"""Compose, check and export the R2 all-over silkscreen patterns (back side, both revI halves).

Each pattern is drawn once on a shared canvas — both halves seen from below, controller sides
adjacent — so the composition runs continuously across the pair. It is clipped around pads,
holes, legends and part bodies, gets the Flan36 plate in a cleared cartouche, is injected into
scratch copies of the routed boards under build/silkscreen-r2/, checked with KiCad DRC and read
back. The committed revI PCBs are never written. Previews go to design/proposals/silkscreen-r2/.
SPDX-License-Identifier: GPL-3.0-or-later
"""
from pathlib import Path
import argparse, json, shutil, subprocess, sys, time
from collections import Counter

from shapely.geometry import MultiPolygon, box, mapping
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from silkscreen.canvas import Canvas                      # noqa: E402
from silkscreen.geo import polys                          # noqa: E402
from silkscreen.prims import dehole                       # noqa: E402
from silkscreen import patterns, signature                # noqa: E402
from silkscreen.sheet import sheet, PALETTES              # noqa: E402
from prepare_silkscreen_r1 import (KICAD_PY, KICAD_CLI, CLEAR, SILK_CLEAR, check, min_counter,   # noqa: E402
                                   sha, kpy)

HW = ROOT / "hardware/revI"
OUT = ROOT / "design/proposals/silkscreen-r2"
BUILD = ROOT / "build/silkscreen-r2"
HELPERS = ROOT / "tools/silkscreen"
ORDER = ["campo", "aislamiento", "ruteo", "meandro", "vias", "bus", "senal"]
MIN_STROKE = 0.17     # nothing thinner survives a morphological opening
MIN_GAP = 0.24        # distinct strokes never come closer than this

def text_polys(specs, kicad_py, tag):
    src, dst = BUILD / f"texts-{tag}.json", BUILD / f"texts-{tag}-out.json"
    src.write_text(json.dumps(specs))
    kpy([HELPERS / "kicad_text.py", src, dst], kicad_py)
    return unary_union([polys(v) for v in json.loads(dst.read_text()).values()])

def components_merge(geom, gap):
    """True when two separate strokes sit closer than gap (their halos fuse)."""
    parts = list(getattr(geom, "geoms", [geom]))
    grown = unary_union([p.buffer(gap / 2, quad_segs=4) for p in parts])
    return len(parts) != len(getattr(grown, "geoms", [grown]))

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--kicad-python", default=KICAD_PY)
    ap.add_argument("--cli", default=KICAD_CLI)
    ap.add_argument("--only", help="comma-separated pattern names")
    ap.add_argument("--render3d", action="store_true", help="ray-trace each pattern from below (slow)")
    a = ap.parse_args()
    names = a.only.split(",") if a.only else ORDER
    BUILD.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    boards = BUILD / "boards"
    boards.mkdir(exist_ok=True)
    for name in ("fp-lib-table", "sym-lib-table", "libraries", "models"):
        if not (boards / name).exists():
            (boards / name).symlink_to(HW / name)

    sources = {}
    for half in ("right", "left"):
        pcb = HW / f"flan36-{half}.kicad_pcb"
        sources[half] = {"pcb": str(pcb.relative_to(ROOT)), "sha256": sha(pcb)}
        kpy([HELPERS / "kicad_extract.py", pcb, BUILD / f"geo-{half}.json"], a.kicad_python)
    cv = Canvas(BUILD)

    # the maker's plate sits in a cleared cartouche on each half
    plate, plate_full, specs, carto = {}, {}, {}, {}
    for half in cv.boards:
        shapes, sp = signature.plate(half)
        full = shapes.union(text_polys(sp, a.kicad_python, half))
        x0, y0, x1, y1 = full.bounds
        plate[half], plate_full[half], specs[half] = shapes, full, sp
        carto[half] = box(x0, y0, x1, y1).buffer(1.3, join_style="round", quad_segs=8)

    report_path = OUT / "check.json"
    report = json.loads(report_path.read_text()) if report_path.exists() and a.only else {}
    report.update({"schema": "flan36-silkscreen-r2-1", "sources": sources,
                   "rules": {**CLEAR, "existing_silk_clear": SILK_CLEAR, "min_art_stroke_mm": MIN_STROKE,
                             "min_gap_mm": MIN_GAP, "pattern_halo_mm": {"pads": 0.30, "holes": 0.35, "legends": 0.30, "edge": 0.55}}})
    report.setdefault("patterns", {})
    for n in names:
        t0 = time.time()
        art = patterns.PATTERNS[n](cv)
        parts = patterns.compose(cv, art, cartouches=carto)
        entry = {}
        for half, b in cv.boards.items():
            g = parts[half]
            full = g.union(plate_full[half])
            e = check(b, "B", full)
            e["pattern_area_mm2"] = round(g.area, 1)
            lost = g.difference(g.buffer(-MIN_STROKE / 2, quad_segs=6).buffer(MIN_STROKE / 2, quad_segs=6))
            e["largest_thin_piece_mm2"] = round(max([q.area for q in getattr(lost, "geoms", [lost])] or [0]), 4)
            e["strokes_closer_than_min_gap"] = components_merge(g, MIN_GAP)
            e["plate_min_counter_mm"] = min_counter(plate[half])
            # scratch board: hole-free polygons, plate credits as native KiCad text
            kiart = BUILD / f"kiart-{n}-{half}.json"
            kiart.write_text(json.dumps({"F": mapping(MultiPolygon()), "B": mapping(MultiPolygon(dehole(g.union(plate[half])))),
                                         "texts": specs[half]}))
            dst = boards / f"{n}-{half}.kicad_pcb"
            shutil.copy(HW / f"flan36-{half}.kicad_pro", dst.with_suffix(".kicad_pro"))
            kpy([HELPERS / "kicad_inject.py", HW / f"flan36-{half}.kicad_pcb", kiart, dst], a.kicad_python)
            drc = boards / f"drc-{n}-{half}.json"
            subprocess.run([a.cli, "pcb", "drc", "--severity-all", "--format", "json", "-o", drc, dst],
                           check=True, capture_output=True)
            d = json.loads(drc.read_text())
            e["kicad_drc"] = {"violations": dict(Counter(v["type"] for v in d["violations"])),
                              "unconnected": len(d["unconnected_items"])}
            geo = boards / f"geo-{n}-{half}.json"
            kpy([HELPERS / "kicad_extract.py", dst, geo], a.kicad_python)
            back = polys(json.loads(geo.read_text())["sides"]["B"]["silk"])
            e["readback_diff_mm2"] = round(back.symmetric_difference(b.side["B"]["silk"].union(full)).area, 4)
            entry[half] = e
        for pal in PALETTES:
            svg = BUILD / f"{n}-{pal}.svg"
            svg.write_text(sheet(cv, parts, pal, plate=plate_full))
            subprocess.run(["rsvg-convert", "-w", "2400", svg, "-o", BUILD / f"{n}-{pal}.png"], check=True)
        shutil.copy(BUILD / f"{n}-navy.png", OUT / f"{n}.png")
        if a.render3d:
            for half in cv.boards:
                bare = boards / f"{n}-{half}-bare.kicad_pcb"
                kpy([HELPERS / "kicad_strip.py", boards / f"{n}-{half}.kicad_pcb", bare], a.kicad_python)
                shutil.copy(HW / f"flan36-{half}.kicad_pro", bare.with_suffix(".kicad_pro"))
                subprocess.run([a.cli, "pcb", "render", "--side", "bottom", "-w", "1500", "-h", "1220", "--quality", "high",
                                "--background", "transparent", "-o", BUILD / f"{n}-{half}-3d.png", bare],
                               check=True, capture_output=True)
        report["patterns"][n] = entry
        print(n, "%.0fs" % (time.time() - t0), json.dumps({h: {k: v for k, v in e.items() if k in
              ("pattern_area_mm2", "keepout_overlap_mm2", "largest_thin_piece_mm2", "strokes_closer_than_min_gap", "kicad_drc", "readback_diff_mm2")}
              for h, e in entry.items()}))
    report_path.write_text(json.dumps(report, indent=1) + "\n")
    bad = [f"{n}/{h}" for n, v in report["patterns"].items() for h, e in v.items()
           if e["keepout_overlap_mm2"] > 0 or e["existing_silk_overlap_mm2"] > 0 or e["outside_edge_clearance_mm2"] > 0
           or e["largest_thin_piece_mm2"] > 0.005 or e["strokes_closer_than_min_gap"] or e["kicad_drc"]["violations"]
           or e["kicad_drc"]["unconnected"] or e["readback_diff_mm2"] > 0.5 or e["plate_min_counter_mm"] < 0.4]
    if bad:
        raise SystemExit(f"checks failed: {bad}")
    print("all patterns pass")

if __name__ == "__main__":
    main()
