#!/usr/bin/env python3
"""Derive a Flan family variant's KiCad projects from the routed revI Flan36 boards.

Outer-column variants only (Flan42). Per half it adds K00/K10/K20 and D00/D10/D20 as copies
of K01/K11/K21 and D01/D11/D21 moved to the variant's key centres (design/variants.json),
wired col2row like every other key (COL0 -> switch -> Kxx_A -> diode -> ROWx), the added
fasteners and the PCB outline of design/<id>-profiles.json (tools/build_variant_profiles.py).
Every revI footprint, track, via, hole, the bay, the battery opening and both cutouts stay
exactly as they are; only the outer Edge.Cuts outline is replaced. The back signature is
removed (reinstall it with install_signature.py --variant). The new connections are left
unrouted: route them with complete_pcb_routes.py, then check with check_routed_pcb.py.

Refuses to overwrite an existing board. Run with KiCad 10 Python (pcbnew).
SPDX-License-Identifier: GPL-3.0-or-later
"""
from pathlib import Path
import argparse, hashlib, json, re, shutil, subprocess, uuid
import xml.etree.ElementTree as ET

import pcbnew as p

ROOT = Path(__file__).resolve().parents[1]
REVI = ROOT / "hardware/revI"
NAMESPACE = uuid.UUID("a5b1c0de-f1a0-4f42-8000-000000000042")   # deterministic schematic UUIDs
SCH_PITCH = 41.91                  # schematic column pitch (K01 72.39 -> K02 114.3; K30 at 30.48)

def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def root_children(text):
    depth = 0; quoted = False; escaped = False; start = None
    for i, c in enumerate(text):
        if quoted:
            if escaped: escaped = False
            elif c == "\\": escaped = True
            elif c == '"': quoted = False
        elif c == '"': quoted = True
        elif c == "(":
            depth += 1
            if depth == 2: start = i
        elif c == ")":
            if depth == 2: yield start, i + 1, text[start:i + 1]
            depth -= 1

NUM = r"-?\d+(?:\.\d+)?"

def shift(text, dx):
    """Move every (at x y ...) and (xy x y) in a schematic item by dx."""
    def move(m):
        x = f"{float(m.group(2)) + dx:.5f}".rstrip("0").rstrip(".")
        return f"{m.group(1)}{x} {m.group(3)}"
    return re.sub(rf"(\((?:at|xy) )({NUM}) ({NUM})", move, text)

def schematic(text, side, name, added):
    """Add Kr0/Dr0, their labels and wires as copies of the column-1 cell, one pitch left."""
    items = list(root_children(text))
    root = re.search(r'\(kicad_sch [^\n]*?\(uuid "([^"]+)"\)', text)[1]
    symbols = {}
    for _, _, s in items:
        if s.startswith("(symbol "):
            symbols[re.search(r'\(property "Reference" "([^"]+)"', s)[1]] = s
    new, paths = [], {}
    for ref in added:
        row = ref[1]
        for kind in ("K", "D"):
            src = symbols[f"{kind}{row}1"]
            x, y = map(float, re.search(rf"\(at ({NUM}) ({NUM}) 0\)", src).groups())
            u = {old: str(uuid.uuid5(NAMESPACE, f"{name}/{kind}{row}0/{i}"))
                 for i, old in enumerate(re.findall(r'\(uuid "([^"]+)"\)', src))}
            s = shift(src, -SCH_PITCH)
            for old, nu in u.items():
                s = s.replace(old, nu)
            s = s.replace(f'"{kind}{row}1"', f'"{kind}{row}0"')
            new.append(s)
            paths[f"{kind}{row}0"] = f"/{root}/{next(iter(u.values()))}"
            if kind == "K":
                # the switch cell: labels and wires within 8 mm left/right, down to the diode row
                for _, _, s in items:
                    if not s.startswith(("(label ", "(wire ")):
                        continue
                    pts = [tuple(map(float, q)) for q in re.findall(rf"\((?:at|xy) ({NUM}) ({NUM})", s)]
                    if all(abs(px - x) <= 8 and y - .01 <= py <= y + 14 for px, py in pts):
                        s = shift(s, -SCH_PITCH)
                        s = re.sub(r'\(uuid "[^"]+"\)', lambda m, k=len(new): f'(uuid "{uuid.uuid5(NAMESPACE, f"{name}/{ref}/item{k}")}")', s)
                        s = s.replace(f'"K{row}1_A"', f'"K{row}0_A"').replace('"COL1"', '"COL0"')
                        new.append(s)
    at = text.rindex("(sheet_instances")
    text = text[:at] + " ".join(new) + " " + text[at:]
    text = text.replace('(project "flan36-' + side + '"', f'(project "{name}"')
    title = "FLAN36 revI - " + side.upper() + " - PROTOTYPE"
    assert title in text
    return text.replace(title, f"{name.split('-')[0].upper()} - {side.upper()} - PROTOTYPE"), paths

