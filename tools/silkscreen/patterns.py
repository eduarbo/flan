"""All-over, one-ink silkscreen patterns drawn on the shared canvas (both halves, back view).

Every pattern returns canvas geometry; compose() clips it to each board around pads, holes,
legends and part bodies. Strokes are 0.30 mm; separate strokes stay ≥ 0.26 mm apart after clipping.
"""
import math
import numpy as np
from shapely.geometry import LineString, Point
from shapely.ops import unary_union
from shapely import affinity
from .prims import fillet, ring
from .canvas import pattern_keepout

W = 0.22

def lines(polylines, w=W):
    ok = [LineString(p) for p in polylines if len(p) > 1]
    return unary_union([l.buffer(w / 2, quad_segs=6, cap_style="round", join_style="round") for l in ok])

def smooth(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)

class Ink:
    """Raster of drawn strokes (0.1 mm) for spacing tests while a pattern grows."""
    def __init__(self, cv, res=0.1, w=0.30, gap=0.38, shrink=0.0):
        from shapely import contains_xy
        self.u0, self.v0, u1, v1 = cv.bounds
        self.res, self.w, self.gap = res, w, gap
        self.nx, self.ny = int((u1 - self.u0) / res) + 3, int((v1 - self.v0) / res) + 3
        X, Y = np.meshgrid(self.u0 + np.arange(self.nx) * res, self.v0 + np.arange(self.ny) * res)
        self.free = contains_xy(cv.allowed().buffer(-(w / 2 + shrink)), X, Y)
        self.ink = np.zeros((self.ny, self.nx), bool)
        r = int(math.ceil((gap + w / 2) / res))
        yy, xx = np.mgrid[-r:r + 1, -r:r + 1]
        self.probe = np.argwhere(np.hypot(xx, yy) * res <= gap + w / 2) - r
        self.probes = {gap: self.probe}
        r2 = int(math.ceil((w / 2) / res))
        yy, xx = np.mgrid[-r2:r2 + 1, -r2:r2 + 1]
        self.stamp_k = np.argwhere(np.hypot(xx, yy) * res <= w / 2) - r2

    def _ij(self, pts):
        a = np.asarray(pts)
        return np.round((a[:, 1] - self.v0) / self.res).astype(int), np.round((a[:, 0] - self.u0) / self.res).astype(int)

    def probe_for(self, gap):
        if gap not in self.probes:
            r = int(math.ceil((gap + self.w / 2) / self.res))
            yy, xx = np.mgrid[-r:r + 1, -r:r + 1]
            self.probes[gap] = np.argwhere(np.hypot(xx, yy) * self.res <= gap + self.w / 2) - r
        return self.probes[gap]

    def clear(self, pts, gap=None):
        probe = self.probe if gap is None else self.probe_for(gap)
        i, j = self._ij(pts)
        if (i < 0).any() or (j < 0).any() or (i >= self.ny).any() or (j >= self.nx).any():
            return False
        if not self.free[i, j].all():
            return False
        ii = (i[:, None] + probe[None, :, 0]).ravel(); jj = (j[:, None] + probe[None, :, 1]).ravel()
        ok = (ii >= 0) & (jj >= 0) & (ii < self.ny) & (jj < self.nx)
        return not self.ink[ii[ok], jj[ok]].any()

    def clear_disk(self, c, radius):
        i, j = self._ij([c])
        r = int(math.ceil(radius / self.res))
        i0, i1, j0, j1 = max(0, i[0] - r), min(self.ny, i[0] + r + 1), max(0, j[0] - r), min(self.nx, j[0] + r + 1)
        yy, xx = np.mgrid[i0:i1, j0:j1]
        m = np.hypot(yy - i[0], xx - j[0]) * self.res <= radius
        return not self.ink[i0:i1, j0:j1][m].any() and bool(self.free[i[0], j[0]])

    def stamp_disk(self, c, radius):
        i, j = self._ij([c])
        r = int(math.ceil(radius / self.res))
        i0, i1, j0, j1 = max(0, i[0] - r), min(self.ny, i[0] + r + 1), max(0, j[0] - r), min(self.nx, j[0] + r + 1)
        yy, xx = np.mgrid[i0:i1, j0:j1]
        self.ink[i0:i1, j0:j1] |= np.hypot(yy - i[0], xx - j[0]) * self.res <= radius

    def stamp(self, pts):
        i, j = self._ij(pts)
        ii = (i[:, None] + self.stamp_k[None, :, 0]).ravel(); jj = (j[:, None] + self.stamp_k[None, :, 1]).ravel()
        ok = (ii >= 0) & (jj >= 0) & (ii < self.ny) & (jj < self.nx)
        self.ink[ii[ok], jj[ok]] = True

