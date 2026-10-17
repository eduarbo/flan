"""Concept A — Caramelo: one trace along the top edge that drips between the columns."""
from shapely.geometry import LineString, Point, Polygon
from .prims import stroke, ring, dot, fillet, arc_pts

W = 0.30      # caramel stroke
G = 1.30      # hairpin leg spacing (centre to centre)
RB = 0.92     # bulb radius at the end of each drip
INSET = 1.30  # centreline distance from the board edge
R = 0.80      # corner fillet radius

def level(board, x):
    inner = Polygon(board.outline.exterior).buffer(-INSET, quad_segs=24)
    v = LineString([(x, -50), (x, 200)]).intersection(inner.exterior)
    return min(p.y for p in getattr(v, "geoms", [v]))

def bulb(cx, yd):
    """Drop-shaped U: parallel legs that swell into a round end centred at (cx, yd)."""
    yb = yd - 1.7
    n = 14
    s = lambda t: t * t * (3 - 2 * t)
    left = [(cx - (G / 2 + (RB - G / 2) * s(i / n)), yb + (yd - yb) * i / n) for i in range(n + 1)]
    bottom = arc_pts((cx, yd), RB, 180, 0, 40)[1:-1]
    right = [(2 * cx - x, y) for x, y in reversed(left)]
    return left + bottom + right

DRIPS = [  # (channel centre x, depth y of the bulb centre); right half coordinates
    (67.0, 26.0),
    (85.0, 12.8),
    (103.0, 17.75),   # hangs over mounting hole H2
    (121.3, 34.9),    # hangs over mounting hole H1
]
EDGE_END = 41.5      # the right-edge run ends here, then a single falling drop

def centreline(board, mx):
    lv = lambda x: level(board, mx(x))
    levels = [lv(57), lv(75), lv(94), lv(112), lv(131)]
    xr = 140.01 - INSET
    pts = [(51.6, levels[0])]
    for i, (cx, yd) in enumerate(DRIPS):
        a, c = cx - G / 2, cx + G / 2
        pts += [(a, levels[i]), ("drip", cx, yd), (c, levels[i + 1])]
    pts += [(xr, levels[4]), (xr, EDGE_END)]
    # fillet straight corners, splice the drips in
    out, run = [], []
    for p in pts:
        if p[0] == "drip":
            _, cx, yd = p
            b = bulb(cx, yd)
            run.append(b[0])
            out += fillet(run, R)[:-1]
            out += b[:-1]
            run = [b[-1]]
        else:
            run.append(p)
    out += fillet(run, R)
    return [(mx(x), y) for x, y in out]

def build(board, mx):
    line = centreline(board, mx)
    art = stroke(LineString(line), W)
    # source via at the left end
    sx, sy = line[0]
    vx = sx - (0.95 if mx(1) == 1 else -0.95)
    art = art.union(stroke(LineString([(vx, sy), (sx, sy)]), W))
    art = art.difference(Point(vx, sy).buffer(0.32, quad_segs=32)).union(ring((vx, sy), 0.47, 0.30))
    # the falling drop below the right-edge run
    ex, ey = line[-1]
    art = art.union(dot((ex, ey + 1.55), 0.95))
    return art
