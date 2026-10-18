#!/usr/bin/env python3
"""Derive a Flan family variant's KiCad projects from the routed revI Flan36 boards.

Per half it adds the variant's keys (design/variants.json) as copies of a revI key and its
diode moved to the new centre: the outer pinky column K00/K10/K20 copies column 1, the number
row K40-K45 copies the top row (K40 copies K01). Every new key is wired col2row like the
others (COLc -> switch -> Krc_A -> diode -> ROWr); the number row's ROW4 net goes to one free
nice!nano pin per half, from --row4 or design/pinmap.json ("variants"), replacing that pin's
no-connect. On the left the free pins sit in the nice!nano's RAW-side channel, which already
holds three tracks per layer at the revI rules (0.2 mm tracks and clearance, 0.5 mm to the
edge); a seventh signal past D10 misses by 0.02 mm. So number-row boards release GND3 there:
the module ties its GND pads internally, the schematic marks GND3 no-connect and its channel
track goes, leaving room for ROW4. It also adds the fasteners and the PCB outline of
design/<id>-profiles.json (tools/build_variant_profiles.py).
Every revI footprint, track, via, hole, the bay, the battery opening and both cutouts stay
exactly as they are; only the outer Edge.Cuts outline is replaced. The back signature is
removed (reinstall it with install_signature.py --variant). The new connections are left
unrouted: route them with route_variant_keys.py, then check with check_routed_pcb.py.
Libraries and 3D models stay in hardware/revI: the variant's library tables and model paths
point at ${KIPRJMOD}/../revI/.

Refuses to overwrite an existing board. Run with KiCad 10 Python (pcbnew).
SPDX-License-Identifier: GPL-3.0-or-later
"""
from pathlib import Path
import argparse, hashlib, json, re, subprocess, uuid
import xml.etree.ElementTree as ET

import pcbnew as p

ROOT = Path(__file__).resolve().parents[1]
REVI = ROOT / "hardware/revI"
SHARED = "${KIPRJMOD}/../revI/"     # libraries and models are revI's, never copied
NAMESPACE = uuid.UUID("a5b1c0de-f1a0-4f42-8000-000000000042")   # deterministic schematic UUIDs
SCH_PITCH = 41.91                  # schematic column pitch (K01 72.39 -> K02 114.3; K30 at 30.48)
SCH_ROW_Y = {0: 35.56, 1: 68.58, 2: 101.6, 3: 134.62, 4: 233.68}   # row 4 sits below the notes
RELEASE = {"left": "GND3"}         # number-row boards: frees the left RAW-side channel for ROW4

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

def shift(text, dx, dy=0.0):
    """Move every (at x y ...) and (xy x y) in a schematic item by dx, dy."""
    fmt = lambda v: f"{v:.5f}".rstrip("0").rstrip(".")
    def move(m):
        y = m.group(3) if dy == 0 else fmt(float(m.group(3)) + dy)
        return f"{m.group(1)}{fmt(float(m.group(2)) + dx)} {y}"
    return re.sub(rf"(\((?:at|xy) )({NUM}) ({NUM})", move, text)

def template(ref):
    """Row and column of the revI key a variant key copies: the top row for the number row,
    column 1 for the outer column (K40 copies K01)."""
    r, c = int(ref[1]), int(ref[2])
    return (0 if r == 4 else r), (1 if c == 0 else c)

def pin_at(text, items, pin):
    """Schematic position of U1's pin, and whether it is on the symbol's right."""
    from check_layout import read_sexpr
    u1 = next(s for _, _, s in items if s.startswith("(symbol ") and '(property "Reference" "U1"' in s)
    lib = re.search(r'\(lib_id "([^"]+)"\)', u1)[1]
    ux, uy = map(float, re.search(rf"\(at ({NUM}) ({NUM}) 0\)", u1).groups())
    libs = next(n for n in read_sexpr(text) if isinstance(n, list) and n[0] == "lib_symbols")
    def pins(node):
        if isinstance(node, list):
            if node and node[0] == "pin":
                yield node
            for c in node:
                yield from pins(c)
    sym = next(n for n in libs if isinstance(n, list) and n[:2] == ["symbol", lib])
    node = next(q for q in pins(sym) if any(isinstance(c, list) and c[:2] == ["number", pin] for c in q))
    px, py = (float(v) for v in next(c for c in node if isinstance(c, list) and c[0] == "at")[1:3])
    return round(ux + px, 5), round(uy - py, 5), px > 0

