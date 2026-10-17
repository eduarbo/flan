#!/usr/bin/env python3
"""Compose, check and export the R1 silkscreen proposals for both routed revI boards.

Reads the committed revI PCBs, never writes them. Concept art is checked against pads,
holes, the board edge and existing legends, injected into scratch copies under
build/silkscreen-r1/, checked with KiCad DRC and read back from the saved boards.
Committed outputs go to design/proposals/silkscreen-r1/.
SPDX-License-Identifier: GPL-3.0-or-later
"""
from pathlib import Path
import argparse, hashlib, importlib, json, shutil, subprocess, sys
from collections import Counter

from shapely.geometry import MultiPolygon, Polygon, mapping
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from silkscreen.geo import Board, polys          # noqa: E402
from silkscreen.prims import dehole              # noqa: E402
from silkscreen.render import svg, path_d        # noqa: E402
from silkscreen import signature                 # noqa: E402

HW = ROOT / "hardware/revI"
OUT = ROOT / "design/proposals/silkscreen-r1"
BUILD = ROOT / "build/silkscreen-r1"
HELPERS = ROOT / "tools/silkscreen"
CONCEPTS = ["caramelo", "contorno", "barrido"]
HALVES = {"right": (lambda x: x), "left": (lambda x: 160 - x)}   # revI outlines mirror about x = 80 mm
KICAD_PY = "/Applications/KiCad/KiCad.app/Contents/Frameworks/Python.framework/Versions/Current/bin/python3"
KICAD_CLI = "/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli"
CLEAR = {"pad_clear": 0.20, "hole_clear": 0.30, "edge_clear": 0.40}
SILK_CLEAR = 0.15
MIN_STROKE = 0.17   # art strokes (not KiCad text) must survive a morphological opening at this width
MIN_GAP = 0.19      # separate strokes must not merge under a closing at this width

def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()

def kpy(args, kicad_py):
    return subprocess.run([kicad_py, *map(str, args)], check=True, capture_output=True, text=True).stdout

def text_polys(specs, kicad_py):
    src, dst = BUILD / "texts.json", BUILD / "texts-out.json"
    src.write_text(json.dumps(specs))
    kpy([HELPERS / "kicad_text.py", src, dst], kicad_py)
    return unary_union([polys(v) for v in json.loads(dst.read_text()).values()])

def check(board, side, art):
    keep = board.keepout(side, **CLEAR)
    silk = board.side[side]["silk"].buffer(SILK_CLEAR)
    return {
        "keepout_overlap_mm2": round(art.intersection(keep).area, 4),
        "existing_silk_overlap_mm2": round(art.intersection(silk).area, 4),
        "outside_edge_clearance_mm2": round(art.difference(board.outline.buffer(-CLEAR["edge_clear"])).area, 4),
        "min_distance_to_keepout_mm": round(art.distance(keep), 3),
        "art_area_mm2": round(art.area, 2),
    }

def min_counter(geom):
    """Smallest inscribed diameter of any enclosed counter (letter holes, logo interior)."""
    best = None
    for p in getattr(geom, "geoms", [geom]):
        for r in p.interiors:
            h, lo, hi = Polygon(r), 0.0, 2.0
            for _ in range(24):
                m = (lo + hi) / 2
                lo, hi = (lo, m) if h.buffer(-m).is_empty else (m, hi)
            best = 2 * lo if best is None else min(best, 2 * lo)
    return round(best, 3)