def samples(a, b, res=0.1):
    n = max(1, int(math.hypot(b[0] - a[0], b[1] - a[1]) / res))
    return [(a[0] + (b[0] - a[0]) * t / n, a[1] + (b[1] - a[1]) * t / n) for t in range(1, n + 1)]

# ---------------------------------------------------------------------------- 01 ruteo
def ruteo(cv, seed=36, step=0.75, w=0.30, gap=0.40, attempts=26000):
    """Auto-router texture: long octilinear traces with 45° bends, each ending in a via."""
    rng = np.random.default_rng(seed)
    ink = Ink(cv, w=w, gap=gap)
    dirs = [(1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1), (0, -1), (1, -1)]
    u0, v0, u1, v1 = cv.bounds
    paths, vias = [], []
    for _ in range(attempts):
        p = (u0 + rng.integers(0, int((u1 - u0) / step)) * step, v0 + rng.integers(0, int((v1 - v0) / step)) * step)
        if not ink.clear([p]):
            continue
        d = int(rng.choice([0, 4, 2, 6], p=[0.4, 0.4, 0.1, 0.1])) if rng.random() < 0.85 else int(rng.integers(0, 8))
        pts, since = [p], 0
        for _ in range(int(rng.integers(10, 90))):
            if since > 3 and rng.random() < 0.09:
                d = (d + (1 if rng.random() < 0.5 else -1)) % 8
                since = 0
            q = (pts[-1][0] + dirs[d][0] * step, pts[-1][1] + dirs[d][1] * step)
            if not ink.clear(samples(pts[-1], q)):
                break
            pts.append(q); since += 1
        if len(pts) < 6:
            continue
        simp = [pts[0]]
        for a, b in zip(pts[1:-1], pts[2:]):
            p0 = simp[-1]
            if abs((a[0] - p0[0]) * (b[1] - a[1]) - (a[1] - p0[1]) * (b[0] - a[0])) > 1e-9:
                simp.append(a)
        simp.append(pts[-1])
        line = fillet(simp, 0.6)
        ends = [e for e in (pts[-1], pts[0]) if ink.clear_disk(e, VIA_R + w / 2 + gap)]
        for a, b in zip(line, line[1:]):
            ink.stamp(samples(a, b))
        for e in ends:
            ink.stamp_disk(e, VIA_R + 0.15)
        paths.append(line)
        vias += ends
    art = lines(paths, w)
    for c in vias:
        art = art.difference(Point(c).buffer(VIA_R - 0.30, quad_segs=10)).union(ring(c, VIA_R - 0.15, 0.30))
    return art

VIA_R = 0.58      # outer radius of a pattern via ring (0.30 mm ring, 0.56 mm hole)

# ---------------------------------------------------------------------------- 02 bus
BUNDLES = [  # (conductors, octilinear centreline in canvas mm): three buses sweep across both halves
    (18, [(8, 14.0), (58, 14.0), (76, 32.0), (124, 32.0), (140, 16.0), (198, 16.0), (216, 34.0), (282, 34.0)]),
    (12, [(8, 47.0), (34, 47.0), (48, 61.0), (98, 61.0), (114, 45.0), (166, 45.0), (182, 61.0), (282, 61.0)]),
    (23, [(8, 82.0), (64, 82.0), (74, 92.0), (108, 92.0), (124, 76.0), (160, 76.0), (176, 92.0), (282, 92.0)]),
]

def bus(cv, pitch=0.70, w=0.30):
    """Wide parallel buses with concentric 45° bends that cross both halves."""
    art = []
    for n, pts in BUNDLES:
        c = LineString(fillet(pts, 14.0))
        for k in range(n):
            art.append(c.offset_curve((k - (n - 1) / 2) * pitch, quad_segs=32, join_style="round"))
    return lines([list(l.coords) for l in art], w)

