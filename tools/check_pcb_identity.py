#!/usr/bin/env python3
"""Verify source identities and that branding changes only back silk in all packages.

Run after install_signature, check_routed_pcb, export_fabrication and export_editions
for all four sizes. The baseline is the last commit before the URL addition.
SPDX-License-Identifier: GPL-3.0-or-later
"""
import hashlib
import io
import json
from pathlib import Path
import re
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
BASELINE = "0c49df6"
DATE = re.compile(rb"CreationDate|^G04 Created|^; DRILL file|SVG Image created", re.M)


def undated(data):
    return b"\n".join(line for line in data.split(b"\n") if not DATE.search(line))


def main():
    options = json.loads((ROOT / "design/pcb-options.json").read_text())
    sources, packages = {}, {}
    for variant in ("flan36", "flan42", "flan46", "flan54"):
        directory = "revI" if variant == "flan36" else variant
        signature = json.loads((ROOT / f"validation/{directory}-signature.json").read_text())
        for side in ("left", "right"):
            path = ROOT / f"hardware/{directory}/{variant}-{side}.kicad_pcb"
            data = path.read_bytes()
            digest = hashlib.sha256(data).hexdigest()
            assert digest == signature["halves"][side]["pcb_after_sha256"]
            texts = re.findall(r'\(gr_text "([^"]+)"', data.decode())
            for value in (side.upper(), "eduarbo.com", "flankbd.com"):
                assert texts.count(value) == 1, (path, value, texts)
            assert "eduarbo" not in texts, "Maker name must appear only in its URL"
            assert ("RIGHT" if side == "left" else "LEFT") not in texts
            sources[str(path.relative_to(ROOT))] = digest
        for edition in options["editions"]:
            selected = edition["packages"] if variant == "flan36" else edition["variants"][variant]
            for side, relative in selected.items():
                old = subprocess.check_output(["git", "show", f"{BASELINE}:{relative}"], cwd=ROOT)
                new = (ROOT / relative).read_bytes()
                with zipfile.ZipFile(io.BytesIO(old)) as a, zipfile.ZipFile(io.BytesIO(new)) as b:
                    assert a.testzip() is None and b.testzip() is None
                    assert set(a.namelist()) == set(b.namelist()), relative
                    manufacturing = [n for n in a.namelist() if n not in ("manifest.json", "README.txt")]
                    changed = [n for n in manufacturing if undated(a.read(n)) != undated(b.read(n))]
                    assert changed == [f"{variant}-{side}-B_Silkscreen.gbo"], (relative, changed)
                    manifest = json.loads(b.read("manifest.json"))
                    source = manifest.get("source_pcb_sha256") or manifest["source"]["pcb_sha256"]
                    assert source == sources[f"hardware/{directory}/{variant}-{side}.kicad_pcb"]
                    for name, expected in manifest["files"].items():
                        assert hashlib.sha256(b.read(name)).hexdigest() == expected
                packages[relative] = hashlib.sha256(new).hexdigest()
    report = {"baseline": BASELINE, "sources": sources, "packages": packages,
              "only_manufacturing_change": "B_Silkscreen", "source_urls_and_hand_labels": True,
              "physical_acceptance": False}
    (ROOT / "validation/pcb-identity.json").write_text(json.dumps(report, indent=2) + "\n")
    print(f"PASS: {len(sources)} boards, {len(packages)} packages; only back silkscreen changed")


if __name__ == "__main__":
    main()
