#!/usr/bin/env python3
"""Route the added outer-column keys of a board built by build_variant_pcb.py.

1. Copy: each added key gets its row neighbour's own local routing, translated by the key
   offset (design/variants.json): the column-1 tracks and vias that join K01/K11/K21's
   column pads (COL1, pruned of branches that leave the column) onto COL0, and each Kr1_A
   net onto Kr0_A. Widths, layers and vias are unchanged.
2. Links: from KiCad DRC's remaining unconnected items, each new row joins its neighbour
   diode's ROW pad (Dr0 pad 1 -> Dr1 pad 1); the new column joins the existing COL0 net
   where DRC finds them nearest.
3. complete_pcb_routes.py routes those links on its 0.1 mm grid with the variant outline,
   and smooth_routes.py straightens its staircases.
4. KiCad DRC with schematic parity must report 0 violations and 0 unconnected items;
   only then is the board written back. Work files go to build/routing-<variant>/<side>/.

Usage: route_variant_keys.py BOARD SIDE [--variant flan42]
Run with KiCad 10 Python plus Shapely, NumPy and SciPy. SPDX-License-Identifier: GPL-3.0-or-later
"""
from pathlib import Path
import argparse, json, shutil, subprocess, sys

import pcbnew as p

ROOT = Path(__file__).resolve().parents[1]
mm = p.ToMM

def ends(t):
    return [(t.GetStart().x, t.GetStart().y), (t.GetEnd().x, t.GetEnd().y)]

def column_items(b, refs, net):
    """Items of `net` inside the column of `refs`, pruned to those that connect its pads."""
    fps = [b.FindFootprintByReference(r) for r in refs]
    pads = [q for f in fps for q in f.Pads() if q.GetNetname() == net]
    xs = [f.GetPosition().x for f in fps]; ys = [f.GetPosition().y for f in fps]
    lo = (min(xs) - p.FromMM(9), min(ys) - p.FromMM(7)); hi = (max(xs) + p.FromMM(9), max(ys) + p.FromMM(7))
    inside = lambda q: lo[0] <= q[0] <= hi[0] and lo[1] <= q[1] <= hi[1]
    items = [t for t in b.GetTracks() if t.GetNetname() == net and all(inside(q) for q in ends(t))]
    while True:
        def anchored(q, me):
            if any(pad.HitTest(p.VECTOR2I(*q)) for pad in pads):
                return True
            return any(o is not me and q in ends(o) for o in items)
        keep = [t for t in items if isinstance(t, p.PCB_VIA) or all(anchored(q, t) for q in ends(t))]
        # a via must join two kept segments (one per layer) or a pad
        keep = [t for t in keep if not isinstance(t, p.PCB_VIA)
                or sum(ends(t)[0] in ends(o) for o in keep if o is not t) >= 2
                or any(pad.HitTest(t.GetPosition()) for pad in pads)]
        if len(keep) == len(items):
            return items
        items = keep

def copy(b, items, dx, dy, net):
    out = []
    for t in items:
        if isinstance(t, p.PCB_VIA):
            v = p.PCB_VIA(b)
            v.SetPosition(p.VECTOR2I(t.GetPosition().x + dx, t.GetPosition().y + dy))
            v.SetWidth(t.GetWidth(p.F_Cu)); v.SetDrill(t.GetDrill()); v.SetViaType(t.GetViaType())
            v.SetLayerPair(p.F_Cu, p.B_Cu); v.SetNet(net); b.Add(v); out.append(v)
        else:
            s = p.PCB_TRACK(b)
            (x0, y0), (x1, y1) = ends(t)
            s.SetStart(p.VECTOR2I(x0 + dx, y0 + dy)); s.SetEnd(p.VECTOR2I(x1 + dx, y1 + dy))
            s.SetLayer(t.GetLayer()); s.SetWidth(t.GetWidth()); s.SetNet(net); b.Add(s); out.append(s)
    return out

def links(board_path, drc, out):
    """Router input from a DRC report: each new row joins its neighbour diode's ROW pad
    (Dr0 pad 1 -> Dr1 pad 1) instead of whatever track point DRC found nearest."""
    b = p.LoadBoard(str(board_path))
    pad = lambda ref: next(q for q in b.FindFootprintByReference(ref).Pads() if q.GetNumber() == "1")
    item = lambda q: {"uuid": q.m_Uuid.AsString(), "pos": {"x": mm(q.GetPosition().x), "y": mm(q.GetPosition().y)},
                      "description": f"Pad 1 of {q.GetParentFootprint().GetReference()}"}
    report = json.loads(Path(drc).read_text())
    for error in report["unconnected_items"]:
        texts = " ".join(i["description"] for i in error["items"])
        for r in "012":
            if f"[/ROW{r}]" in texts and f"of D{r}0 " in texts:
                error["items"] = [item(pad(f"D{r}0")), item(pad(f"D{r}1"))]
    Path(out).write_text(json.dumps(report, indent=1))
    print(len(report["unconnected_items"]), "connections for complete_pcb_routes.py")

