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