def silk_svg(board, side, art):
    """1:1 artwork in board coordinates (mm), as seen from the top; import with KiCad Import Graphics."""
    minx, miny, maxx, maxy = board.outline.bounds
    w, h = maxx - minx, maxy - miny
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w:.4f}mm" height="{h:.4f}mm" viewBox="{minx:.4f} {miny:.4f} {w:.4f} {h:.4f}">\n'
            f'<title>Flan36 revI {board.name} {side}.SilkS — silkscreen R1</title>\n'
            f'<path d="{path_d(board.outline)}" fill="none" stroke="#999" stroke-width="0.05"/>\n'
            f'<path d="{path_d(art)}" fill="#000" fill-rule="evenodd"/>\n</svg>\n')

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--kicad-python", default=KICAD_PY)
    ap.add_argument("--cli", default=KICAD_CLI)
    ap.add_argument("--render3d", action="store_true", help="also ray-trace the 3D views (slow)")
    a = ap.parse_args()
    BUILD.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    boards = BUILD / "boards"
    boards.mkdir(exist_ok=True)
    for name in ("fp-lib-table", "sym-lib-table", "libraries", "models"):   # same project-relative libraries
        link = boards / name
        if not link.exists():
            link.symlink_to(HW / name)

    sources = {}
    for half in HALVES:
        pcb = HW / f"flan36-{half}.kicad_pcb"
        sources[half] = {"pcb": str(pcb.relative_to(ROOT)), "sha256": sha(pcb)}
        kpy([HELPERS / "kicad_extract.py", pcb, BUILD / f"geo-{half}.json"], a.kicad_python)

    report = {"schema": "flan36-silkscreen-r1-1", "sources": sources,
              "rules": {**CLEAR, "existing_silk_clear": SILK_CLEAR, "min_art_stroke_mm": MIN_STROKE, "min_gap_mm": MIN_GAP,
                        "text_height_mm": 1.0, "text_stroke_mm": 0.15},
              "concepts": {}}
    for c in CONCEPTS:
        mod = importlib.import_module(f"silkscreen.{c}")
        for half, mx in HALVES.items():
            b = Board(half, BUILD)
            front = mod.build(b, mx)
            back, specs = signature.plate(half)
            back_full = back.union(text_polys(specs, a.kicad_python))
            art = {"F": front, "B": back_full}
            entry = {s: check(b, s, art[s]) for s in "FB"}
            for s, shapes in (("F", front), ("B", back)):
                entry[s]["thin_stroke_mm2"] = round(shapes.area - shapes.buffer(-MIN_STROKE / 2, quad_segs=16).buffer(MIN_STROKE / 2, quad_segs=16).area, 4)
            # traces: separate strokes must not merge; letters: counters must stay open
            entry["F"]["narrow_gap_mm2"] = round(front.buffer(MIN_GAP / 2, quad_segs=16).buffer(-MIN_GAP / 2, quad_segs=16).area - front.area, 4)
            entry["B"]["min_counter_mm"] = min_counter(back)
            (OUT / f"{c}-{half}-F.svg").write_text(silk_svg(b, "F", art["F"]))
            if c == CONCEPTS[0]:                  # the back plate is shared by every concept
                (OUT / f"plate-{half}-B.svg").write_text(silk_svg(b, "B", art["B"]))
            # preview of the bare board as fabricated (green mask, white legend)
            for s, tag in (("F", "front"), ("B", "back")):
                if s == "B" and c != CONCEPTS[0]:
                    continue
                name = f"{c}-{half}-{tag}" if s == "F" else f"plate-{half}-back"
                tmp = BUILD / f"{name}.svg"
                tmp.write_text(svg(b, s, art[s]))
                subprocess.run(["rsvg-convert", "-w", "1600", tmp, "-o", OUT / f"{name}.png"], check=True)
            # scratch board: shapes as hole-free polygons, credits as native text
            kiart = BUILD / f"kiart-{c}-{half}.json"
            kiart.write_text(json.dumps({"F": mapping(MultiPolygon(dehole(front))),
                                         "B": mapping(MultiPolygon(dehole(back))), "texts": specs}))
            dst = boards / f"{c}-{half}.kicad_pcb"
            shutil.copy(HW / f"flan36-{half}.kicad_pro", dst.with_suffix(".kicad_pro"))
            kpy([HELPERS / "kicad_inject.py", HW / f"flan36-{half}.kicad_pcb", kiart, dst], a.kicad_python)
            drc = boards / f"drc-{c}-{half}.json"
            subprocess.run([a.cli, "pcb", "drc", "--severity-all", "--format", "json", "-o", drc, dst],
                           check=True, capture_output=True)
            d = json.loads(drc.read_text())
            entry["kicad_drc"] = {"violations": dict(Counter(v["type"] for v in d["violations"])),
                                  "unconnected": len(d["unconnected_items"])}
            # read the saved board back: shapes must survive exactly
            geo = boards / f"geo-{c}-{half}.json"
            kpy([HELPERS / "kicad_extract.py", dst, geo], a.kicad_python)
            g = json.loads(geo.read_text())
            entry["readback_shape_diff_mm2"] = {
                s: round(polys(g["sides"][s]["silk"]).symmetric_difference(
                    b.side[s]["silk"].union(front if s == "F" else back_full)).area, 4) for s in "FB"}
            entry["svg_sha256"] = {"F": sha(OUT / f"{c}-{half}-F.svg"), "B": sha(OUT / f"plate-{half}-B.svg")}
            report["concepts"][f"{c}/{half}"] = entry
            print(c, half, json.dumps({k: v for k, v in entry.items() if k != "svg_sha256"}))

    if a.render3d:
        for c in CONCEPTS:                          # right half, switches and controller fitted
            for half in ("right",):
                pcb = boards / f"{c}-{half}.kicad_pcb"
                out = OUT / f"{c}-{half}-3d.png"
                subprocess.run([a.cli, "pcb", "render", "--side", "top", "-w", "1200", "-h", "970",
                                "--quality", "high", "--background", "transparent", "-o", out, pcb],
                               check=True, capture_output=True)
    (OUT / "check.json").write_text(json.dumps(report, indent=1) + "\n")
    failed = [k for k, v in report["concepts"].items()
              if any(v[s][m] > 0 for s in "FB" for m in ("keepout_overlap_mm2", "existing_silk_overlap_mm2", "outside_edge_clearance_mm2"))
              or any(v[s]["thin_stroke_mm2"] > 0.001 for s in "FB")    # tolerance: buffering round-off
              or v["F"]["narrow_gap_mm2"] > 0.1                         # tolerance: fillet-corner slivers
              or v["B"]["min_counter_mm"] < 0.4
              or v["kicad_drc"]["violations"] or v["kicad_drc"]["unconnected"]
              or v["readback_shape_diff_mm2"]["F"] > 0.01
              or v["readback_shape_diff_mm2"]["B"] > 0.5]       # B adds KiCad's own re-rendering of text
    if failed:
        raise SystemExit(f"checks failed: {failed}")
    print("all concepts pass")

if __name__ == "__main__":
    main()
