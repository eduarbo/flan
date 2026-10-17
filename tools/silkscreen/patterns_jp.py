"""Kumiko and wagara patterns in PCB language: joints become vias, frets become meanders.

Same contract as patterns.py: each function draws on the shared canvas (both halves from
below) and returns canvas geometry; patterns.compose() clips it to the boards.
"""
import math
import shapely
from shapely.geometry import LineString, Point
from shapely.ops import unary_union
from .patterns import lines, smooth

SQ3 = math.sqrt(3)
G = 0.0002          # fixed-precision overlay grid (mm): rings cut into lattices stay valid

def cut_in(art, nodes, r_out, w):
    """Replace the ink around each node by a via ring of outer radius r_out."""
    if not nodes:
        return art
    holes = unary_union([Point(n).buffer(r_out - w / 2, quad_segs=12) for n in nodes])
    rings = unary_union([via(n, r_out, w) for n in nodes])
    return shapely.union(shapely.difference(art, holes, grid_size=G), rings, grid_size=G)

def rotate_about(segs, angle, origin):
    a = math.radians(angle); c, s_ = math.cos(a), math.sin(a)
    ox, oy = origin
    return [[(ox + (x - ox) * c - (y - oy) * s_, oy + (x - ox) * s_ + (y - oy) * c) for x, y in sg] for sg in segs]

def wave(cv, u, v, period=78.0, direction=(0.80, 0.60), phase=-1.0):
    """The slow diagonal density wave that Vías used, shared so the set reads as one family."""
    u0, v0, _, _ = cv.bounds
    t = ((u - u0) * direction[0] + (v - v0) * direction[1]) / period
    return 0.5 + 0.5 * math.sin(2 * math.pi * t + phase)

def via(c, r_out, w):
    p = Point(c)
    return p.buffer(r_out, quad_segs=12).difference(p.buffer(r_out - w, quad_segs=12))

def span(cv, pad=8.0):
    u0, v0, u1, v1 = cv.bounds
    return u0 - pad, v0 - pad, u1 + pad, v1 + pad

def kumiko(segments, slat=1.10, w=0.22, joints=(), hole=0.46):
    """Draw wooden slats by their outline, as a kumiko panel reads. Joints get a via hole."""
    wood = unary_union([LineString(sg).buffer(slat / 2, quad_segs=4, cap_style="square", join_style="mitre")
                        for sg in segments])
    if joints:
        wood = shapely.difference(wood, unary_union([Point(j).buffer(hole, quad_segs=12) for j in joints]), grid_size=G)
    outline = wood.boundary
    return outline.buffer(w / 2, quad_segs=6, cap_style="round", join_style="round")

# ---------------------------------------------------------------------------- 01 asanoha
def asanoha(cv, a=7.2, slat=1.05, w=0.22):
    """Kumiko asanoha on a triangular jigumi, drawn by slat outlines. A halftone wave decides
    per triangle whether it stays open, shows only its frame, or gets the hemp-leaf spokes.
    Each frame joint holds a via."""
    u0, v0, u1, v1 = span(cv)
    h = a * SQ3 / 2
    P = lambda i, j: (i * a + j * a / 2, j * h)
    tris = []
    for j in range(int(v0 / h) - 1, int(v1 / h) + 2):
        for i in range(int((u0 - j * a / 2) / a) - 2, int((u1 - j * a / 2) / a) + 2):
            tris.append((P(i, j), P(i + 1, j), P(i, j + 1)))
            tris.append((P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)))
    edges, spokes, nodes = {}, [], set()
    key = lambda p: (round(p[0], 4), round(p[1], 4))
    for t in tris:
        c = (sum(p[0] for p in t) / 3, sum(p[1] for p in t) / 3)
        d = wave(cv, *c)
        if d < 0.18:
            continue
        for a_, b_ in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])):
            edges[tuple(sorted((key(a_), key(b_))))] = (a_, b_)
        nodes.update(key(p) for p in t)
        if d > 0.46:
            spokes += [(p, c) for p in t]
    return kumiko([list(e) for e in edges.values()] + [list(s_) for s_ in spokes], slat, w, joints=list(nodes))

# ---------------------------------------------------------------------------- 02 sayagata
def sayagata(cv, s=2.3, w=0.30, node=0.62, angle=45.0):
    """The Japanese key fret: interlocking manji drawn as one continuous meander,
    set on the diagonal. Each manji centre, where four arms cross, is a via."""
    u0, v0, u1, v1 = cv.bounds
    cu, cvv = (u0 + u1) / 2, (v0 + v1) / 2
    R = math.hypot(u1 - u0, v1 - v0) / 2 + 6
    b1, b2 = (s, 2 * s), (2 * s, -s)                    # lattice on which hooks meet arms
    n = int(R / s) + 3
    dirs = [(1, 0), (0, 1), (-1, 0), (0, -1)]
    segs, centres = [], []
    for i in range(-n, n + 1):
        for j in range(-n, n + 1):
            c = (i * b1[0] + j * b2[0], i * b1[1] + j * b2[1])
            if abs(c[0]) > R or abs(c[1]) > R:
                continue
            centres.append(c)
            for dx, dy in dirs:
                arm = (c[0] + s * dx, c[1] + s * dy)
                hook = (arm[0] - s * dy, arm[1] + s * dx)
                segs.append([c, arm, hook])
    segs = rotate_about([[(x + cu, y + cvv) for x, y in sg] for sg in segs], angle, (cu, cvv))
    centres = rotate_about([[(x + cu, y + cvv) for x, y in centres]], angle, (cu, cvv))[0]
    return cut_in(lines(segs, w), centres, node, 0.24)

