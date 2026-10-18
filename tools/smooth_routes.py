#!/usr/bin/env python3
"""Straighten the staircases left by complete_pcb_routes.py's 0.1 mm grid routes.

Compares a routed board with its pre-route copy: tracks and vias only the routed board has
are the router's. Each of the router's single-layer chains (between vias, pads and branch
points) is string-pulled: from each kept point it jumps to the farthest later point whose
straight track keeps the board rules plus a margin (0.2 mm copper, 0.25 mm hole, 0.5 mm
edge) from every other net, hole and edge. Other nets' original and straightened tracks
both count as obstacles. The output is the pre-route board plus the straightened tracks and
the router's vias, so nothing is removed through pcbnew. KiCad DRC remains the judge.

Usage: smooth_routes.py PRE_ROUTE.kicad_pcb ROUTED.kicad_pcb OUT.kicad_pcb
Run with KiCad 10 Python plus Shapely. SPDX-License-Identifier: GPL-3.0-or-later
"""
import argparse, json
from pathlib import Path

import pcbnew as p
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union
from shapely.strtree import STRtree

COPPER, HOLE, EDGE, MARGIN = 0.2, 0.25, 0.5, 0.02
mm = p.ToMM
LAYERS = (p.F_Cu, p.B_Cu)

def ends(t):
    return [(t.GetStart().x, t.GetStart().y), (t.GetEnd().x, t.GetEnd().y)]

def sig(t):
    if isinstance(t, p.PCB_VIA):
        return ("via", t.GetNetname(), t.GetPosition().x, t.GetPosition().y)
    return ("seg", t.GetNetname(), t.GetLayer(), frozenset(ends(t)))

def polys(ps):
    out = []
    for i in range(ps.OutlineCount()):
        o = ps.Outline(i)
        holes = [[(mm(ps.Hole(i, h).CPoint(j).x), mm(ps.Hole(i, h).CPoint(j).y)) for j in range(ps.Hole(i, h).PointCount())]
                 for h in range(ps.HoleCount(i))]
        out.append(Polygon([(mm(o.CPoint(j).x), mm(o.CPoint(j).y)) for j in range(o.PointCount())], holes))
    return unary_union(out)

def obstacles(b):
    """Copper per layer as (net, geometry), and drilled holes as (net, geometry)."""
    copper = {l: [] for l in LAYERS}; holes = []
    err = p.FromMM(.002)
    for fp in b.GetFootprints():
        for q in fp.Pads():
            for l in LAYERS:
                if q.IsOnLayer(l):
                    ps = p.SHAPE_POLY_SET(); q.TransformShapeToPolygon(ps, l, 0, err, p.ERROR_OUTSIDE)
                    copper[l].append((q.GetNetname(), polys(ps)))
            if q.GetDrillSize().x:
                d = mm(max(q.GetDrillSize().x, q.GetDrillSize().y))
                holes.append((q.GetNetname() if q.GetAttribute() == p.PAD_ATTRIB_PTH else None,
                              Point(mm(q.GetPosition().x), mm(q.GetPosition().y)).buffer(d / 2, 32)))
    for t in b.GetTracks():
        copper_of(t, copper, holes)
    return copper, holes

def copper_of(t, copper, holes):
    if isinstance(t, p.PCB_VIA):
        c = Point(mm(t.GetPosition().x), mm(t.GetPosition().y))
        for l in LAYERS:
            copper[l].append((t.GetNetname(), c.buffer(mm(t.GetWidth(l)) / 2, 32)))
        holes.append((t.GetNetname(), c.buffer(mm(t.GetDrill()) / 2, 32)))
    else:
        (x0, y0), (x1, y1) = ends(t)
        copper[t.GetLayer()].append((t.GetNetname(), LineString([(mm(x0), mm(y0)), (mm(x1), mm(y1))]).buffer(mm(t.GetWidth()) / 2, 16)))

