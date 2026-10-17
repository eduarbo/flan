#!/usr/bin/env python3
"""Install one checked silkscreen pattern on the routed revI boards (back side).

Run the proposal pipeline first (prepare_silkscreen_r2.py or _r3.py with --only <pattern>):
it writes the hole-free art and its checks to build/silkscreen-<proposal>/. This script
refuses stale or failing art. A board that already carries a "silkscreen-art" group is
refused unless --replace is given; then the installed group is removed first and the board
must match the routed board the art was checked against. Records validation/revI-silkscreen.json.
Then rerun check_routed_pcb.py and export_fabrication.py.
SPDX-License-Identifier: GPL-3.0-or-later
"""
from pathlib import Path
import argparse, hashlib, json, subprocess

ROOT = Path(__file__).resolve().parents[1]
HW = ROOT / "hardware/revI"
KICAD_PY = "/Applications/KiCad/KiCad.app/Contents/Frameworks/Python.framework/Versions/Current/bin/python3"
RECEIPT = ROOT / "validation/revI-silkscreen.json"
MARK = '(group "silkscreen-art"'

def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--pattern", required=True)
    ap.add_argument("--proposal", default="r3", help="r2 or r3")
    ap.add_argument("--replace", action="store_true", help="remove an installed pattern first")
    ap.add_argument("--kicad-python", default=KICAD_PY)
    a = ap.parse_args()
    build = ROOT / f"build/silkscreen-{a.proposal}"
    check = json.loads((ROOT / f"design/proposals/silkscreen-{a.proposal}/check.json").read_text())
    entry = check["patterns"][a.pattern]
    previous = json.loads(RECEIPT.read_text()) if RECEIPT.exists() else None
    strip = ROOT / "tools/silkscreen/kicad_strip_art.py"
    plan = {}
    for half in ("left", "right"):          # validate both halves before touching either board
        pcb = HW / f"flan36-{half}.kicad_pcb"
        installed = MARK in pcb.read_text()
        assert not installed or a.replace, f"{half}: silkscreen art already installed (use --replace)"
        base = pcb
        if installed:
            base = build / f"install-base-{half}.kicad_pcb"
            subprocess.run([a.kicad_python, strip, pcb, base], check=True, capture_output=True)
        assert check["sources"][half]["sha256"] == sha(base), f"{half}: art was checked against another board revision"
        e = entry[half]
        assert not e["kicad_drc"]["violations"] and not e["kicad_drc"]["unconnected"], f"{half}: DRC failed"
        assert e["keepout_overlap_mm2"] == 0 and not e["strokes_closer_than_min_gap"], f"{half}: print checks failed"
        art = build / f"kiart-{a.pattern}-{half}.json"
        assert art.is_file(), f"{half}: run the {a.proposal} pipeline with --only {a.pattern} first"
        plan[half] = (pcb, sha(pcb), sha(base), installed, art, e)
    receipt = {"schema": "flan36-silkscreen-install-1", "pattern": a.pattern, "layer": "B.SilkS",
               "proposal": f"design/proposals/silkscreen-{a.proposal}", "physical_acceptance": False, "halves": {}}
    if previous and any(p[3] for p in plan.values()):
        receipt["replaced"] = {"pattern": previous.get("pattern"), "proposal": previous.get("proposal")}
    for half, (pcb, current, base_sha, installed, art, e) in plan.items():
        if installed:
            subprocess.run([a.kicad_python, strip, pcb, pcb], check=True, capture_output=True)
            assert sha(pcb) == base_sha, f"{half}: removing the installed art did not restore the routed board"
        subprocess.run([a.kicad_python, ROOT / "tools/silkscreen/kicad_inject.py", pcb, art, pcb],
                       check=True, capture_output=True)
        receipt["halves"][half] = {"art_sha256": sha(art), "pcb_before_sha256": current, "routed_base_sha256": base_sha,
                                   "pcb_after_sha256": sha(pcb), "pattern_area_mm2": e["pattern_area_mm2"]}
    RECEIPT.write_text(json.dumps(receipt, indent=2) + "\n")
    print("installed", a.pattern, "on both halves; now run check_routed_pcb.py and export_fabrication.py")

if __name__ == "__main__":
    main()