# ---------------------------------------------------------------------------- 03 meandro
def meandro(cv, row=3.30, period=3.00, amax=1.25, w=0.30):
    """Rows of length-tuning serpentines; their amplitude swells and dies in slow waves."""
    u0, v0, u1, v1 = cv.bounds
    def amp(u, v):                            # straight runs beside the signature, like traces around a part
        a = math.sin((u - u0) / 46.0 + (v - v0) / 21.0) * math.cos((u - u0) / 97.0 - (v - v0) / 37.0)
        return amax * smooth((abs(a) - 0.12) / 0.6) * cv.calm(u, v)
    rows = []
    v = v0 + 1.2
    while v < v1 + row:
        pts, u, up = [(u0 - 3, v)], u0 - 3, False
        h = period / 2
        while u < u1 + 3:
            a = amp(u + h / 2, v)
            if a < 0.15:
                pts.append((u + h, v)); up = False
            else:
                y = v - a if not up else v + a
                pts += [(u, y), (u + h, y)]
                up = not up
            u += h
        pts.append((u, v))
        rows.append(fillet(pts, 0.42))
        v += row
    return lines(rows, w)

# ---------------------------------------------------------------------------- 04 aislamiento
def aislamiento(cv, w=0.30, pitch=0.80, rings=4):
    """Isolation-milling passes: offset contours around every pad, hole, part and edge."""
    out = []
    for h, b in cv.boards.items():
        feats = pattern_keepout(b).union(b.outline.exterior.buffer(0.55))
        for k in range(rings):
            d = w / 2 + 0.02 + k * pitch
            out.append(cv.to_canvas(feats.buffer(d, quad_segs=16).boundary, h))
    return unary_union([g.buffer(w / 2, quad_segs=6) for g in out])

# ---------------------------------------------------------------------------- 05 campo
def charges(cv):
    out = []
    for h in ("right", "left"):
        keys = cv.keys(h)
        out.append((cv.controller(h), float(len(keys))))
        out += [(k, -1.0) for k in keys]
    return out

def efield(q, u, v):
    """Field of 2-D line charges (∝ 1/r) at one point; q = (positions, strengths) arrays."""
    pos, s = q
    dx, dy = u - pos[:, 0], v - pos[:, 1]
    r2 = dx * dx + dy * dy + 0.09
    return float((s * dx / r2).sum()), float((s * dy / r2).sum())

def campo(cv, w=0.30, sep=1.05, test_gap=0.32, step=0.22, seed=3):
    """Evenly spaced field lines from each controller to its eighteen keys."""
    rng = np.random.default_rng(seed)
    qs = charges(cv)
    q = (np.array([c for c, _ in qs]), np.array([v for _, v in qs]))
    ink = Ink(cv, w=w, gap=sep - w)
    def trace(p, sgn):
        pts = [p]
        for _ in range(1600):
            ex, ey = efield(q, *pts[-1]); n = math.hypot(ex, ey)
            if n < 1e-9:
                break
            mid = (pts[-1][0] + sgn * ex / n * step / 2, pts[-1][1] + sgn * ey / n * step / 2)
            ex, ey = efield(q, *mid); n = math.hypot(ex, ey)
            nxt = (pts[-1][0] + sgn * ex / n * step, pts[-1][1] + sgn * ey / n * step)
            if not ink.clear([nxt], gap=test_gap):
                break
            pts.append(nxt)
        return pts
    seeds = []
    for (c, s) in qs:
        if s > 0:
            seeds += [(c[0] + 13.5 * math.cos(t), c[1] + 13.5 * math.sin(t)) for t in np.linspace(0, 2 * math.pi, 140, endpoint=False)]
    u0, v0, u1, v1 = cv.bounds
    seeds += [(rng.uniform(u0, u1), rng.uniform(v0, v1)) for _ in range(9000)]
    out = []
    for p in seeds:
        if not ink.clear([p]):
            continue
        a, b = trace(p, 1), trace(p, -1)
        line = list(reversed(b)) + a[1:]
        if len(line) * step < 5.0:
            continue
        ink.stamp(line)
        out.append(line)
    return lines(out, w)

# ---------------------------------------------------------------------------- 06 vías
def vias(cv, pitch=2.15, w=0.30):
    """Via stitching as a halftone: rings that shrink to dots along a slow diagonal wave."""
    u0, v0, u1, v1 = cv.bounds
    shapes = []
    r_i = 0
    v = v0
    while v < v1 + pitch:
        u = u0 + (pitch / 2 if r_i % 2 else 0)
        while u < u1 + pitch:
            t = ((u - u0) * 0.80 + (v - v0) * 0.60) / 78.0
            f = (0.5 + 0.5 * math.sin(2 * math.pi * t - 1.0)) * cv.calm(u, v)
            rad = 0.20 + 0.65 * smooth(f)
            c = Point(u, v)
            if cv.hushed(c.buffer(rad + 0.05, quad_segs=4)):     # whole dots only around the signature
                pass
            elif rad >= 0.62:
                shapes.append(c.buffer(rad, quad_segs=8).difference(c.buffer(rad - w, quad_segs=8)))
            else:
                shapes.append(c.buffer(rad, quad_segs=6))
            u += pitch
        v += pitch * math.sqrt(3) / 2
        r_i += 1
    return unary_union(shapes)