def copy_pattern(board_path, side, variant):
    spec = json.loads((ROOT / "design/variants.json").read_text())["variants"][variant]
    keys = {k["ref"]: k for k in spec["keys"][side]}
    added = spec["added_per_half"]
    assert added == ["K00", "K10", "K20"], "outer column only"
    b = p.LoadBoard(str(board_path))
    nets = {n.GetNetname(): n for n in b.GetNetsByNetcode().values()}
    k01 = b.FindFootprintByReference("K01").GetPosition()
    dx = p.FromMM(keys["K00"]["x"]) - k01.x; dy = p.FromMM(keys["K00"]["y"]) - k01.y
    assert all(p.FromMM(keys[r]["x"]) - b.FindFootprintByReference("K" + r[1] + "1").GetPosition().x == dx for r in added)
    assert not [t for t in b.GetTracks() if t.GetNetname() in {f"/K{r[1]}0_A" for r in added}], "already routed"
    report = {}
    col = column_items(b, ["K01", "K11", "K21"], "/COL1")
    report["/COL0"] = len(copy(b, col, dx, dy, nets["/COL0"]))
    for r in added:
        src = f"/K{r[1]}1_A"
        items = column_items(b, ["K" + r[1] + "1", "D" + r[1] + "1"], src)
        assert len(items) == len([t for t in b.GetTracks() if t.GetNetname() == src]), (src, "not local")
        report[f"/K{r[1]}0_A"] = len(copy(b, items, dx, dy, nets[f"/K{r[1]}0_A"]))
    b.BuildConnectivity()
    p.SaveBoard(str(board_path), b, True)
    print(json.dumps({"side": side, "offset_mm": [mm(dx), mm(dy)], "items_copied": report}))

def drc(cli, board, out):
    subprocess.run([cli, "pcb", "drc", "--format", "json", "--severity-all", "--schematic-parity",
                    "--all-track-errors", "-o", str(out), str(board)], check=True, capture_output=True)
    return json.loads(out.read_text())

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("board", type=Path)
    ap.add_argument("side", choices=("left", "right"))
    ap.add_argument("--variant", default="flan42")
    ap.add_argument("--cli", default="/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli")
    ap.add_argument("--step", choices=("copy", "links"), help=argparse.SUPPRESS)   # one stage per process
    ap.add_argument("--links", nargs=2, help=argparse.SUPPRESS)
    a = ap.parse_args()
    if a.step == "copy":
        return copy_pattern(a.board, a.side, a.variant)
    if a.step == "links":
        return links(a.board, *a.links)
    # each stage in its own process: pcbnew's binding does not survive some board edits
    work = ROOT / f"build/routing-{a.variant}/{a.side}"
    if work.exists():
        shutil.rmtree(work)   # only this tool's regenerable work files
    work.mkdir(parents=True)
    board = work / a.board.name
    for ext in (".kicad_pcb", ".kicad_pro", ".kicad_sch"):
        shutil.copyfile(a.board.with_suffix(ext), board.with_suffix(ext))
    for name in ("fp-lib-table", "sym-lib-table"):
        shutil.copyfile(a.board.parent / name, work / name)
    for d in ("libraries", "models"):
        (work / d).symlink_to(a.board.parent.resolve() / d, target_is_directory=True)
    me = [sys.executable, __file__, str(board), a.side, "--variant", a.variant]
    subprocess.run(me + ["--step", "copy"], check=True)
    drc(a.cli, board, work / "drc-pattern.json")
    subprocess.run(me + ["--step", "links", "--links", str(work / "drc-pattern.json"), str(work / "links.json")], check=True)
    shutil.copyfile(board, work / "pre-route.kicad_pcb")
    subprocess.run([sys.executable, str(ROOT / "tools/complete_pcb_routes.py"), str(board), str(work / "links.json"),
                    a.side, str(ROOT / f"design/{a.variant}-profiles.json")], check=True)
    shutil.copyfile(board, work / "routed.kicad_pcb")
    subprocess.run([sys.executable, str(ROOT / "tools/smooth_routes.py"), str(work / "pre-route.kicad_pcb"),
                    str(work / "routed.kicad_pcb"), str(board)], check=True)
    final = drc(a.cli, board, work / "drc-final.json")
    assert not final["violations"] and not final["unconnected_items"] and not final["schematic_parity"], (
        "routing rejected by DRC; see " + str(work / "drc-final.json"))
    shutil.copyfile(board, a.board)
    print(f"PASS: {a.side} routed; DRC 0 violations, 0 unconnected, 0 parity")

if __name__ == "__main__":
    main()
