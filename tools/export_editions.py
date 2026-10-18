#!/usr/bin/env python3
"""Export one fabrication package per back-silkscreen edition of the routed revI boards.

Each edition is the canonical board (routed, with the Flan signature) plus one all-over
pattern on B.SilkS, composed as one design across both halves and kept clear of the
signature: each pattern stops along the signature's own contour and calms down around it
(Canvas.quiet), so the plate sits in the pattern instead of a cut-out box. For every edition and half: print checks, KiCad DRC with schematic parity, a
saved-board readback, Gerber/drill export with the same options as export_fabrication.py,
and a byte comparison proving that every file except B_Silkscreen matches the base package
(export dates aside). Packages go to hardware/revI/fabrication/editions/; the receipt to
validation/revI-editions.json; previews to docs/images/editions/.
Run export_fabrication.py first.

--variant flan42 (or flan46, flan54) does the same for hardware/<variant>: packages in its
fabrication/editions/, the receipt validation/<variant>-editions.json, smaller palette previews
in docs/images/editions/<variant>/. Patterns follow each board's own outline and keys.
SPDX-License-Identifier: GPL-3.0-or-later
"""
from pathlib import Path
import argparse, hashlib, json, re, shutil, subprocess, sys, time, zipfile
from collections import Counter

from shapely.geometry import MultiPolygon, box, mapping
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from silkscreen.canvas import Canvas, QUIET_REACH          # noqa: E402
from silkscreen.geo import polys                           # noqa: E402
from silkscreen.prims import dehole                        # noqa: E402
from silkscreen import patterns                            # noqa: E402
from silkscreen.sheet import sheet                         # noqa: E402
from prepare_silkscreen_r1 import KICAD_PY, KICAD_CLI, check, kpy, sha        # noqa: E402
from prepare_silkscreen_r2 import components_merge, MIN_STROKE, MIN_GAP       # noqa: E402
from prepare_silkscreen_r3 import REGISTRY                                    # noqa: E402

EDITIONS = {"asanoha": "Asanoha", "kikko": "Kikkō", "sayagata": "Sayagata",
            "seigaiha": "Seigaiha", "meandro": "Meandro", "vias": "Vías"}
HW = ROOT / "hardware/revI"
BUILD = ROOT / "build/editions"
OUT = HW / "fabrication/editions"
PREVIEWS = ROOT / "docs/images/editions"
HELPERS = ROOT / "tools/silkscreen"
SIG_CLOSE, SIG_HALO = 0.9, 0.8      # mm: the signature's ink closed into one silhouette, then haloed
DATE = re.compile(rb"CreationDate|^G04 Created|^; DRILL file|SVG Image created", re.M)

def undated(path):
    return b"\n".join(l for l in path.read_bytes().split(b"\n") if not DATE.search(l))

