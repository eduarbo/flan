"""Add a concept's silkscreen to a copy of a routed board (run with KiCad's Python).

Art arrives as hole-free polygons (prims.dehole) so KiCad stores each outline exactly;
credit lines are added as native, editable KiCad text. Everything is grouped as
"silkscreen-art" so it can be selected, moved or deleted in one step.
"""
import json, sys
import pcbnew

def polygons(g):
    if g["type"] == "Polygon":
        return [g["coordinates"]]
    if g["type"] == "MultiPolygon":
        return g["coordinates"]
    return [p for gg in g.get("geometries", []) for p in polygons(gg)]

def add_poly(board, layer, ring):
    ps = pcbnew.SHAPE_POLY_SET()
    ps.NewOutline()
    for x, y in ring[:-1]:
        ps.Append(pcbnew.FromMM(x), pcbnew.FromMM(y))
    s = pcbnew.PCB_SHAPE(board)
    s.SetShape(pcbnew.SHAPE_T_POLY)
    s.SetPolyShape(ps)
    s.SetFilled(True)
    s.SetWidth(0)
    s.SetLayer(layer)
    board.Add(s)
    return s

def add_text(board, t):
    pt = pcbnew.PCB_TEXT(board)
    pt.SetText(t["text"])
    pt.SetLayer(pcbnew.B_SilkS if t["layer"] == "B" else pcbnew.F_SilkS)
    pt.SetTextSize(pcbnew.VECTOR2I(pcbnew.FromMM(t["w"]), pcbnew.FromMM(t["h"])))
    pt.SetTextThickness(pcbnew.FromMM(t["t"]))
    pt.SetPosition(pcbnew.VECTOR2I(pcbnew.FromMM(t["x"]), pcbnew.FromMM(t["y"])))
    pt.SetMirrored(bool(t.get("mirror")))
    pt.SetHorizJustify(pcbnew.GR_TEXT_H_ALIGN_LEFT if t.get("hj") == "left" else pcbnew.GR_TEXT_H_ALIGN_CENTER)
    pt.SetVertJustify(pcbnew.GR_TEXT_V_ALIGN_CENTER)
    board.Add(pt)
    return pt

def main(src, art_path, out):
    b = pcbnew.LoadBoard(src)
    art = json.load(open(art_path))
    group = pcbnew.PCB_GROUP(b)
    group.SetName("silkscreen-art")
    b.Add(group)
    n = 0
    for side, layer in (("F", pcbnew.F_SilkS), ("B", pcbnew.B_SilkS)):
        for poly in polygons(art[side]):
            if len(poly) > 1:
                raise SystemExit("polygon with holes reached KiCad; split it with prims.dehole first")
            group.AddItem(add_poly(b, layer, poly[0])); n += 1
    for t in art["texts"]:
        group.AddItem(add_text(b, t)); n += 1
    pcbnew.SaveBoard(out, b)
    print("added", n, "items to", out)

if __name__ == "__main__":
    main(*sys.argv[1:4])
