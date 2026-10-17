"""Concept C — Barrido: two differential pairs that leave the controller and step through the row gaps."""
import math
from shapely.geometry import LineString, Point
from .prims import stroke, ring, fillet

W = 0.20        # each conductor of the pair
PAIR = 0.50     # centre spacing of the pair
R = 0.75        # fillet on every octilinear corner
C = 1.0         # 45° chamfer length on the jogs
RA = 1.80       # clearance radius used to route past a mounting hole
X0, X1 = 47.7, 138.3
UPPER_END = 33.4     # the upper pair stops just above H1
CH = [67.0, 85.0, 103.0, 121.0]
UPPER = [27.7, 25.5, 20.5, 25.5, 37.5]   # row-gap centre per column (right half)
LOWER = [44.5, 42.5, 37.5, 42.5, 54.5]

def jog(xc, y0, y1):
    s = 1 if y1 > y0 else -1
    if abs(y1 - y0) <= 2 * C:
        h = abs(y1 - y0) / 2
        return [(xc - h, y0), (xc + h, y1)]
    return [(xc - C, y0), (xc, y0 + s * C), (xc, y1 - s * C), (xc + C, y1)]

def upper():
    g = UPPER
    pts = [(X0, g[0])] + jog(CH[0], g[0], g[1]) + jog(CH[1], g[1], g[2])
    # pass H2 (103, 20.5) on its lower-left side with a tangent 45° segment
    k = (103 - 20.5) - RA * math.sqrt(2)
    pts += [(20.5 + k, 20.5), (103.0, 103.0 - k), (103.0, g[3] - C), (103.0 + C, g[3])]
    # H1 (121.3, 37.5) blocks the entry to the last row gap: the pair lands on the screw
    pts += [(CH[3] - C, g[3]), (CH[3], g[3] + C), (CH[3], UPPER_END)]
    return fillet(pts, R)

def lower():
    g = LOWER
    pts = [(X0, g[0])]
    for i, cx in enumerate(CH):
        pts += jog(cx, g[i], g[i + 1])
    pts += [(X1, g[4])]
    return fillet(pts, R)

SPREAD = 0.36   # each conductor breaks out 45° by this much before its via
VIA = (0.28, 0.20)

def breakout(line, o):
    """Offset conductor whose two ends fan out 45° away from the pair into a via."""
    pts = list(line.offset_curve(o, quad_segs=24, join_style="round").coords)
    unit = lambda v: (v[0] / (v[0] ** 2 + v[1] ** 2) ** 0.5, v[1] / (v[0] ** 2 + v[1] ** 2) ** 0.5)
    def tail(end, nxt, centre):
        t = unit((end[0] - nxt[0], end[1] - nxt[1]))
        n = unit((end[0] - centre[0], end[1] - centre[1]))
        q = (end[0] + (t[0] + n[0]) * SPREAD, end[1] + (t[1] + n[1]) * SPREAD)
        v = (q[0] + t[0] * 0.45, q[1] + t[1] * 0.45)
        return [q, v], v
    t0, v0 = tail(pts[0], pts[1], line.coords[0])
    t1, v1 = tail(pts[-1], pts[-2], line.coords[-1])
    return LineString(list(reversed(t0)) + pts + t1), (v0, v1)

def build(board, mx):
    art = None
    for path in (upper(), lower()):
        line = LineString([(mx(x), y) for x, y in path])
        for o in (PAIR / 2, -PAIR / 2):
            ln, vias = breakout(line, o)
            s = stroke(ln, W)
            for v in vias:
                s = s.difference(Point(v).buffer(VIA[0] - VIA[1] / 2, quad_segs=32)).union(ring(v, VIA[0], VIA[1]))
            art = s if art is None else art.union(s)
    return art
