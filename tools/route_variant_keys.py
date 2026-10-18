#!/usr/bin/env python3
"""Route the added keys of a board built by build_variant_pcb.py.

1. Copy: each added key gets its template key's own local routing (build_variant_pcb.py:
   column 1 for the outer column, the top row for the number row), translated by the key
   offset (design/variants.json): each Krc_A net, and for the outer column the column-1
   tracks and vias that join K01/K11/K21's column pads (COL1, pruned of branches that leave
   the column) onto COL0. Widths, layers and vias are unchanged.
2. Links: from KiCad DRC's remaining unconnected items, each new outer-column row joins its
   neighbour diode's ROW pad (Dr0 pad 1 -> Dr1 pad 1), and a number-row key reaches its column
   at the hot-swap pad 1 of the key below; the rest (the ROW4 chain to its nice!nano pin, the
   outer column to COL0) join where DRC finds them nearest.
3. complete_pcb_routes.py routes those links on its 0.1 mm grid with the variant outline,
   and smooth_routes.py straightens its staircases.
4. KiCad DRC with schematic parity must report 0 violations and 0 unconnected items;
   only then is the board written back, and its routing (items copied, links, straightened
   lengths, routed board hash) goes into the build receipt (validation/<variant>-pcb.json,
   or <variant>-pcb.json beside a trial build). Work files go to build/routing-<variant>/<side>/.

Usage: route_variant_keys.py BOARD SIDE [--variant flan42] [--work DIR]
Run with KiCad 10 Python plus Shapely, NumPy and SciPy. SPDX-License-Identifier: GPL-3.0-or-later
"""
from pathlib import Path
import argparse, fcntl, hashlib, json, shutil, subprocess, sys

import pcbnew as p
from build_variant_pcb import template

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
    smd = lambda ref: next(q for q in b.FindFootprintByReference(ref).Pads()
                           if q.GetNumber() == "1" and q.GetAttribute() == p.PAD_ATTRIB_SMD)
    report = json.loads(Path(drc).read_text())
    for error in report["unconnected_items"]:
        texts = " ".join(i["description"] for i in error["items"])
        for r in "012":
            if f"[/ROW{r}]" in texts and f"of D{r}0 " in texts:
                error["items"] = [item(pad(f"D{r}0")), item(pad(f"D{r}1"))]
        for c in "012345":
            mine = [i for i in error["items"] if f"[/COL{c}]" in i["description"] and f"of K4{c}" in i["description"]]
            other = [i for i in error["items"] if i["description"].startswith("Track")]
            if mine and other:   # a track point may sit within another net's clearance; use the pad below
                error["items"] = [mine[0], item(smd(f"K0{c}"))]
    Path(out).write_text(json.dumps(report, indent=1))
    print(len(report["unconnected_items"]), "connections for complete_pcb_routes.py")