def chains(segments):
    """Split one net/layer's segments into simple polylines between non-pass-through nodes."""
    adj = {}
    for s in segments:
        a, c = ends(s)
        adj.setdefault(a, []).append((c, s)); adj.setdefault(c, []).append((a, s))
    used, out = set(), []
    starts = [n for n, e in adj.items() if len(e) != 2] or [next(iter(adj))]
    for n0 in starts:
        for nxt, s in adj[n0]:
            if id(s) in used:
                continue
            line, cur = [n0], n0
            while True:
                used.add(id(s)); line.append(nxt); cur = nxt
                if len(adj[cur]) != 2:
                    break
                follow = [(n, q) for n, q in adj[cur] if id(q) not in used]
                if not follow:
                    break
                nxt, s = follow[0]
            out.append(line)
    assert len(used) == len(segments), "unwalked router segments"
    return out

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("pre", type=Path); ap.add_argument("routed", type=Path); ap.add_argument("out", type=Path)
    a = ap.parse_args()
    b0, b1 = p.LoadBoard(str(a.pre)), p.LoadBoard(str(a.routed))
    before = {sig(t) for t in b0.GetTracks()}
    assert before <= {sig(t) for t in b1.GetTracks()}, "the routed board is not the pre-route board plus routes"
    new = [t for t in b1.GetTracks() if sig(t) not in before]
    vias = [t for t in new if isinstance(t, p.PCB_VIA)]
    segs = [t for t in new if not isinstance(t, p.PCB_VIA)]
    outline = p.SHAPE_POLY_SET(); b1.GetBoardPolygonOutlines(outline, False)
    copper, holes = obstacles(b1)
    region = polys(outline)
    report = {}
    for net in sorted({s.GetNetname() for s in segs}):
        for layer in LAYERS:
            mine = [s for s in segs if s.GetNetname() == net and s.GetLayer() == layer]
            if not mine:
                continue
            width = mm(mine[0].GetWidth())
            assert all(mm(s.GetWidth()) == width for s in mine)
            other = [g for n, g in copper[layer] if n != net]
            tree = STRtree(other)
            hole_tree = STRtree([g for n, g in holes if n != net])
            inside = region.buffer(-(EDGE + width / 2 + MARGIN))
            reach_c, reach_h = width / 2 + COPPER + MARGIN, width / 2 + HOLE + MARGIN
            def clear(u, v):
                line = LineString([(mm(u[0]), mm(u[1])), (mm(v[0]), mm(v[1]))])
                if not inside.covers(line):
                    return False
                if any(other[i].distance(line) < reach_c for i in tree.query(line.buffer(reach_c))):
                    return False
                return not any(hole_tree.geometries[i].distance(line) < reach_h for i in hole_tree.query(line.buffer(reach_h)))
            pulled = []
            for pts in chains(mine):
                keep, i = [pts[0]], 0
                while i < len(pts) - 1:
                    j = next((j for j in range(len(pts) - 1, i + 1, -1) if clear(pts[i], pts[j])), i + 1)
                    keep.append(pts[j]); i = j
                pulled.append(keep)
            report[f"{net} {b1.GetLayerName(layer)}"] = [len(mine), sum(len(k) - 1 for k in pulled)]
            # the straightened tracks are obstacles for the nets that follow
            for keep in pulled:
                for u, v in zip(keep, keep[1:]):
                    seg = LineString([(mm(u[0]), mm(u[1])), (mm(v[0]), mm(v[1]))]).buffer(width / 2, 16)
                    copper[layer].append((net, seg))
            mine_out = report.setdefault("_tracks", [])
            mine_out += [(net, layer, mine[0].GetWidth(), u, v) for keep in pulled for u, v in zip(keep, keep[1:])]
    tracks = report.pop("_tracks", [])
    out = p.LoadBoard(str(a.pre))
    nets = {n.GetNetname(): n for n in out.GetNetsByNetcode().values()}
    for net, layer, width, u, v in tracks:
        t = p.PCB_TRACK(out); t.SetStart(p.VECTOR2I(*u)); t.SetEnd(p.VECTOR2I(*v))
        t.SetLayer(layer); t.SetWidth(width); t.SetNet(nets[net]); out.Add(t)
    for v in vias:
        n = p.PCB_VIA(out); n.SetPosition(v.GetPosition()); n.SetWidth(v.GetWidth(p.F_Cu)); n.SetDrill(v.GetDrill())
        n.SetViaType(v.GetViaType()); n.SetLayerPair(p.F_Cu, p.B_Cu); n.SetNet(nets[v.GetNetname()]); out.Add(n)
    out.BuildConnectivity()
    p.SaveBoard(str(a.out), out, True)
    print(json.dumps({"router_segments_to_straightened": report, "vias": len(vias)}))

if __name__ == "__main__":
    main()
