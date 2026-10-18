"""Shared maker's plate on the back: stacked Flan36 logo, rule and credit lines."""
from pathlib import Path
from shapely import affinity
from shapely.geometry import LineString
from .prims import load_logo, place, stroke

KIT = Path(__file__).resolve().parents[2] / "docs/branding/outline"
LOGO = load_logo(KIT / "flan36-outline-black.svg")

# largest free back-side rectangles on the routed revI boards (space.rects)
PLATE = {"right": (82.65, 54.3, 105.05, 60.5), "left": (53.7, 54.1, 77.1, 60.5)}
HAND = {"right": "RIGHT", "left": "LEFT"}
LOGO_GROW = 0.022   # the 5.5 mm logo's caramel line is ~0.13 mm; grow it to print reliably

def plate(name):
    x0, y0, x1, y1 = PLATE[name]
    cy = (y0 + y1) / 2
    lh = 5.5
    lw = lh * (LOGO.bounds[2] - LOGO.bounds[0]) / (LOGO.bounds[3] - LOGO.bounds[1])
    lx = x1 - 0.5 - lw / 2
    logo = place(LOGO, lx, cy, height=lh).buffer(LOGO_GROW, quad_segs=16)   # thinnest stroke ≥ 0.17 mm
    logo = affinity.scale(logo, xfact=-1, origin=(lx, cy))          # reads correctly from the back
    rule_x = lx - lw / 2 - 1.1
    rule = stroke(LineString([(rule_x, cy - 2.3), (rule_x, cy + 2.3)]), 0.20)
    tx = rule_x - 1.0                                                  # mirrored text grows toward -x
    texts = [
        {"id": f"{name}-l1", "text": "EDUARDO RUIZ", "x": tx, "y": cy - 1.55, "w": 1.0, "h": 1.0, "t": 0.15, "layer": "B", "mirror": True, "hj": "left"},
        {"id": f"{name}-l2", "text": "REV I · 2026", "x": tx, "y": cy, "w": 1.0, "h": 1.0, "t": 0.15, "layer": "B", "mirror": True, "hj": "left"},
        {"id": f"{name}-l3", "text": HAND[name], "x": tx, "y": cy + 1.55, "w": 1.0, "h": 1.0, "t": 0.15, "layer": "B", "mirror": True, "hj": "left"},
    ]
    return logo.union(rule), texts

# ---------------------------------------------------------------------------- Flan signature (2026-10-17)
# Free back-side rectangles of the routed revI boards (space.rects on the board without art):
# the lockup and its edition lines go in the largest one, the maker's credit in the nearest
# one at least 12.5 × 3.4 mm.
FLAN_PLATE = {"right": (82.6, 54.3, 105.0, 60.5), "left": (53.7, 54.1, 77.1, 60.5)}
FLAN_CREDIT = {"right": (60.8, 59.1, 77.0, 62.9), "left": (86.7, 59.9, 99.3, 63.9)}
FLAN_EM = 4.6          # wordmark em (mm): the mark is 5.5 mm tall, no hairline under 0.17 mm at wght 450
FLAN_TEXT = {"w": 1.0, "h": 1.0, "t": 0.15}
# "by", the eduarbo cube, "eduarbo": ink widths in KiCad's stroke font at 1.0 mm (kicad_text.py)
CREDIT = {"by": 1.443, "by_left": 0.258, "name": "eduarbo", "name_w": 5.777, "name_left": 0.21,
          "mark_h": 2.6, "mark_cut": 0.25, "gap": 0.75, "centre": -0.045}

def flan_plate(name, font_path):
    """The Flan lockup, a rule and REV I / 2026 / RIGHT|LEFT, plus "by <cube> eduarbo" nearby.

    Built in reading coordinates (as seen from below) and mirrored onto B.SilkS. Returns
    (shapes, KiCad text specs, cartouche zones)."""
    from shapely.geometry import box
    from shapely.ops import unary_union
    from branding.lockup import lockup
    x0, y0, x1, y1 = FLAN_PLATE[name]
    cy = (y0 + y1) / 2
    g, met = lockup(font_path, small=True)
    g = affinity.scale(g, FLAN_EM, FLAN_EM, origin=(0, 0))
    lw, lh = met["width_em"] * FLAN_EM, met["mark_em"] * FLAN_EM
    lines = ["REV I", "2026", HAND[name]]
    pitch = 1.5
    block_h = 1.16 + pitch * (len(lines) - 1)
    widest = 4.11                                  # "RIGHT" in KiCad's stroke font at 1.0 mm
    rule_gap = 0.9
    total = lw + rule_gap + 0.2 + rule_gap + widest
    left = (x1 - x0 - total) / 2                   # centred in the free rectangle
    # reading x -> board x: the reading left edge is the board's right edge
    rx = lambda r: x1 - r
    g = affinity.translate(g, left, cy - lh / 2)
    shapes = [affinity.scale(g, -1, 1, origin=(0, 0)).buffer(0)]
    shapes[0] = affinity.translate(shapes[0], x1, 0)
    rule_r = left + lw + rule_gap + 0.1
    shapes.append(LineString([(rx(rule_r), cy - block_h / 2), (rx(rule_r), cy + block_h / 2)]).buffer(0.1, cap_style="flat"))
    tx = rx(rule_r + 0.1 + rule_gap)
    texts = [{"id": f"{name}-{i}", "text": t, "x": tx, "y": cy - block_h / 2 + 0.62 + pitch * i, **FLAN_TEXT,
              "layer": "B", "mirror": True, "hj": "left"} for i, t in enumerate(lines)]
    credit, ctexts, czone = credit_line(name)
    shapes.append(credit)
    texts += ctexts
    zones = [box(rx(left + total), cy - lh / 2, rx(left), cy + lh / 2), czone]
    return unary_union(shapes), texts, zones

def credit_line(name):
    """by <eduarbo cube> eduarbo, centred in FLAN_CREDIT and mirrored onto B.SilkS."""
    from shapely.geometry import box
    from branding.eduarbo import mark
    c = CREDIT
    cube = mark(c["mark_h"], cut=c["mark_cut"])
    mw = cube.bounds[2]
    total = c["by"] + c["gap"] + mw + c["gap"] + c["name_w"]
    x0, y0, x1, y1 = FLAN_CREDIT[name]
    cy = (y0 + y1) / 2 + c["centre"]
    left = (x1 - x0 - total) / 2
    rx = lambda r: x1 - r                          # reading x -> board x, as in flan_plate
    m_r = left + c["by"] + c["gap"]
    cube = affinity.translate(affinity.scale(cube, -1, 1, origin=(0, 0)), rx(m_r), cy - c["mark_h"] / 2)
    texts = [{"id": f"{name}-by", "text": "by", "x": rx(left - c["by_left"]), "y": cy - c["centre"], **FLAN_TEXT,
              "layer": "B", "mirror": True, "hj": "left"},
             {"id": f"{name}-maker", "text": c["name"], "x": rx(m_r + mw + c["gap"] - c["name_left"]), "y": cy - c["centre"],
              **FLAN_TEXT, "layer": "B", "mirror": True, "hj": "left"}]
    return cube, texts, box(rx(left + total), cy - c["mark_h"] / 2, rx(left), cy + c["mark_h"] / 2)