def netlist(cli, sch, out):
    subprocess.run([cli, "sch", "export", "netlist", "--format", "kicadxml", "--output", str(out), str(sch)],
                   check=True, capture_output=True)
    xml = ET.parse(out).getroot()
    return ({(n.get("ref"), n.get("pin")): net.get("name") for net in xml.findall("./nets/net") for n in net.findall("node")},
            {c.get("ref") for c in xml.findall("./components/comp")})

def nm(v):
    return int(round(v * 1e6))

def strip(text, revi_outline):
    """Drop the back signature group and exactly revI's outer outline segments, as text.
    (Removing items through pcbnew's binding invalidates other wrappers and crashes.)"""
    items = list(root_children(text))
    group = [s for _, _, s in items if s.startswith('(group "flan-signature"')]
    assert len(group) == 1
    members = set(re.findall(r'"([0-9a-f-]{36})"', group[0][group[0].index("(members"):]))
    old = {frozenset([(nm(a[0]), nm(a[1])), (nm(c[0]), nm(c[1]))]) for a, c in zip(revi_outline, revi_outline[1:] + revi_outline[:1])}
    pieces, last, removed = [], 0, {"signature_items": 0, "outline_segments": 0}
    for a, c, s in items:
        own = re.search(r'\n\t\t\(uuid "([^"]+)"\)', s)
        if s is group[0]:
            pass
        elif own and own[1] in members:
            removed["signature_items"] += 1
        elif s.startswith("(gr_line") and '(layer "Edge.Cuts")' in s:
            ends = [tuple(nm(float(v)) for v in re.search(rf"\({k} ({NUM}) ({NUM})\)", s).groups()) for k in ("start", "end")]
            if frozenset(ends) not in old:
                continue
            removed["outline_segments"] += 1
        else:
            continue
        pieces.append(text[last:a].rstrip("\t")); last = c
    pieces.append(text[last:])
    assert removed == {"signature_items": len(members), "outline_segments": len(old)}, removed
    return "".join(pieces), removed