def export(cli, pcb, out):
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    subprocess.run([cli, "pcb", "export", "gerbers", "-l", "F.Cu,B.Cu,F.Mask,B.Mask,F.Silkscreen,B.Silkscreen,Edge.Cuts",
                    "--subtract-soldermask", "-o", str(out) + "/", str(pcb)], check=True, capture_output=True)
    subprocess.run([cli, "pcb", "export", "drill", "--format", "excellon", "--excellon-units", "mm", "--excellon-separate-th",
                    "--generate-map", "--map-format", "svg", "-o", str(out) + "/", str(pcb)], check=True, capture_output=True)

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--kicad-python", default=KICAD_PY)
    ap.add_argument("--cli", default=KICAD_CLI)
    ap.add_argument("--only")
    ap.add_argument("--variant", default="flan36", help="flan36 uses hardware/revI; flan42, flan46 or flan54 hardware/<variant>")
    a = ap.parse_args()
    global HW, BUILD, OUT, PREVIEWS
    family = a.variant != "flan36"
    rev = a.variant if family else "revI"
    if family:
        HW = ROOT / "hardware" / a.variant
        BUILD = ROOT / "build" / f"editions-{a.variant}"
        OUT = HW / "fabrication/editions"
        PREVIEWS = ROOT / "docs/images/editions" / a.variant
    names = a.only.split(",") if a.only else list(EDITIONS)
    routing = json.loads((ROOT / f"validation/{rev}-routing.json").read_text())["halves"]
    fab = json.loads((ROOT / f"validation/{rev}-fabrication.json").read_text())["halves"]
    signature = json.loads((ROOT / f"validation/{rev}-signature.json").read_text())["halves"]
    for half in ("left", "right"):
        pcb = HW / f"{a.variant}-{half}.kicad_pcb"
        assert sha(pcb) == routing[half]["pcb_sha256"] == fab[half]["manifest"]["source"]["pcb_sha256"] \
            == signature[half]["pcb_after_sha256"], f"{half}: stale routing, fabrication or signature evidence"
    for d in (BUILD, OUT, PREVIEWS):
        d.mkdir(parents=True, exist_ok=True)
    for half in ("left", "right"):
        kpy([HELPERS / "kicad_extract.py", HW / f"{a.variant}-{half}.kicad_pcb", BUILD / f"geo-{half}.json"], a.kicad_python)
    cv = Canvas(BUILD)
    carto = {}
    for h, b in cv.boards.items():
        ink = b.side["B"]["silk"].intersection(unary_union([box(*z) for z in signature[h]["zones"]]).buffer(0.6))
        carto[h] = ink.buffer(SIG_CLOSE + SIG_HALO, quad_segs=8).buffer(-SIG_CLOSE, quad_segs=8)
    cv.quiet(carto)
    receipt_path = ROOT / f"validation/{rev}-editions.json"
    receipt = json.loads(receipt_path.read_text()) if receipt_path.exists() and a.only else {}
    receipt.update({"schema": "flan-variant-editions-1" if family else "flan36-editions-1", "physical_acceptance": False,
                    "base": {h: {"pcb_sha256": routing[h]["pcb_sha256"], "package_sha256": fab[h]["sha256"]} for h in fab},
                    "rules": {"min_art_stroke_mm": MIN_STROKE, "min_gap_mm": MIN_GAP,
                              "signature_clearance": {"contour_close_mm": SIG_CLOSE, "halo_mm": SIG_HALO, "quiet_reach_mm": QUIET_REACH}}})
    receipt.setdefault("editions", {})
    for ed in names:
        t0 = time.time()
        parts = patterns.compose(cv, REGISTRY[ed](cv), cartouches=carto)
        entry = {"title": EDITIONS[ed], "halves": {}}
        work = BUILD / ed
        work.mkdir(exist_ok=True)
        for name in ("fp-lib-table", "sym-lib-table") + (() if family else ("libraries", "models")):
            if not (work / name).exists():
                (work / name).symlink_to(HW / name)
        if family and not (BUILD / "revI").exists():   # the variant tables point at ${KIPRJMOD}/../revI/
            (BUILD / "revI").symlink_to(ROOT / "hardware/revI", target_is_directory=True)
        for half, b in cv.boards.items():
            g = parts[half]
            e = check(b, "B", g)
            lost = g.difference(g.buffer(-MIN_STROKE / 2, quad_segs=6).buffer(MIN_STROKE / 2, quad_segs=6))
            e["largest_thin_piece_mm2"] = round(max([q.area for q in getattr(lost, "geoms", [lost])] or [0]), 4)
            e["strokes_closer_than_min_gap"] = components_merge(g, MIN_GAP)
            stem = f"{a.variant}-{half}"
            kiart = work / f"art-{half}.json"
            kiart.write_text(json.dumps({"F": mapping(MultiPolygon()), "B": mapping(MultiPolygon(dehole(g))), "texts": []}))
            pcb = work / f"{stem}.kicad_pcb"
            for suffix in (".kicad_pro", ".kicad_sch"):
                shutil.copy(HW / (stem + suffix), work / (stem + suffix))
            kpy([HELPERS / "kicad_inject.py", HW / f"{stem}.kicad_pcb", kiart, pcb], a.kicad_python)
            drc = work / f"drc-{half}.json"
            subprocess.run([a.cli, "pcb", "drc", "--format", "json", "--severity-all", "--schematic-parity",
                            "--all-track-errors", "-o", drc, pcb], check=True, capture_output=True)
            d = json.loads(drc.read_text())
            e["kicad_drc"] = {"violations": dict(Counter(v["type"] for v in d["violations"])),
                              "unconnected": len(d["unconnected_items"]), "schematic_parity": len(d["schematic_parity"])}
            geo = work / f"geo-{half}.json"
            kpy([HELPERS / "kicad_extract.py", pcb, geo], a.kicad_python)
            back = polys(json.loads(geo.read_text())["sides"]["B"]["silk"])
            e["readback_diff_mm2"] = round(back.symmetric_difference(b.side["B"]["silk"].union(g)).area, 4)
            gerb = work / half
            export(a.cli, pcb, gerb)
            base_dir = ROOT / ("build/fabrication-" + a.variant if family else "build/fabrication") / half
            names_e = sorted(p.name for p in gerb.iterdir())
            names_b = sorted(p.name for p in base_dir.iterdir() if p.name not in ("manifest.json", "README.txt"))
            assert names_e == names_b, (ed, half, "file set differs from the base package")
            changed = [n for n in names_e if undated(gerb / n) != undated(base_dir / n)]
            e["files_changed_vs_base"] = changed
            ok = (not e["keepout_overlap_mm2"] and not e["existing_silk_overlap_mm2"] and not e["outside_edge_clearance_mm2"]
                  and e["largest_thin_piece_mm2"] <= 0.005 and not e["strokes_closer_than_min_gap"]
                  and not e["kicad_drc"]["violations"] and not e["kicad_drc"]["unconnected"] and not e["kicad_drc"]["schematic_parity"]
                  and e["readback_diff_mm2"] < 0.01 and changed == [f"{stem}-B_Silkscreen.gbo"])
            assert ok, (ed, half, e)
            files = {p.name: sha(p) for p in sorted(gerb.iterdir())}
            manifest = {"side": half, "edition": ed, "title": EDITIONS[ed], "source_pcb_sha256": sha(HW / f"{stem}.kicad_pcb"),
                        "edition_pcb_sha256": sha(pcb), "files": files, "physical_acceptance": False,
                        "only_layer_changed_vs_base": "B_Silkscreen"}
            (gerb / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
            title = f"{a.variant.upper()} prototype candidate (revI electronics)" if family else "FLAN36 revI prototype candidate"
            (gerb / "README.txt").write_text(f"{title} — {half} · {EDITIONS[ed]} edition\n"
                "Same copper, mask, outline and drills as the base package; only the back silkscreen differs.\n"
                "Two copper layers, 1.6 mm FR4, nominal 1 oz copper. Inspect Gerber and drill previews.\n"
                "Digital DRC/ERC/netlist checks passed. This is not a physically qualified build kit.\n"
                "Build, BOM and hardware acceptance: https://github.com/eduarbo/flan/blob/main/docs/build.md\n")
            package = OUT / (f"{stem}-{ed}.zip" if family else f"{stem}-revI-{ed}.zip")
            with zipfile.ZipFile(package, "w", zipfile.ZIP_DEFLATED) as z:
                for f in sorted(gerb.iterdir()):
                    z.write(f, f.name)
            with zipfile.ZipFile(package) as z:
                assert z.testzip() is None
                for f, digest in files.items():
                    assert hashlib.sha256(z.read(f)).hexdigest() == digest
            e["package"] = str(package.relative_to(ROOT))
            e["package_sha256"] = sha(package)
            entry["halves"][half] = e
        svg = BUILD / f"{ed}.svg"
        svg.write_text(sheet(cv, parts, "navy", bg="#f3f2ec"))
        if family:   # a smaller palette image; revI keeps its full-colour 1600 px previews
            subprocess.run(["rsvg-convert", "-w", "1200", svg, "-o", BUILD / f"{ed}.png"], check=True)
            subprocess.run(["magick", BUILD / f"{ed}.png", "-colors", "16", "-strip", f"PNG8:{PREVIEWS / f'{ed}.png'}"], check=True)
        else:
            subprocess.run(["rsvg-convert", "-w", "1600", svg, "-o", PREVIEWS / f"{ed}.png"], check=True)
        entry["preview"] = str((PREVIEWS / f"{ed}.png").relative_to(ROOT))
        receipt["editions"][ed] = entry
        print(ed, "%.0fs" % (time.time() - t0), json.dumps({h: {k: e[k] for k in ("kicad_drc", "readback_diff_mm2", "files_changed_vs_base")}
                                                            for h, e in entry["halves"].items()}))
    receipt_path.write_text(json.dumps(receipt, indent=2, ensure_ascii=False) + "\n")
    print("PASS:", len(receipt["editions"]), "editions × 2 halves; only B_Silkscreen differs from the base package")

if __name__ == "__main__":
    main()