# ---------------------------------------------------------------------------- 07 señal
def senal(cv, angle=-28.0, row=2.75, bit=2.0, swing=0.78, w=0.32, text="flan36 "):
    """Stacked digital waveforms; each row spells the ASCII bits of 'flan36'."""
    bits = [int(b) for ch in text.encode() for b in format(ch, "08b")]
    u0, v0, u1, v1 = cv.bounds
    cu, cvv = (u0 + u1) / 2, (v0 + v1) / 2
    R = math.hypot(u1 - u0, v1 - v0) / 2 + 4
    rows, k, y = [], 0, -R
    while y < R:
        i = k * 11
        level = bits[i % len(bits)]
        x = -R
        pts = [(x, y + (swing if level else -swing))]
        while x < R:
            nb = bits[i % len(bits)]
            if nb != level:
                pts += [(x, y + (swing if level else -swing)), (x, y + (swing if nb else -swing))]
                level = nb
            x += bit; i += 1
        pts.append((x, y + (swing if level else -swing)))
        rows.append(fillet(pts, 0.30))
        y += row; k += 1
    art = affinity.rotate(lines(rows, w), angle, origin=(0, 0))
    return affinity.translate(art, cu, cvv)

PATTERNS = {
    "ruteo": ruteo, "bus": bus, "meandro": meandro, "aislamiento": aislamiento,
    "campo": campo, "vias": vias, "senal": senal,
}

def make_valid(g):
    """Repair without losing area (buffer(0) can drop whole lobes of an invalid polygon)."""
    import shapely
    v = shapely.make_valid(g)
    return unary_union([p for p in getattr(v, "geoms", [v]) if p.geom_type in ("Polygon", "MultiPolygon")])

def compose(cv, art, cartouches=None, opening=0.21):
    """Clip canvas art to each board; returns {half: board-coordinate geometry}."""
    out = {}
    if not art.is_valid:                      # boolean-heavy art (rings cut into lattices) can self-touch
        art = make_valid(art)
    for h, b in cv.boards.items():
        keep = pattern_keepout(b)
        if cartouches and h in cartouches:
            keep = keep.union(cartouches[h])
        t = cv.to_board(art, h)
        if not t.is_valid:                    # mirroring can tip near-touching ring/lattice edges into self-contact
            t = make_valid(t)
        a = t.intersection(b.outline.buffer(-0.55)).difference(keep)
        # drop clipping slivers thinner than the minimum stroke, round the cut ends
        a = a.buffer(-opening / 2, quad_segs=6).buffer(opening / 2, quad_segs=6)
        out[h] = spaced([p for p in getattr(a, "geoms", [a]) if p.area > 0.03])
    return out

def spaced(parts, gap=0.26, opening=0.21):
    """Where clipping left two strokes closer than gap, trim the smaller one locally.

    Only the stretch near the larger stroke is removed, so a continuous lattice keeps its
    area. A trimmed stroke can split at a thin neck; its pieces go back into the queue so
    they are checked against everything kept, each other included."""
    import heapq
    from shapely.strtree import STRtree
    kept, tree, dirty = [], None, False
    queue = [(-g.area, i, g) for i, g in enumerate(parts)]
    heapq.heapify(queue)
    n = len(parts)
    while queue:
        _, _, p = heapq.heappop(queue)
        if kept:
            if dirty:
                tree, dirty = STRtree(kept), False
            near = [kept[j] for j in tree.query(p.buffer(gap)) if kept[j].distance(p) < gap]
            if near:
                p = p.difference(unary_union(near).buffer(gap, quad_segs=8))
                p = p.buffer(-opening / 2, quad_segs=6).buffer(opening / 2, quad_segs=6)
                for q in getattr(p, "geoms", [p]):
                    if q.geom_type == "Polygon" and q.area > 0.03:
                        heapq.heappush(queue, (-q.area, n, q)); n += 1
                continue
        kept.append(p); dirty = True
    return unary_union(kept)