def mcu_pin(text, items, pin):
    """Schematic position of U1's pin and the no-connect flag on it."""
    x, y, right = pin_at(text, items, pin)
    flag = [(a, b) for a, b, s in items if s.startswith("(no_connect ")
            and [round(float(v), 5) for v in re.search(rf"\(at ({NUM}) ({NUM})\)", s).groups()] == [x, y]]
    assert len(flag) == 1, (pin, "expected one no-connect on the chosen pin")
    return x, y, right, flag[0]

def release_pin(text, items, pin):
    """The wire and label on U1's pin, to be replaced by a no-connect."""
    x, y, _ = pin_at(text, items, pin)
    ends = lambda s: [[round(float(v), 5) for v in q] for q in re.findall(rf"\(xy ({NUM}) ({NUM})\)", s)]
    wire = [(a, b, s) for a, b, s in items if s.startswith("(wire ") and [x, y] in ends(s)]
    assert len(wire) == 1, (pin, "expected one wire")
    far = next(e for e in ends(wire[0][2]) if e != [x, y])
    label = [(a, b) for a, b, s in items if s.startswith("(label ")
             and [round(float(v), 5) for v in re.search(rf"\(at ({NUM}) ({NUM})", s).groups()] == far]
    assert len(label) == 1, (pin, "expected one label")
    return x, y, [wire[0][:2], label[0]]

def schematic(text, side, name, added, row4=None, release=None):
    """Add each new key's switch and diode, labels and wires as copies of its template cell;
    with row4, wire that U1 pin to a ROW4 label instead of its no-connect; with release,
    replace that U1 pin's wire and label by a no-connect."""
    items = list(root_children(text))
    root = re.search(r'\(kicad_sch [^\n]*?\(uuid "([^"]+)"\)', text)[1]
    symbols = {}
    for _, _, s in items:
        if s.startswith("(symbol "):
            symbols[re.search(r'\(property "Reference" "([^"]+)"', s)[1]] = s
    new, paths = [], {}
    for ref in added:
        r, c = int(ref[1]), int(ref[2])
        tr, tc = template(ref)
        dx, dy = (c - tc) * SCH_PITCH, SCH_ROW_Y[r] - SCH_ROW_Y[tr]
        for kind in ("K", "D"):
            src = symbols[f"{kind}{tr}{tc}"]
            x, y = map(float, re.search(rf"\(at ({NUM}) ({NUM}) 0\)", src).groups())
            u = {old: str(uuid.uuid5(NAMESPACE, f"{name}/{kind}{r}{c}/{i}"))
                 for i, old in enumerate(re.findall(r'\(uuid "([^"]+)"\)', src))}
            s = shift(src, dx, dy)
            for old, nu in u.items():
                s = s.replace(old, nu)
            s = s.replace(f'"{kind}{tr}{tc}"', f'"{kind}{r}{c}"')
            new.append(s)
            paths[f"{kind}{r}{c}"] = f"/{root}/{next(iter(u.values()))}"
            if kind == "K":
                # the switch cell: labels and wires within 8 mm left/right, down to the diode row
                for _, _, s in items:
                    if not s.startswith(("(label ", "(wire ")):
                        continue
                    pts = [tuple(map(float, q)) for q in re.findall(rf"\((?:at|xy) ({NUM}) ({NUM})", s)]
                    if all(abs(px - x) <= 8 and y - .01 <= py <= y + 14 for px, py in pts):
                        s = shift(s, dx, dy)
                        s = re.sub(r'\(uuid "[^"]+"\)', lambda m, k=len(new): f'(uuid "{uuid.uuid5(NAMESPACE, f"{name}/{ref}/item{k}")}")', s)
                        s = (s.replace(f'"K{tr}{tc}_A"', f'"K{r}{c}_A"').replace(f'"COL{tc}"', f'"COL{c}"')
                             .replace(f'"ROW{tr}"', f'"ROW{r}"'))
                        new.append(s)
    cut = []
    if row4:
        x, y, right, flag = mcu_pin(text, items, row4)
        end = round(x + (2.54 if right else -2.54), 5)
        ids = [uuid.uuid5(NAMESPACE, f"{name}/ROW4/{i}") for i in range(2)]
        new.append(f'(wire (pts (xy {x} {y}) (xy {end} {y})) (stroke (width 0) (type default)) (uuid "{ids[0]}"))')
        new.append(f'(label "ROW4" (at {end} {y} 0) (effects (font (size 1 1)) (justify left bottom)) (uuid "{ids[1]}"))')
        cut.append(flag)
    if release:
        x, y, spans = release_pin(text, items, release)
        new.append(f'(no_connect (at {x} {y}) (uuid "{uuid.uuid5(NAMESPACE, f"{name}/{release}/nc")}"))')
        cut += spans
    for a, b in sorted(cut, reverse=True):
        text = text[:a] + text[b:]
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

