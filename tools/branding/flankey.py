"""Tecla-flan marks: a low-profile keycap read as a flan. Filled geometry in a 100 × 100 box (y down).

Curves are built from tangent arcs and smoothed with morphological closing, so every join
between caramel and drip has a real fillet. Each variant takes a `small` flag that thickens
strokes and drops a drip for the 6–10 mm back-silkscreen plate.
"""
import math
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union
from shapely import affinity

Q = 32   # arc resolution

def rounded(points, radii):
    """Closed polygon through `points` with a tangent arc of radius radii[i] at each corner."""
    n = len(points)
    out = []
    for i in range(n):
        p0, p1, p2 = points[i - 1], points[i], points[(i + 1) % n]
        r = radii[i]
        v1 = (p0[0] - p1[0], p0[1] - p1[1]); v2 = (p2[0] - p1[0], p2[1] - p1[1])
        l1, l2 = math.hypot(*v1), math.hypot(*v2)
        u1, u2 = (v1[0] / l1, v1[1] / l1), (v2[0] / l2, v2[1] / l2)
        ang = math.acos(max(-1, min(1, u1[0] * u2[0] + u1[1] * u2[1])))
        if r <= 0 or ang > math.pi - 1e-6:
            out.append(p1); continue
        t = min(r / math.tan(ang / 2), l1 / 2, l2 / 2)
        r = t * math.tan(ang / 2)
        a = (p1[0] + u1[0] * t, p1[1] + u1[1] * t); b = (p1[0] + u2[0] * t, p1[1] + u2[1] * t)
        bis = (u1[0] + u2[0], u1[1] + u2[1]); lb = math.hypot(*bis)
        d = r / math.sin(ang / 2)
        c = (p1[0] + bis[0] / lb * d, p1[1] + bis[1] / lb * d)
        a0 = math.atan2(a[1] - c[1], a[0] - c[0]); a1 = math.atan2(b[1] - c[1], b[0] - c[0])
        da = (a1 - a0 + math.pi) % (2 * math.pi) - math.pi
        out += [(c[0] + r * math.cos(a0 + da * k / Q), c[1] + r * math.sin(a0 + da * k / Q)) for k in range(Q + 1)]
    return Polygon(out)

def close(g, r):
    return g.buffer(r, quad_segs=Q).buffer(-r, quad_segs=Q)

def open_(g, r):
    return g.buffer(-r, quad_segs=Q).buffer(r, quad_segs=Q)

def line(pts, w):
    return LineString(pts).buffer(w / 2, quad_segs=Q, cap_style="round", join_style="round")

# ---------------------------------------------------------------------------- the cap
def cap(left=13.0, right=87.0, bottom=70.0, top=35.0, shoulder=9.0, top_r=10.0, foot_r=2.6, dish=2.6):
    """A low-profile keycap in profile, flan-proportioned: drafted sides, generous shoulders,
    a shallow dish in the top and a crisp foot."""
    body = rounded([(left, bottom), (left + shoulder, top), (right - shoulder, top), (right, bottom)],
                   [foot_r, top_r, top_r, foot_r])
    if dish:
        R = 220.0                                   # the dish is a shallow arc of a large circle
        cy = top + dish - R
        body = body.difference(Point(50, cy).buffer(R, quad_segs=720))
        body = open_(body, 2.2)                     # soften where the dish meets the shoulders
    return body

def caramel(body, level, drips, neck=0.72, fillet=2.4):
    """The caramel glaze: everything above `level`, plus teardrop drips (x, radius, depth)."""
    x0, y0, x1, y1 = body.bounds
    glaze = box(x0 - 5, y0 - 5, x1 + 5, level)
    tongues = []
    for x, r, depth in drips:
        tongues.append(unary_union([Point(x, level - 1).buffer(r * neck, quad_segs=Q),
                                    Point(x, depth - r).buffer(r, quad_segs=Q)]).convex_hull)
    return close(unary_union([glaze] + tongues), fillet).intersection(body)

