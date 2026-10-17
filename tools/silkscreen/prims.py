"""Drawing primitives for PCB-style silkscreen art (mm, KiCad y-down)."""
import math, re
from shapely.geometry import Polygon, LineString, Point, MultiPolygon
from shapely.ops import unary_union, substring
from shapely import affinity

def stroke(line, w):
    return line.buffer(w / 2, quad_segs=24, cap_style="round", join_style="round")

def ring(c, r, w):
    p = Point(c)
    return p.buffer(r + w / 2, quad_segs=32).difference(p.buffer(r - w / 2, quad_segs=32))

def dot(c, d):
    return Point(c).buffer(d / 2, quad_segs=32)

def arc_pts(c, r, a0, a1, n=None):
    """Points on a circle from angle a0 to a1 (degrees, y-down screen angles)."""
    n = n or max(8, int(abs(a1 - a0) / 4))
    return [(c[0] + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
             c[1] + r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]

def quad(p0, p1, p2, n=16):
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
             (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]) for t in [i / n for i in range(n + 1)]]

def fillet(points, r):
    """Round every interior corner of an orthogonal/octilinear polyline with radius r (tangent arcs)."""
    pts = [points[0]]
    for i in range(1, len(points) - 1):
        a, b, c = points[i - 1], points[i], points[i + 1]
        v1 = (a[0] - b[0], a[1] - b[1]); v2 = (c[0] - b[0], c[1] - b[1])
        l1 = math.hypot(*v1); l2 = math.hypot(*v2)
        if l1 < 1e-9 or l2 < 1e-9:
            continue
        u1 = (v1[0] / l1, v1[1] / l1); u2 = (v2[0] / l2, v2[1] / l2)
        cosang = max(-1, min(1, u1[0] * u2[0] + u1[1] * u2[1]))
        ang = math.acos(cosang)
        if abs(math.pi - ang) < 1e-6:
            pts.append(b); continue
        t = r / math.tan(ang / 2)
        t = min(t, l1 * 0.5 if i - 1 > 0 else l1, l2 * 0.5 if i + 1 < len(points) - 1 else l2)
        rr = t * math.tan(ang / 2)
        p1 = (b[0] + u1[0] * t, b[1] + u1[1] * t); p2 = (b[0] + u2[0] * t, b[1] + u2[1] * t)
        bis = (u1[0] + u2[0], u1[1] + u2[1]); lb = math.hypot(*bis)
        dcen = rr / math.sin(ang / 2)
        cen = (b[0] + bis[0] / lb * dcen, b[1] + bis[1] / lb * dcen)
        a0 = math.degrees(math.atan2(p1[1] - cen[1], p1[0] - cen[0]))
        a1 = math.degrees(math.atan2(p2[1] - cen[1], p2[0] - cen[0]))
        d = (a1 - a0 + 540) % 360 - 180
        pts.extend(arc_pts(cen, rr, a0, a0 + d, max(6, int(abs(d) / 3))))
    pts.append(points[-1])
    return pts

def mirror_x(g, axis):
    return affinity.scale(g, xfact=-1, yfact=1, origin=(axis, 0))

# --- SVG path (absolute M/C/L/Z only) ---------------------------------------
def svg_path_polys(d, tol=24):
    toks = re.findall(r"[MCLZ]|-?[\d.]+(?:e-?\d+)?", d)
    rings, cur, i, cmd, pos = [], [], 0, None, (0, 0)
    while i < len(toks):
        t = toks[i]
        if t in "MCLZ":
            cmd = t; i += 1
            if cmd == "Z":
                if cur: rings.append(cur); cur = []
            continue
        if cmd == "M":
            pos = (float(toks[i]), float(toks[i + 1])); cur = [pos]; i += 2; cmd = "L"
        elif cmd == "L":
            pos = (float(toks[i]), float(toks[i + 1])); cur.append(pos); i += 2
        elif cmd == "C":
            c1 = (float(toks[i]), float(toks[i + 1])); c2 = (float(toks[i + 2]), float(toks[i + 3])); p = (float(toks[i + 4]), float(toks[i + 5]))
            for k in range(1, tol + 1):
                s = k / tol
                cur.append(((1 - s) ** 3 * pos[0] + 3 * (1 - s) ** 2 * s * c1[0] + 3 * (1 - s) * s * s * c2[0] + s ** 3 * p[0],
                            (1 - s) ** 3 * pos[1] + 3 * (1 - s) ** 2 * s * c1[1] + 3 * (1 - s) * s * s * c2[1] + s ** 3 * p[1]))
            pos = p; i += 6
    if cur: rings.append(cur)
    geom = Polygon()
    for r in rings:
        if len(r) >= 3:
            geom = geom.symmetric_difference(Polygon(r).buffer(0))
    return geom

def load_logo(path):
    txt = open(path).read()
    vb = [float(v) for v in re.search(r'viewBox="([^"]+)"', txt).group(1).split()]
    wmm = float(re.search(r'width="([\d.]+)mm"', txt).group(1))
    geoms = [svg_path_polys(d) for d in re.findall(r'\sd="([^"]+)"', txt)]
    g = unary_union(geoms)
    s = wmm / vb[2]
    g = affinity.translate(g, -vb[0], -vb[1])
    return affinity.scale(g, s, s, origin=(0, 0))

def place(g, cx, cy, width=None, height=None, angle=0):
    minx, miny, maxx, maxy = g.bounds
    s = (width / (maxx - minx)) if width else (height / (maxy - miny))
    g = affinity.translate(g, -(minx + maxx) / 2, -(miny + maxy) / 2)
    g = affinity.scale(g, s, s, origin=(0, 0))
    if angle:
        g = affinity.rotate(g, angle, origin=(0, 0))
    return affinity.translate(g, cx, cy)

def dehole(geom):
    """Split polygons with holes into abutting hole-free pieces (KiCad stores simple outlines faithfully)."""
    from shapely.geometry import Polygon as P, LineString as L
    from shapely.ops import split
    out, todo = [], list(getattr(geom, "geoms", [geom]))
    while todo:
        p = todo.pop()
        if p.is_empty or p.geom_type != "Polygon":
            continue
        if not p.interiors:
            out.append(p); continue
        hx = P(p.interiors[0]).representative_point().x
        cut = L([(hx, p.bounds[1] - 1), (hx, p.bounds[3] + 1)])
        todo.extend(g for g in split(p, cut).geoms)
    return out