def board(src, side, name, keys, profile, revi_outline, paths, desired, components, path):
    text, report = strip(src.read_text(), revi_outline)
    path.write_text(text)
    b = p.LoadBoard(str(path))
    labels = [d for d in b.GetDrawings() if isinstance(d, p.PCB_TEXT) and d.GetText() == "FLAN36 revI - PROTOTYPE"]
    assert len(labels) == 1
    labels[0].SetText(f"{name.split('-')[0].upper()} - PROTOTYPE")
    # outer outline: exactly revI's pcb_outline segments went, the variant's come in
    outline = profile["pcb_outline"]
    for a, c in zip(outline, outline[1:] + outline[:1]):
        s = p.PCB_SHAPE(b)
        s.SetShape(p.SHAPE_T_SEGMENT); s.SetLayer(p.Edge_Cuts); s.SetWidth(p.FromMM(.05))
        s.SetStart(p.VECTOR2I(nm(a[0]), nm(a[1]))); s.SetEnd(p.VECTOR2I(nm(c[0]), nm(c[1])))
        b.Add(s)
    report["outline_segments_added"] = len(outline)
    nets = {n.GetNetname(): n for n in b.GetNetsByNetcode().values()}
    for net in sorted(set(desired.values()) - set(nets)):
        nets[net] = p.NETINFO_ITEM(b, net); b.Add(nets[net])
    added = {}
    for k in keys:
        row = k["ref"][1]
        for kind in ("K", "D"):
            tmpl = b.FindFootprintByReference(f"{kind}{row}1")
            key = b.FindFootprintByReference(f"K{row}1")
            dx, dy = k["x"] - p.ToMM(key.GetPosition().x), k["y"] - p.ToMM(key.GetPosition().y)
            fp = tmpl.Duplicate(False).Cast()
            ref = f"{kind}{row}0"
            fp.SetReference(ref)
            fp.Move(p.VECTOR2I(nm(dx), nm(dy)))
            fp.SetPath(p.KIID_PATH(paths[ref]))
            b.Add(fp)
            added[ref] = {"from": f"{kind}{row}1", "at": [round(p.ToMM(fp.GetPosition().x), 6), round(p.ToMM(fp.GetPosition().y), 6)],
                          "angle": fp.GetOrientationDegrees(), "offset_mm": [round(dx, 6), round(dy, 6)]}
    for h in profile["added_mounts"]:
        tmpl = b.FindFootprintByReference(h["from"])
        fp = tmpl.Duplicate(False).Cast()
        fp.SetReference(h["id"])
        fp.SetPosition(p.VECTOR2I(nm(h["xy"][0]), nm(h["xy"][1])))
        assert fp.IsBoardOnly()
        b.Add(fp)
        added[h["id"]] = {"from": h["from"], "at": h["xy"], "angle": fp.GetOrientationDegrees()}
    for fp in b.GetFootprints():
        ref = fp.GetReference()
        fp.SetSheetname(name); fp.SetSheetfile(name + ".kicad_sch")
        if ref not in components:
            assert fp.IsBoardOnly(), ref
            continue
        for pad in fp.Pads():
            want = desired.get((ref, pad.GetNumber()), "")
            if ref in added:
                if want: pad.SetNet(nets[want])
            assert pad.GetNetname() == want, (side, ref, pad.GetNumber(), pad.GetNetname(), want)
    b.BuildConnectivity()
    report["added_footprints"] = added
    return b, report

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--variant", default="flan42")
    ap.add_argument("--output", type=Path)
    ap.add_argument("--cli", default="/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli")
    a = ap.parse_args()
    spec = json.loads((ROOT / "design/variants.json").read_text())["variants"][a.variant]
    if spec["number_row"] or not spec["outer_column"]:
        raise SystemExit(f"{a.variant}: only the outer pinky column is implemented (row 4 needs a pin choice)")
    profiles = json.loads((ROOT / f"design/{a.variant}-profiles.json").read_text())
    revi = json.loads((ROOT / "design/revI-profiles.json").read_text())
    dest = (a.output or ROOT / "hardware" / a.variant).resolve()
    if any(dest.glob("*.kicad_pcb")):
        raise SystemExit(f"Refusing to overwrite boards in {dest}. Preserve them first.")
    dest.mkdir(parents=True, exist_ok=True)
    # identical bytes, so Git stores no second copy; footprint ${KIPRJMOD} paths stay valid
    for d in ("libraries", "models"):
        shutil.copytree(REVI / d, dest / d, dirs_exist_ok=True)
    for t in ("fp-lib-table", "sym-lib-table"):
        shutil.copyfile(REVI / t, dest / t)
    report = {"schema": "flan-variant-pcb-1", "variant": a.variant, "source": "hardware/revI (routed, signed Flan36)",
              "kicad_version": p.GetBuildVersion(), "routed": False, "physical_acceptance": False,
              "fasteners": profiles["fasteners"], "halves": {}}
    for side in ("left", "right"):
        name = f"{a.variant}-{side}"
        src = REVI / f"flan36-{side}"
        keys = [k for k in spec["keys"][side] if k["ref"] in spec["added_per_half"]]
        text, paths = schematic(src.with_suffix(".kicad_sch").read_text(), side, name, [k["ref"] for k in keys])
        sch = dest / f"{name}.kicad_sch"
        sch.write_text(text)
        pro = src.with_suffix(".kicad_pro").read_text().replace(f"flan36-{side}", name)
        (dest / f"{name}.kicad_pro").write_text(pro)
        desired, components = netlist(a.cli, sch, dest / f"{name}-netlist.xml")
        (dest / f"{name}-netlist.xml").unlink()
        for k in keys:
            r, d = k["ref"], "D" + k["ref"][1:]
            assert desired[r, "1"] == "/COL0" and desired[r, "2"] == desired[d, "2"] == f"/{r}_A" and desired[d, "1"] == f"/ROW{r[1]}"
        pcb = dest / f"{name}.kicad_pcb"
        # loaded beside its .kicad_pro so the board keeps revI's rules; the project file is not rewritten
        b, half = board(src.with_suffix(".kicad_pcb"), side, name, keys, profiles[side],
                        revi[side]["pcb_outline"], paths, desired, components, pcb)
        p.SaveBoard(str(pcb), b, True)
        assert (dest / f"{name}.kicad_pro").read_text() == pro
        half.update({"source_pcb_sha256": sha(src.with_suffix(".kicad_pcb")), "source_schematic_sha256": sha(src.with_suffix(".kicad_sch")),
                     "pcb_sha256": sha(pcb), "schematic_sha256": sha(sch), "components": len(components),
                     "tracks_and_vias_kept": len(b.GetTracks())})
        report["halves"][side] = half
    (ROOT / f"validation/{a.variant}-pcb.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))

if __name__ == "__main__":
    main()