def copy_pattern(board_path, side, variant):
    spec = json.loads((ROOT / "design/variants.json").read_text())["variants"][variant]
    keys = {k["ref"]: k for k in spec["keys"][side]}
    added = spec["added_per_half"]
    b = p.LoadBoard(str(board_path))
    nets = {n.GetNetname(): n for n in b.GetNetsByNetcode().values()}
    def offset(ref):   # nm from the template key to the variant key
        tr, tc = template(ref)
        at = b.FindFootprintByReference(f"K{tr}{tc}").GetPosition()
        return p.FromMM(keys[ref]["x"]) - at.x, p.FromMM(keys[ref]["y"]) - at.y
    assert not [t for t in b.GetTracks() if t.GetNetname() in {f"/{r}_A" for r in added}], "already routed"
    report = {}
    outer = [r for r in added if r[2] == "0" and r[1] != "4"]
    if outer:
        dx, dy = offset(outer[0])
        assert all(offset(r) == (dx, dy) for r in outer)
        col = column_items(b, ["K01", "K11", "K21"], "/COL1")
        report["/COL0"] = len(copy(b, col, dx, dy, nets["/COL0"]))
    for r in added:
        tr, tc = template(r)
        src = f"/K{tr}{tc}_A"
        items = column_items(b, [f"K{tr}{tc}", f"D{tr}{tc}"], src)
        assert len(items) == len([t for t in b.GetTracks() if t.GetNetname() == src]), (src, "not local")
        dx, dy = offset(r)
        report[f"/{r}_A"] = len(copy(b, items, dx, dy, nets[f"/{r}_A"]))
    b.BuildConnectivity()
    p.SaveBoard(str(board_path), b, True)
    print(json.dumps({"side": side, "items_copied": report}))

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
    ap.add_argument("--work", type=Path, help="work directory (default build/routing-<variant>/<side>)")
    ap.add_argument("--step", choices=("copy", "links"), help=argparse.SUPPRESS)   # one stage per process
    ap.add_argument("--links", nargs=2, help=argparse.SUPPRESS)
    a = ap.parse_args()
    if a.step == "copy":
        return copy_pattern(a.board, a.side, a.variant)
    if a.step == "links":
        return links(a.board, *a.links)
    # each stage in its own process: pcbnew's binding does not survive some board edits
    work = (a.work or ROOT / f"build/routing-{a.variant}/{a.side}").resolve()
    if work.exists():
        shutil.rmtree(work)   # only this tool's regenerable work files
    work.mkdir(parents=True)
    board = work / a.board.name
    for ext in (".kicad_pcb", ".kicad_pro", ".kicad_sch"):
        shutil.copyfile(a.board.with_suffix(ext), board.with_suffix(ext))
    for name in ("fp-lib-table", "sym-lib-table"):
        shutil.copyfile(a.board.parent / name, work / name)
    try:   # the tables point at ${KIPRJMOD}/../revI/, as in hardware/
        (work.parent / "revI").symlink_to(ROOT / "hardware/revI", target_is_directory=True)
    except FileExistsError:
        pass
    me = [sys.executable, __file__, str(board), a.side, "--variant", a.variant]
    def run(command):   # echo and keep the stage's stdout; pcbnew's chatter goes to stderr
        out = subprocess.run(command, check=True, stdout=subprocess.PIPE, text=True).stdout
        print(out, end="", flush=True)
        return out.strip().splitlines()
    copied = json.loads(run(me + ["--step", "copy"])[-1])["items_copied"]
    drc(a.cli, board, work / "drc-pattern.json")
    run(me + ["--step", "links", "--links", str(work / "drc-pattern.json"), str(work / "links.json")])
    shutil.copyfile(board, work / "pre-route.kicad_pcb")
    routed = run([sys.executable, str(ROOT / "tools/complete_pcb_routes.py"), str(board), str(work / "links.json"),
                  a.side, str(ROOT / f"design/{a.variant}-profiles.json")])
    shutil.copyfile(board, work / "routed.kicad_pcb")
    smooth = json.loads(run([sys.executable, str(ROOT / "tools/smooth_routes.py"), str(work / "pre-route.kicad_pcb"),
                             str(work / "routed.kicad_pcb"), str(board)])[-1])
    final = drc(a.cli, board, work / "drc-final.json")
    assert not final["violations"] and not final["unconnected_items"] and not final["schematic_parity"], (
        "routing rejected by DRC; see " + str(work / "drc-final.json"))
    shutil.copyfile(board, a.board)
    receipt = a.board.parent / f"{a.variant}-pcb.json"
    if not receipt.exists():
        receipt = ROOT / f"validation/{a.variant}-pcb.json"
    lock = open(receipt.with_suffix(".lock"), "w")
    fcntl.flock(lock, fcntl.LOCK_EX)   # both halves may finish at once
    data = json.loads(receipt.read_text())
    data["halves"][a.side]["routing"] = {
        "items_copied": copied, "links_routed": len([l for l in routed if l.split(" ")[0].isdigit()]),
        "straightened": smooth["router_segments_to_straightened"], "vias_added": smooth["vias"],
        "drc": {"violations": 0, "unconnected_items": 0, "schematic_parity": 0},
        "routed_pcb_sha256": hashlib.sha256(a.board.read_bytes()).hexdigest()}
    data["routed"] = all("routing" in h for h in data["halves"].values())
    receipt.write_text(json.dumps(data, indent=2) + "\n")
    fcntl.flock(lock, fcntl.LOCK_UN); lock.close(); receipt.with_suffix(".lock").unlink(missing_ok=True)
    print(f"PASS: {a.side} routed; DRC 0 violations, 0 unconnected, 0 parity")

if __name__ == "__main__":
    main()
