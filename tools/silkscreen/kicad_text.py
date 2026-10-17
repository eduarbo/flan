"""Convert text specs to polygons with KiCad's own stroke font, for previews (run with KiCad's Python)."""
import json, sys
import pcbnew

def to_list(ps):
    out = []
    for i in range(ps.OutlineCount()):
        o = ps.Outline(i)
        holes = [[(pcbnew.ToMM(ps.Hole(i, h).CPoint(j).x), pcbnew.ToMM(ps.Hole(i, h).CPoint(j).y)) for j in range(ps.Hole(i, h).PointCount())] for h in range(ps.HoleCount(i))]
        out.append({"outer": [(pcbnew.ToMM(o.CPoint(j).x), pcbnew.ToMM(o.CPoint(j).y)) for j in range(o.PointCount())], "holes": holes})
    return out

specs = json.load(open(sys.argv[1]))
board = pcbnew.BOARD()
res = {}
for s in specs:
    t = pcbnew.PCB_TEXT(board)
    t.SetText(s["text"])
    t.SetLayer(pcbnew.B_SilkS if s.get("layer") == "B" else pcbnew.F_SilkS)
    t.SetTextSize(pcbnew.VECTOR2I(pcbnew.FromMM(s["w"]), pcbnew.FromMM(s["h"])))
    t.SetTextThickness(pcbnew.FromMM(s["t"]))
    t.SetPosition(pcbnew.VECTOR2I(pcbnew.FromMM(s["x"]), pcbnew.FromMM(s["y"])))
    t.SetTextAngle(pcbnew.EDA_ANGLE(s.get("angle", 0), pcbnew.DEGREES_T))
    t.SetMirrored(bool(s.get("mirror", False)))
    t.SetHorizJustify({"left": pcbnew.GR_TEXT_H_ALIGN_LEFT, "right": pcbnew.GR_TEXT_H_ALIGN_RIGHT}.get(s.get("hj"), pcbnew.GR_TEXT_H_ALIGN_CENTER))
    t.SetVertJustify(pcbnew.GR_TEXT_V_ALIGN_CENTER)
    if s.get("bold"):
        t.SetBold(True)
    if s.get("font"):
        t.SetFont(pcbnew.KIFONT.FONT.GetFont(s["font"]))
    ps = pcbnew.SHAPE_POLY_SET()
    t.TransformTextToPolySet(ps, 0, pcbnew.FromMM(0.003), pcbnew.ERROR_OUTSIDE)
    ps.Simplify()
    res[s["id"]] = to_list(ps)
json.dump(res, open(sys.argv[2], "w"))
