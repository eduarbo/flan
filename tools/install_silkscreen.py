#!/usr/bin/env python3
"""Install one checked R2 silkscreen pattern on the routed revI boards (back side).

Run tools/prepare_silkscreen_r2.py --only <pattern> first: it writes the hole-free art and
its checks to build/silkscreen-r2/. This script refuses stale or failing art, refuses a
board that already carries a "silkscreen-art" group, injects the art in place and records
validation/revI-silkscreen.json. Then rerun check_routed_pcb.py and export_fabrication.py.
SPDX-License-Identifier: GPL-3.0-or-later
"""
from pathlib import Path
import argparse, hashlib, json, subprocess

ROOT = Path(__file__).resolve().parents[1]
HW = ROOT / "hardware/revI"
BUILD = ROOT / "build/silkscreen-r2"
CHECK = ROOT / "design/proposals/silkscreen-r2/check.json"
KICAD_PY = "/Applications/KiCad/KiCad.app/Contents/Frameworks/Python.framework/Versions/Current/bin/python3"

def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--pattern", required=True)
    ap.add_argument("--kicad-python", default=KICAD_PY)
    a = ap.parse_args()
    check = json.loads(CHECK.read_text())
    entry = check["patterns"][a.pattern]
    receipt = {"schema": "flan36-silkscreen-install-1", "pattern": a.pattern, "layer": "B.SilkS",
               "proposal": "design/proposals/silkscreen-r2", "physical_acceptance": False, "halves": {}}
    plan = {}
    for half in ("left", "right"):          # validate both halves before touching either board
        pcb = HW / f"flan36-{half}.kicad_pcb"
        before = sha(pcb)
        assert check["sources"][half]["sha256"] == before, f"{half}: art was checked against another board revision"
        e = entry[half]
        assert not e["kicad_drc"]["violations"] and not e["kicad_drc"]["unconnected"], f"{half}: DRC failed"
        assert e["keepout_overlap_mm2"] == 0 and not e["strokes_closer_than_min_gap"], f"{half}: print checks failed"
        assert '(group "silkscreen-art"' not in pcb.read_text(), f"{half}: silkscreen art already installed"
        art = BUILD / f"kiart-{a.pattern}-{half}.json"
        assert art.is_file(), f"{half}: run prepare_silkscreen_r2.py --only {a.pattern} first"
        plan[half] = (pcb, before, art, e)
    for half, (pcb, before, art, e) in plan.items():
        subprocess.run([a.kicad_python, ROOT / "tools/silkscreen/kicad_inject.py", pcb, art, pcb],
                       check=True, capture_output=True)
        receipt["halves"][half] = {"art_sha256": sha(art), "pcb_before_sha256": before, "pcb_after_sha256": sha(pcb),
                                   "pattern_area_mm2": e["pattern_area_mm2"]}
    (ROOT / "validation/revI-silkscreen.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print("installed", a.pattern, "on both halves; now run check_routed_pcb.py and export_fabrication.py")

if __name__ == "__main__":
    main()