# ---------------------------------------------------------------------------- 03 kikkō
def kikko(cv, R=4.7, slat=1.0, w=0.22):
    """Kikkō kumiko: a hexagonal jigumi drawn by slat outlines. Along the halftone wave a
    shell stays open, gets a mitsukude (three spokes) or a full six-spoke star; joints and
    every star centre are vias."""
    u0, v0, u1, v1 = span(cv)
    hx, hy = 1.5 * R, SQ3 * R
    edges, spokes, joints = {}, [], set()
    key = lambda p: (round(p[0], 4), round(p[1], 4))
    for i in range(int(u0 / hx) - 1, int(u1 / hx) + 2):
        for j in range(int(v0 / hy) - 1, int(v1 / hy) + 2):
            c = (i * hx, j * hy + (hy / 2 if i % 2 else 0))
            d = wave(cv, *c)
            if d < 0.16:
                continue
            pts = [(c[0] + R * math.cos(math.radians(60 * k)), c[1] + R * math.sin(math.radians(60 * k))) for k in range(6)]
            for k in range(6):
                a_, b_ = pts[k], pts[(k + 1) % 6]
                edges[tuple(sorted((key(a_), key(b_))))] = (a_, b_)
            joints.update(key(p_) for p_ in pts)
            if d > 0.72:
                spokes += [(c, p_) for p_ in pts]
                joints.add(key(c))
            elif d > 0.42:
                spokes += [(c, pts[k]) for k in (0, 2, 4)]
                joints.add(key(c))
    return kumiko([list(e) for e in edges.values()] + [list(s_) for s_ in spokes], slat, w, joints=list(joints))

# ---------------------------------------------------------------------------- 04 seigaiha
def seigaiha(cv, R=5.8, w=0.28, gap=0.30):
    """Blue-sea waves: overlapping fans of concentric traces. Between the inner arcs runs
    a row of via stitching, and every fan's centre is a via. Each fan is cut only by the
    fans of the rows below it, which overlap it."""
    u0, v0, u1, v1 = span(cv)
    rows = {}
    for k in range(int(v0 / (R / 2)) - 2, int(v1 / (R / 2)) + 3):
        rows[k] = [(i * 2 * R + (R if k % 2 else 0), k * R / 2)
                   for i in range(int(u0 / (2 * R)) - 2, int(u1 / (2 * R)) + 3)]
    shield = R + w / 2 + gap
    out = []
    for k, centres in rows.items():
        for c in centres:
            rings = [Point(c).buffer(r, quad_segs=24).exterior.buffer(w / 2, quad_segs=4) for r in (R, R * 0.76, R * 0.52)]
            rr = R * 0.30
            n = max(6, int(2 * math.pi * rr / 1.15))
            stitch = [Point(c[0] + rr * math.cos(2 * math.pi * m / n), c[1] + rr * math.sin(2 * math.pi * m / n)).buffer(0.30, quad_segs=6)
                      for m in range(n)]
            fan = unary_union(rings + stitch + [Point(c).buffer(0.55, quad_segs=10)])
            cover = [Point(c2).buffer(shield, quad_segs=24) for k2 in range(k + 1, k + 5) for c2 in rows.get(k2, ())
                     if math.hypot(c2[0] - c[0], c2[1] - c[1]) < R + shield]
            if cover:
                fan = shapely.difference(fan, unary_union(cover), grid_size=G)
            out.append(fan)
    return unary_union(out)

# ---------------------------------------------------------------------------- 05 shippō
def shippo(cv, R=4.8, w=0.26, node=0.85):
    """Seven treasures: interlocking circles. Where four arcs meet sits a via; each
    four-petal flower centre carries a dot that swells with the halftone wave."""
    u0, v0, u1, v1 = span(cv)
    d = R * math.sqrt(2)
    rings, nodes, centres = [], set(), []
    for i in range(int(u0 / d) - 1, int(u1 / d) + 2):
        for j in range(int(v0 / d) - 1, int(v1 / d) + 2):
            c = (i * d, j * d)
            rings.append(Point(c).buffer(R, quad_segs=24).exterior)
            nodes.add((round(c[0] + d / 2, 4), round(c[1] + d / 2, 4)))
            centres.append(c)
    art = cut_in(unary_union([r.buffer(w / 2, quad_segs=4) for r in rings]), list(nodes), node, w)
    # flower centres: the petals' shared middle, between four circles
    dots = []
    for c in centres:
        for q in ((c[0] + d / 2, c[1]), (c[0], c[1] + d / 2)):
            f = smooth(wave(cv, *q))
            if f > 0.15:
                dots.append(Point(q).buffer(0.22 + 0.48 * f, quad_segs=10))
    return shapely.union(art, unary_union(dots), grid_size=G)

PATTERNS = {"asanoha": asanoha, "kikko": kikko, "sayagata": sayagata,
            "seigaiha": seigaiha, "shippo": shippo}