def plate(y=78.5, left=3.0, right=97.0, w=3.0):
    return line([(left, y), (right, y)], w)

# ---------------------------------------------------------------------------- the variants
def glaseado(small=False):
    """Outline custard, solid caramel, a plate."""
    w = 5.0 if small else 2.8
    b = cap()
    drips = [(31, 3.8, 58), (64, 4.4, 61)] if small else [(29, 3.2, 56), (45, 2.5, 51), (63, 3.9, 61)]
    c = caramel(b, 45.5, drips)
    ring = b.exterior.buffer(w / 2, quad_segs=Q)
    return unary_union([ring, c, plate(80.0 if small else 78.5, w=w)])

def solido(small=False):
    """A solid flan; the caramel edge is a cut through it. Strongest at small sizes."""
    gap = 4.0 if small else 2.6
    b = cap()
    drips = [(31, 4.0, 58), (64, 4.6, 61)] if small else [(29, 3.2, 56), (45, 2.5, 51), (63, 3.9, 61)]
    c = caramel(b, 45.5, drips)
    edge = c.boundary.difference(b.exterior.buffer(0.6))
    body = b.difference(edge.buffer(gap / 2, quad_segs=Q, cap_style="flat"))
    return unary_union([body, line([(3, 80.5 if small else 79.0), (97, 80.5 if small else 79.0)], 4.6 if small else 3.4)])

def patitas(small=False):
    """The keycap gag made explicit: the flan stands on two Choc stems instead of a plate."""
    w = 5.0 if small else 2.8
    b = cap(bottom=66.0, top=33.0)
    drips = [(31, 3.8, 55), (64, 4.4, 58)] if small else [(29, 3.2, 53), (45, 2.5, 48.5), (63, 3.9, 58)]
    c = caramel(b, 43.0, drips)
    ring = b.exterior.buffer(w / 2, quad_segs=Q)
    sw, sh = (7.0, 9.0) if small else (5.6, 8.0)
    stems = [box(x - sw / 2, 66.0, x + sw / 2, 66.0 + sh).buffer(0) for x in (40.0, 60.0)]
    stems = [open_(s.union(box(s.bounds[0], 60, s.bounds[2], 67)), min(sw / 2 - 0.2, 2.2)).difference(b) for s in stems]
    return unary_union([ring, c] + stems)

def un_trazo(small=False):
    """The plate line rises into the flan and returns to the plate: no base under the custard."""
    w = 5.0 if small else 2.8
    b = cap()
    upper = b.exterior.difference(box(0, 68.6, 100, 100))
    stroke = unary_union([upper.buffer(w / 2, quad_segs=Q, cap_style="round"), line([(3.0, 70.0), (97.0, 70.0)], w)])
    drips = [(31, 3.8, 58), (64, 4.4, 61)] if small else [(29, 3.2, 56), (45, 2.5, 51), (63, 3.9, 61)]
    c = caramel(b, 45.5, drips)
    return close(unary_union([stroke, c]), 0.8)

def linea(small=False):
    """All line: the custard's outline and the caramel's edge drawn as a single fine stroke."""
    w = 5.0 if small else 2.4
    b = cap()
    drips = [(31, 4.2, 58), (64, 4.8, 61)] if small else [(29, 3.4, 56), (45, 2.7, 51), (63, 4.1, 61)]
    c = caramel(b, 45.5, drips)
    edge = c.boundary.difference(b.exterior.buffer(w * 0.3))
    parts = [b.exterior.buffer(w / 2, quad_segs=Q), edge.buffer(w / 2, quad_segs=Q, cap_style="round"),
             plate(80.0 if small else 78.5, w=w)]
    return unary_union(parts)

