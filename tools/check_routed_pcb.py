#!/usr/bin/env python3
"""Read every physical pad and independently check the routed revI boards.

With --variant (e.g. flan42) it checks a Flan family board built by build_variant_pcb.py
instead: every revI footprint, pad and model unchanged against the revI source commit, each
added footprint an exact translated copy of its template, and the Edge.Cuts set equal to
revI's minus its outer outline plus the variant's (design/<id>-profiles.json).
Run with KiCad Python. SPDX-License-Identifier: GPL-3.0-or-later
"""
import argparse
import hashlib
import json
import subprocess
import xml.etree.ElementTree as ET
from decimal import Decimal, InvalidOperation
from pathlib import Path

import pcbnew as p
from check_layout import read_sexpr

ROOT = Path(__file__).resolve().parents[1]
BASELINE = "fe8c7fdc1b13b8eac6383c3315af8e749b1b8d4c"
# the routed, signed revI boards the family variants are derived from
VARIANT_SOURCE = "cc484e0d7d207389f2ac30a37eb9c9d8b868ed9c"


def geometry(board):
    result = {}
    for fp in board.GetFootprints():
        pads = []
        for q in fp.Pads():
            pads.append((q.m_Uuid.AsString(), q.GetNumber(), q.GetPosition().x, q.GetPosition().y,
                         q.GetOrientationDegrees(), q.GetSize().x, q.GetSize().y,
                         q.GetDrillSize().x, q.GetDrillSize().y, q.GetShape(), q.GetAttribute(),
                         q.GetLayerSet().FmtHex()))
        result[fp.GetReference()] = {"uuid": fp.m_Uuid.AsString(),
            "xy": [fp.GetPosition().x, fp.GetPosition().y], "angle": fp.GetOrientationDegrees(),
            "layer": fp.GetLayer(), "locked": fp.IsLocked(), "symbol": fp.GetPath().AsString(),
            "pads": sorted(pads), "models": [m.m_Filename for m in fp.Models()]}
    return result


def edges(path):
    tree = read_sexpr(path.read_text())
    # KiCad adds missing UUIDs and removes trailing decimal zeroes when saving.
    # Compare exact decimal geometry, independent of those serialization changes.
    def canonical(node):
        if isinstance(node, list):
            return tuple(canonical(c) for c in node if not (isinstance(c, list) and c[0] == "uuid"))
        try:
            return str(Decimal(node).normalize())
        except InvalidOperation:
            return node
    return sorted(repr(canonical(n)) for n in tree if isinstance(n, list) and n[0].startswith("gr_")
                  and any(isinstance(c, list) and c[:2] == ["layer", "Edge.Cuts"] for c in n))


def segments(board):
    """Edge.Cuts as a set of segments (nm endpoints); anything but straight segments fails."""
    out = set()
    for d in board.GetDrawings():
        if d.GetLayer() == p.Edge_Cuts:
            assert d.GetShape() == p.SHAPE_T_SEGMENT, d.GetShapeStr()
            out.add(frozenset([(d.GetStart().x, d.GetStart().y), (d.GetEnd().x, d.GetEnd().y)]))
    return out


def loop(points):
    nm = lambda v: int(round(v * 1e6))
    return {frozenset([(nm(a[0]), nm(a[1])), (nm(c[0]), nm(c[1]))]) for a, c in zip(points, points[1:] + points[:1])}