def chain(text, items, pad):
    """Root segments from U1's pad, on the first segment's layer, through pass-through nodes
    to the first junction, via or layer change (a through-hole pad, such as J1's)."""
    u1 = next(s for _, _, s in items if s.startswith("(footprint ") and '(property "Reference" "U1"' in s)
    fx, fy = map(float, re.search(rf"\n\t\t\(at ({NUM}) ({NUM})", u1).groups())
    block = u1[u1.index(f'(pad "{pad}"'):]
    dx, dy = map(float, re.search(rf"\(at ({NUM}) ({NUM})", block).groups())
    net = re.search(r'\(net (?:\d+ )?"([^"]+)"\)', block)[1]
    segs = []
    for a, b, s in items:
        if s.startswith("(segment") and f'(net "{net}")' in s:
            ends = [tuple(nm(float(v)) for v in re.search(rf"\({k} ({NUM}) ({NUM})\)", s).groups()) for k in ("start", "end")]
            segs.append(((a, b), ends, re.search(r'\(layer "([^"]+)"\)', s)[1]))
    start = (nm(fx + dx), nm(fy + dy))
    first = [layer for _, e, layer in segs if start in e]
    assert len(first) == 1, (pad, "expected one track at the pad")
    segs = [(span, e) for span, e, layer in segs if layer == first[0]]
    vias = {tuple(nm(float(v)) for v in re.search(rf"\(at ({NUM}) ({NUM})\)", s).groups())
            for _, _, s in items if s.startswith("(via") and f'(net "{net}")' in s}
    degree = lambda q: sum(q in e for _, e in segs)
    node, taken = start, []
    while True:
        nxt = [(span, e) for span, e in segs if node in e and span not in [t for t, _ in taken]]
        if len(nxt) != 1:
            break
        span, e = nxt[0]
        taken.append((span, e))
        node = e[1] if e[0] == node else e[0]
        if degree(node) != 2 or node in vias:
            break
    return net, [span for span, _ in taken]

def strip(text, revi_outline, release=None):
    """Drop the back signature group and exactly revI's outer outline segments, as text.
    (Removing items through pcbnew's binding invalidates other wrappers and crashes.)"""
    items = list(root_children(text))
    group = [s for _, _, s in items if s.startswith('(group "flan-signature"')]
    assert len(group) == 1
    members = set(re.findall(r'"([0-9a-f-]{36})"', group[0][group[0].index("(members"):]))
    old = {frozenset([(nm(a[0]), nm(a[1])), (nm(c[0]), nm(c[1]))]) for a, c in zip(revi_outline, revi_outline[1:] + revi_outline[:1])}
    pieces, last, removed = [], 0, {"signature_items": 0, "outline_segments": 0}
    released = set()
    if release:
        net, spans = chain(text, items, release)
        released = set(spans)
        removed[f"{release}_tracks"] = len(spans)
    for a, c, s in items:
        own = re.search(r'\n\t\t\(uuid "([^"]+)"\)', s)
        if s is group[0] or (a, c) in released:
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
    assert {k: removed[k] for k in ("signature_items", "outline_segments")} == \
        {"signature_items": len(members), "outline_segments": len(old)}, removed
    text = "".join(pieces)
    removed["model_paths_shared"] = text.count('(model "${KIPRJMOD}/models/')
    return text.replace('(model "${KIPRJMOD}/models/', f'(model "{SHARED}models/'), removed