def iso(small=False):
    """A keycap in three-quarter view: caramel pooled on the top face, dripping down the
    two front faces."""
    w = 5.0 if small else 2.8
    c30, s30 = math.cos(math.radians(30)), math.sin(math.radians(30))
    def proj(x, y, z):
        return ((x - y) * c30, (x + y) * s30 - z)
    def ring_pts(half, r, z):
        sq = rounded([(-half, -half), (half, -half), (half, half), (-half, half)], [r] * 4)
        return [proj(x, y, z) for x, y in sq.exterior.coords]
    H = 8.6
    top = Polygon(ring_pts(7.2, 2.6, H))
    bot = Polygon(ring_pts(9.0, 1.6, 0))
    sil = unary_union([top, bot]).convex_hull
    # front corner edge
    fc_top = proj(7.2 - 2.6 + 2.6 * math.cos(math.radians(45)), 7.2 - 2.6 + 2.6 * math.sin(math.radians(45)), H)
    fc_bot = proj(9.0 - 1.6 + 1.6 * math.cos(math.radians(45)), 9.0 - 1.6 + 1.6 * math.sin(math.radians(45)), 0)
    # caramel: top face, a band below its front edges, and vertical drips on the front faces
    band = unary_union([top, affinity.translate(top, 0, 1.4)])
    drip_specs = [(-0.62, 1.15, 5.4), (-0.22, 0.85, 3.6), (0.30, 1.05, 6.2), (0.70, 0.8, 3.9)]
    if small:
        drip_specs = [(-0.5, 1.4, 5.2), (0.42, 1.4, 5.8)]
    tongues = []
    for t, r, depth in drip_specs:
        # a point along the front edges of the top face (t in -1..1, 0 = front corner)
        # front-left edge: y = 7.2, x from -7.2 (t = -1) to 7.2; front-right edge: x = 7.2
        p = proj(7.2 + 14.4 * t, 7.2, H) if t < 0 else proj(7.2, 7.2 - 14.4 * t, H)
        x, y = p
        y_edge = y + 0.4
        tongues.append(unary_union([Point(x, y_edge).buffer(r * 0.75, quad_segs=Q),
                                    Point(x, y_edge + depth).buffer(r, quad_segs=Q)]).convex_hull)
    car = close(unary_union([band] + tongues), 0.9).intersection(sil)
    edge = LineString([fc_top, fc_bot])
    # scale into the box
    g_sil, g_car, g_edge = sil, car, edge
    allg = unary_union([g_sil])
    bx0, by0, bx1, by1 = allg.bounds
    s = 84.0 / max(bx1 - bx0, by1 - by0)
    tf = lambda g: affinity.translate(affinity.scale(g, s, s, origin=((bx0 + bx1) / 2, (by0 + by1) / 2)),
                                      50 - (bx0 + bx1) / 2, 50 - (by0 + by1) / 2)
    g_sil, g_car, g_edge = tf(g_sil), tf(g_car), tf(g_edge)
    outline = g_sil.exterior.buffer(w / 2, quad_segs=Q)
    front = g_edge.difference(g_car).buffer(w / 2, quad_segs=Q, cap_style="round")
    return unary_union([outline, g_car, front])

VARIANTS = {
    "glaseado": ("Glaseado", "Flan de perfil sobre su plato: contorno fino y caramelo sólido.", glaseado),
    "solido": ("Sólido", "Una sola masa; el borde del caramelo es un corte. Es la que mejor aguanta a 6 mm.", solido),
    "patitas": ("Patitas", "El chiste explícito: el flan se para sobre las dos patitas de un switch Choc.", patitas),
    "un-trazo": ("Un trazo", "Una sola línea dibuja el plato, sube por el flan y vuelve al plato.", un_trazo),
    "iso": ("Tres cuartos", "La tecla en perspectiva: el caramelo cubre la cara superior y escurre por el frente.", iso),
    "linea": ("Línea", "Todo en trazo fino: el contorno del flan y el borde del caramelo.", linea),
}
