"""Extract the geometry silkscreen art must respect (run with KiCad's Python).

Writes outline/cutouts, per-side pads, courtyards, silk, fab, tracks/vias, holes and
footprint positions in KiCad millimetres (y down). Usage: kicad_extract.py BOARD OUT.json
"""
import json, sys
import pcbnew

MM = pcbnew.ToMM

def polyset_to_list(ps):
    out = []
    for i in range(ps.OutlineCount()):
        o = ps.Outline(i)
        outer = [(MM(o.CPoint(j).x), MM(o.CPoint(j).y)) for j in range(o.PointCount())]
        holes = []
        for h in range(ps.HoleCount(i)):
            hh = ps.Hole(i, h)
            holes.append([(MM(hh.CPoint(j).x), MM(hh.CPoint(j).y)) for j in range(hh.PointCount())])
        out.append({"outer": outer, "holes": holes})
    return out

def main(path, out):
    b = pcbnew.LoadBoard(path)
    err = pcbnew.FromMM(0.005)
    outline = pcbnew.SHAPE_POLY_SET()
    b.GetBoardPolygonOutlines(outline, False)
    res = {"outline": polyset_to_list(outline), "sides": {}, "footprints": [], "holes": []}
    for side, cu, silk, crt, fab, mask in (("F", pcbnew.F_Cu, pcbnew.F_SilkS, pcbnew.F_CrtYd, pcbnew.F_Fab, pcbnew.F_Mask),
                                           ("B", pcbnew.B_Cu, pcbnew.B_SilkS, pcbnew.B_CrtYd, pcbnew.B_Fab, pcbnew.B_Mask)):
        pads = pcbnew.SHAPE_POLY_SET()
        crty = pcbnew.SHAPE_POLY_SET()
        silks = pcbnew.SHAPE_POLY_SET()
        fabs = pcbnew.SHAPE_POLY_SET()
        tracks = []
        for fp in b.GetFootprints():
            for pad in fp.Pads():
                if pad.IsOnLayer(cu) or pad.IsOnLayer(mask):
                    lay = cu if pad.IsOnLayer(cu) else mask
                    pad.TransformShapeToPolygon(pads, lay, 0, err, pcbnew.ERROR_OUTSIDE)
            c = fp.GetCourtyard(crt)
            if c.OutlineCount():
                crty.Append(c)
            for item in fp.GraphicalItems():
                if item.GetLayer() == silk:
                    if item.GetClass() in ("PCB_TEXT", "PCB_FIELD"):
                        if item.IsVisible():
                            item.TransformTextToPolySet(silks, 0, err, pcbnew.ERROR_OUTSIDE)
                    else:
                        item.TransformShapeToPolygon(silks, silk, 0, err, pcbnew.ERROR_OUTSIDE)
                if item.GetLayer() == fab:
                    item.TransformShapeToPolygon(fabs, fab, 0, err, pcbnew.ERROR_OUTSIDE)
            for t in fp.GetFields():
                if t.GetLayer() == silk and t.IsVisible():
                    t.TransformTextToPolySet(silks, 0, err, pcbnew.ERROR_OUTSIDE)
        for d in b.GetDrawings():
            if d.GetLayer() == silk:
                if d.GetClass() == "PCB_TEXT":
                    d.TransformTextToPolySet(silks, 0, err, pcbnew.ERROR_OUTSIDE)
                else:
                    d.TransformShapeToPolygon(silks, silk, 0, err, pcbnew.ERROR_OUTSIDE)
        for t in b.GetTracks():
            if t.GetClass() == "PCB_VIA":
                p = t.GetPosition()
                tracks.append({"via": True, "x": MM(p.x), "y": MM(p.y), "d": MM(t.GetWidth(cu)), "drill": MM(t.GetDrillValue())})
            elif t.GetLayer() == cu:
                if t.GetClass() == "PCB_ARC":
                    poly = pcbnew.SHAPE_POLY_SET()
                    t.TransformShapeToPolygon(poly, cu, 0, err, pcbnew.ERROR_OUTSIDE)
                    tracks.append({"poly": polyset_to_list(poly)})
                else:
                    s, e = t.GetStart(), t.GetEnd()
                    tracks.append({"a": (MM(s.x), MM(s.y)), "b": (MM(e.x), MM(e.y)), "w": MM(t.GetWidth())})
        zones = pcbnew.SHAPE_POLY_SET()
        for z in b.Zones():
            if z.IsOnLayer(cu) and not z.GetIsRuleArea():
                zones.Append(z.GetFilledPolysList(cu))
        res["sides"][side] = {
            "pads": polyset_to_list(pads), "courtyards": polyset_to_list(crty),
            "silk": polyset_to_list(silks), "fab": polyset_to_list(fabs), "tracks": tracks,
            "zones": polyset_to_list(zones)}
    for fp in b.GetFootprints():
        p = fp.GetPosition()
        res["footprints"].append({"ref": fp.GetReference(), "lib": fp.GetFPID().GetLibItemName().wx_str(),
                                  "x": MM(p.x), "y": MM(p.y), "rot": fp.GetOrientationDegrees(),
                                  "side": "B" if fp.IsFlipped() else "F"})
        for pad in fp.Pads():
            if pad.HasHole():
                p = pad.GetPosition(); ds = pad.GetDrillSize()
                res["holes"].append({"x": MM(p.x), "y": MM(p.y), "dx": MM(ds.x), "dy": MM(ds.y),
                                     "plated": pad.GetAttribute() == pcbnew.PAD_ATTRIB_PTH, "ref": fp.GetReference()})
    ds = b.GetDesignSettings()
    res["rules"] = {"silk_clearance": MM(ds.m_SilkClearance)}
    json.dump(res, open(out, "w"))
    print("ok", path, len(res["footprints"]), "footprints", len(res["holes"]), "holes")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