def board(src, side, name, keys, profile, revi_outline, paths, desired, components, path, release=None):
    text, report = strip(src.read_text(), revi_outline, release)
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
        tr, tc = template(k["ref"])
        for kind in ("K", "D"):
            tmpl = b.FindFootprintByReference(f"{kind}{tr}{tc}")
            key = b.FindFootprintByReference(f"K{tr}{tc}")
            dx, dy = k["x"] - p.ToMM(key.GetPosition().x), k["y"] - p.ToMM(key.GetPosition().y)
            fp = tmpl.Duplicate(False).Cast()
            ref = kind + k["ref"][1:]
            fp.SetReference(ref)
            fp.Move(p.VECTOR2I(nm(dx), nm(dy)))
            fp.SetPath(p.KIID_PATH(paths[ref]))
            b.Add(fp)
            added[ref] = {"from": f"{kind}{tr}{tc}", "at": [round(p.ToMM(fp.GetPosition().x), 6), round(p.ToMM(fp.GetPosition().y), 6)],
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
            elif ref == "U1" and want == "/ROW4":   # the chosen free pin, unconnected in revI
                assert pad.GetNetname().startswith("unconnected-"), pad.GetNetname()
                pad.SetNet(nets[want]); report["row4_pin"] = pad.GetNumber()
            elif ref == "U1" and pad.GetNumber() == release:   # released: no-connect in the schematic
                assert want.startswith("unconnected-"), want
                pad.SetNet(nets[want]); report["released_pin"] = release
            assert pad.GetNetname() == want, (side, ref, pad.GetNumber(), pad.GetNetname(), want)
    b.BuildConnectivity()
    report["added_footprints"] = added
    return b, report

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--variant", default="flan42")
    ap.add_argument("--output", type=Path)
    ap.add_argument("--cli", default="/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli")
    ap.add_argument("--row4", nargs=2, type=int, metavar=("LEFT", "RIGHT"),
                    help="nice!nano GPIO for ROW4 per half (default: design/pinmap.json variants)")
    a = ap.parse_args()
    spec = json.loads((ROOT / "design/variants.json").read_text())["variants"][a.variant]
    row4 = {}
    if spec["number_row"]:
        pinmap = json.loads((ROOT / "design/pinmap.json").read_text())
        row4 = dict(zip(("left", "right"), a.row4)) if a.row4 else \
            {s: pinmap["variants"][a.variant][s]["row4"] for s in ("left", "right")}
        free = json.loads((ROOT / "design/variants.json").read_text())["free_gpios"]
        assert all(row4[s] in free[s] for s in row4), (row4, "not a free GPIO")
    profiles = json.loads((ROOT / f"design/{a.variant}-profiles.json").read_text())
    revi = json.loads((ROOT / "design/revI-profiles.json").read_text())
    dest = (a.output or ROOT / "hardware" / a.variant).resolve()
    if any(dest.glob("*.kicad_pcb")):
        raise SystemExit(f"Refusing to overwrite boards in {dest}. Preserve them first.")
    dest.mkdir(parents=True, exist_ok=True)
    for t in ("fp-lib-table", "sym-lib-table"):
        table = (REVI / t).read_text()
        assert table.count("${KIPRJMOD}/libraries/") == table.count("(lib ")
        (dest / t).write_text(table.replace("${KIPRJMOD}/libraries/", SHARED + "libraries/"))
    report = {"schema": "flan-variant-pcb-1", "variant": a.variant, "source": "hardware/revI (routed, signed Flan36)",
              "kicad_version": p.GetBuildVersion(), "routed": False, "physical_acceptance": False,
              "fasteners": profiles["fasteners"], "halves": {}}
    for side in ("left", "right"):
        name = f"{a.variant}-{side}"
        src = REVI / f"flan36-{side}"
        keys = [k for k in spec["keys"][side] if k["ref"] in spec["added_per_half"]]
        release = RELEASE.get(side) if row4 else None
        text, paths = schematic(src.with_suffix(".kicad_sch").read_text(), side, name, [k["ref"] for k in keys],
                                f"D{row4[side]}" if row4 else None, release)
        sch = dest / f"{name}.kicad_sch"
        sch.write_text(text)
        pro = src.with_suffix(".kicad_pro").read_text().replace(f"flan36-{side}", name)
        (dest / f"{name}.kicad_pro").write_text(pro)
        desired, components = netlist(a.cli, sch, dest / f"{name}-netlist.xml")
        (dest / f"{name}-netlist.xml").unlink()
        for k in keys:
            r, d = k["ref"], "D" + k["ref"][1:]
            assert desired[r, "1"] == f"/COL{r[2]}" and desired[r, "2"] == desired[d, "2"] == f"/{r}_A" and desired[d, "1"] == f"/ROW{r[1]}"
        if row4:
            assert desired["U1", f"D{row4[side]}"] == "/ROW4"
        pcb = dest / f"{name}.kicad_pcb"
        # loaded beside its .kicad_pro so the board keeps revI's rules; the project file is not rewritten
        b, half = board(src.with_suffix(".kicad_pcb"), side, name, keys, profiles[side],
                        revi[side]["pcb_outline"], paths, desired, components, pcb, release)
        p.SaveBoard(str(pcb), b, True)
        assert (dest / f"{name}.kicad_pro").read_text() == pro
        half.update({"source_pcb_sha256": sha(src.with_suffix(".kicad_pcb")), "source_schematic_sha256": sha(src.with_suffix(".kicad_sch")),
                     "pcb_sha256": sha(pcb), "schematic_sha256": sha(sch), "components": len(components),
                     "tracks_and_vias_kept": len(b.GetTracks())})
        if row4:
            assert half["row4_pin"] == f"D{row4[side]}"
        report["halves"][side] = half
    # trial builds elsewhere keep their receipt beside the boards
    receipt = dest / f"{a.variant}-pcb.json" if a.output else ROOT / f"validation/{a.variant}-pcb.json"
    receipt.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))

if __name__ == "__main__":
    main()