def variant_geometry(board, old, side, profile, revi_outline, keys):
    """revI footprints unchanged; added keys, diodes and holes exact translated copies at the
    variant's key centres (design/variants.json) and added mounts (design/<id>-profiles.json)."""
    new, base = geometry(board), geometry(old)
    # the variant shares revI's 3D models through ${KIPRJMOD}/../revI/ (build_variant_pcb.py)
    for value in base.values():
        value["models"] = [m.replace("${KIPRJMOD}/models/", "${KIPRJMOD}/../revI/models/") for m in value["models"]]
    for ref, value in base.items():
        assert new.pop(ref) == value, ("Component/pad/pose/model mutation", side, ref)
    templates = {h["id"]: (h["from"], [int(round(v * 1e6)) for v in h["xy"]]) for h in profile["added_mounts"]}
    from build_variant_pcb import template   # outer column copies column 1, number row the top row
    for ref in [r for r in new if r[0] in "KD"]:
        tr, tc = template(ref)
        templates[ref] = (f"{ref[0]}{tr}{tc}", None)
    assert sorted(templates) == sorted(new), (side, sorted(new))
    for ref, (tmpl, xy) in templates.items():
        a, b = new[ref], base[tmpl]
        if xy is None:   # keys and diodes move with their key: the variant key offset
            tr, tc = template(ref)
            key = base[f"K{tr}{tc}"]["xy"]; centre = keys["K" + ref[1:]]
            xy = [b["xy"][0] + int(round(centre["x"] * 1e6)) - key[0], b["xy"][1] + int(round(centre["y"] * 1e6)) - key[1]]
        dx, dy = xy[0] - b["xy"][0], xy[1] - b["xy"][1]
        assert a["xy"] == xy, (side, ref)
        for k in ("angle", "layer", "locked", "models"):
            assert a[k] == b[k], (side, ref, k)
        moved = sorted((n, x + dx, y + dy, *rest) for _, n, x, y, *rest in b["pads"])
        assert sorted(tuple(q[1:]) for q in a["pads"]) == moved, (side, ref, "pads")
    expected = (segments(old) - loop(revi_outline)) | loop(profile["pcb_outline"])
    assert segments(board) == expected, (side, "Outline or aperture changed")
    return len(templates)


def copper_islands(board, net):
    """Independent of DRC: the net's pads, tracks and vias, joined wherever their copper meets
    on a shared layer. Returns the islands as sets of "REF.PAD" names (empty for pad-less
    copper; a name appears once per pad). Needs Shapely, so only the family checks call it."""
    from shapely.geometry import LineString, Point, Polygon
    from shapely.ops import unary_union
    from shapely.strtree import STRtree
    mm = p.ToMM
    def polys(ps):
        return unary_union([Polygon([(mm(ps.Outline(i).CPoint(j).x), mm(ps.Outline(i).CPoint(j).y))
                                     for j in range(ps.Outline(i).PointCount())]) for i in range(ps.OutlineCount())])
    shapes, names = {p.F_Cu: [], p.B_Cu: []}, []
    for fp in board.GetFootprints():
        for q in fp.Pads():
            if q.GetNetname() != net:
                continue
            names.append(f"{fp.GetReference()}.{q.GetNumber()}")
            for l in shapes:
                if q.IsOnLayer(l):
                    ps = p.SHAPE_POLY_SET(); q.TransformShapeToPolygon(ps, l, 0, p.FromMM(.002), p.ERROR_OUTSIDE)
                    shapes[l].append((polys(ps), len(names) - 1))
    for t in board.GetTracks():
        if t.GetNetname() != net:
            continue
        names.append(None)
        if isinstance(t, p.PCB_VIA):
            for l in shapes:
                shapes[l].append((Point(mm(t.GetPosition().x), mm(t.GetPosition().y)).buffer(mm(t.GetWidth(l)) / 2), len(names) - 1))
        else:
            line = LineString([(mm(t.GetStart().x), mm(t.GetStart().y)), (mm(t.GetEnd().x), mm(t.GetEnd().y))])
            shapes[t.GetLayer()].append((line.buffer(mm(t.GetWidth()) / 2), len(names) - 1))
    parent = list(range(len(names)))
    def root(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]; i = parent[i]
        return i
    for items in shapes.values():
        tree = STRtree([g for g, _ in items])
        for g, i in items:
            for k in tree.query(g):
                if g.distance(items[k][0]) < 1e-4:
                    parent[root(i)] = root(items[k][1])
    islands = {}
    for i, n in enumerate(names):
        islands.setdefault(root(i), []).extend([n] if n else [])
    return list(islands.values())


def verify(directory, output, cli, variant="flan36"):
    output.mkdir(parents=True, exist_ok=True)
    family = variant != "flan36"
    result = {"schema": "flan36-routed-pcb-1", "baseline": BASELINE,
              "kicad_version": p.GetBuildVersion(), "physical_acceptance": False, "halves": {}}
    pinmap_variants = json.loads((ROOT / "design/pinmap.json").read_text()).get("variants", {})
    pinmap = json.loads((ROOT / "design/pinmap.json").read_text())["halves"]
    layout = json.loads((ROOT / "design/layout.json").read_text())["halves"]
    if family:
        result = {"schema": "flan-variant-routed-pcb-1", "variant": variant, "source": VARIANT_SOURCE,
                  "kicad_version": p.GetBuildVersion(), "physical_acceptance": False, "halves": {}}
        layout = json.loads((ROOT / "design/variants.json").read_text())["variants"][variant]["keys"]
        profiles = json.loads((ROOT / f"design/{variant}-profiles.json").read_text())
        revi = json.loads((ROOT / "design/revI-profiles.json").read_text())
    added_counts, gnd_checks = {}, {}
    for side in ("left", "right"):
        name = f"{variant}-{side}"
        board_path = directory / (name + ".kicad_pcb")
        sch_path = board_path.with_suffix(".kicad_sch")
        original = output / (name + "-baseline.kicad_pcb")
        source = f"{VARIANT_SOURCE}:hardware/revI/flan36-{side}.kicad_pcb" if family else f"{BASELINE}:hardware/revI/{name}.kicad_pcb"
        original.write_bytes(subprocess.check_output(["git", "show", source], cwd=ROOT))
        board = p.LoadBoard(str(board_path)); old = p.LoadBoard(str(original))
        if family:
            added = variant_geometry(board, old, side, profiles[side], revi[side]["pcb_outline"],
                                     {k["ref"]: k for k in layout[side]})
        else:
            assert geometry(board) == geometry(old), "Component/pad/pose/model mutation"
            assert edges(board_path) == edges(original), "Outline or aperture changed"
        assert board.GetTracks(), "Unrouted study is not accepted"
        if family: added_counts[side] = added
        assert board.GetCopperLayerCount() == 2
        netfile = output / (name + "-netlist.xml")
        subprocess.run([cli, "sch", "export", "netlist", "--format", "kicadxml", "-o", str(netfile), str(sch_path)], check=True)
        root = ET.parse(netfile).getroot()
        expected = {(node.get("ref"), node.get("pin")): net.get("name")
                    for net in root.findall("./nets/net") for node in net.findall("node")}
        fps = {f.GetReference(): f for f in board.GetFootprints()}
        physical_pads = 0
        for fp in fps.values():
            for pad in fp.Pads():
                physical_pads += 1
                assert pad.GetNetname() == expected.get((fp.GetReference(), pad.GetNumber()), ""), (
                    side, fp.GetReference(), pad.GetNumber(), pad.m_Uuid.AsString())
        for key in layout[side]:
            ref = key["ref"]; diode = "D" + ref[1:]
            assert expected[ref, "1"] == f'/COL{key["col"]}'
            assert expected[ref, "2"] == expected[diode, "2"] == f"/{ref}_A"
            assert expected[diode, "1"] == f'/ROW{key["row"]}'
        pins = {"D0": "DISP_SCK", "D1": "DISP_MOSI", "D14": "DISP_CS", "RAW": "BAT_SW", "VCC": "VCC", "RST": "RESET"}
        pins.update({f"D{x}": f"ROW{i}" for i, x in enumerate(pinmap[side]["rows"])})
        pins.update({f"D{x}": f"COL{i}" for i, x in enumerate(pinmap[side]["cols"])})
        if family and variant in pinmap_variants:   # the number row's ROW4 pin, and GND3 released on the left
            from build_variant_pcb import RELEASE
            pins[f'D{pinmap_variants[variant][side]["row4"]}'] = "ROW4"
            if side in RELEASE:
                assert expected["U1", RELEASE[side]].startswith("unconnected-"), (side, RELEASE[side])
            # without U1 GND3 on the left, J1's GND and every GND pad must still be one copper net
            islands = copper_islands(board, "/GND")
            assert len(islands) == 1 and "J1.2" in islands[0], (side, "GND split", [sorted(i) for i in islands])
            gnd_checks[side] = {"gnd_pads_in_one_copper_island": len(islands[0]),
                                "u1_gnd3": "no-connect" if side in RELEASE else "connected"}
        for pad, net in pins.items(): assert expected["U1", pad] == "/"+net
        for i, net in enumerate(("DISP_MOSI", "DISP_SCK", "VCC", "GND", "DISP_CS"), 1):
            assert expected["J2", str(i)] == "/"+net
        for ref, pad, net in [("J1","1","BAT_PLUS"),("J1","2","GND"),("SW1","1","BAT_PLUS"),("SW1","2","BAT_SW"),("SW2","1","RESET"),("SW2","2","GND")]:
            assert expected[ref,pad] == "/"+net
        counts = {}
        for kind, check, source in (("pcb", "drc", board_path), ("sch", "erc", sch_path)):
            report = output / f"{check}-{side}.json"
            command = [cli, kind, check, "--format", "json", "--severity-all", "--exit-code-violations", "-o", str(report)]
            if kind == "pcb": command += ["--schematic-parity", "--all-track-errors"]
            subprocess.run(command + [str(source)], check=True)
            data = json.loads(report.read_text())
            if kind == "pcb":
                assert not data["violations"] and not data["unconnected_items"] and not data["schematic_parity"]
                counts.update(drc_violations=0, unconnected_items=0, schematic_parity=0)
            else:
                assert not any(s["violations"] for s in data["sheets"])
                counts["erc_violations"] = 0
        widths = [p.ToMM(t.GetWidth()) for t in board.GetTracks() if not isinstance(t,p.PCB_VIA)]
        assert min(widths) >= .2 - 1e-7
        result["halves"][side] = {**counts, "components": len(fps), "physical_pads_checked": physical_pads,
            "matrix_keys": len(layout[side]), "tracks_and_vias": len(board.GetTracks()), "minimum_track_mm": min(widths),
            "poses_pads_models_and_outline_preserved": True,
            "pcb_sha256": hashlib.sha256(board_path.read_bytes()).hexdigest(),
            "schematic_sha256": hashlib.sha256(sch_path.read_bytes()).hexdigest(),
            "rules_sha256": hashlib.sha256(board_path.with_suffix(".kicad_pro").read_bytes()).hexdigest()}
    if family:
        for side in ("left", "right"):
            result["halves"][side] = {**result["halves"][side], "added_footprints_checked": added_counts[side],
                                      "revI_footprints_pads_models_unchanged": True, "outline": f"design/{variant}-profiles.json",
                                      **({"gnd": gnd_checks[side]} if side in gnd_checks else {})}
            del result["halves"][side]["poses_pads_models_and_outline_preserved"]
    receipt = "validation/revI-routing.json" if not family else f"validation/{variant}-routing.json"
    (ROOT / receipt).write_text(json.dumps(result, indent=2)+"\n")
    print("PASS: both boards connected; all physical pads, semantic matrix and unchanged geometry verified")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--variant", default="flan36", help="flan36 checks hardware/revI; flan42 hardware/flan42")
    ap.add_argument("--directory", type=Path)
    ap.add_argument("--output", type=Path)
    ap.add_argument("--cli", default="/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli")
    a=ap.parse_args(); family = a.variant != "flan36"
    directory = a.directory or ROOT/("hardware/" + a.variant if family else "hardware/revI")
    output = a.output or ROOT/("build/routing-validation-" + a.variant if family else "build/routing-validation")
    verify(directory.resolve(), output.resolve(), a.cli, a.variant)
