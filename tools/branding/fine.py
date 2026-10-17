"""Fine-line marks for naming R2, built as precise geometry in a 100 × 100 box (y down).

Each mark returns a list of (shapely line geometry, stroke width) layers for display, and
solid() turns the same construction into filled outlines for small or printed use.
"""
import math
from shapely.geometry import LineString, Point, box
from shapely.ops import unary_union
from shapely import affinity

def _pts(geom):
    return [list(g.coords) for g in getattr(geom, "geoms", [geom]) if not g.is_empty and g.length > 0]

def path(geom):
    return " ".join("M" + " L".join(f"{x:.3f},{y:.3f}" for x, y in seg) for seg in _pts(geom))

def solid(layers, scale=1.0):
    return unary_union([g.buffer(w * scale / 2, quad_segs=12, cap_style="round", join_style="round") for g, w in layers])

# ---------------------------------------------------------------------------- Kumi: asanoha, split
def kumi(split=True, frame=2.4, piece=1.25, gap=4.2):
    """Asanoha kumiko in a pointy-top hexagon: a heavier frame (jigumi) holds lighter pieces.
    With split, a clean vertical gap parts the hexagon into the keyboard's two halves."""
    c = (50.0, 50.0)
    R = 45.0
    V = [(c[0] + R * math.cos(math.radians(-90 + 60 * k)), c[1] + R * math.sin(math.radians(-90 + 60 * k))) for k in range(6)]
    frame_l = LineString(V + [V[0]])
    pieces = []
    for k in range(6):
        a, b = V[k], V[(k + 1) % 6]
        g = ((c[0] + a[0] + b[0]) / 3, (c[1] + a[1] + b[1]) / 3)
        pieces += [LineString([c, a]), LineString([a, g]), LineString([b, g]), LineString([c, g])]
    inner = unary_union(pieces)
    layers = [(frame_l, frame), (inner, piece)]
    if split:
        layers = split_layers(layers, gap)
    return layers

def split_layers(layers, gap, shift=0.8, shortest=3.0):
    """Part a symmetric mark down its vertical axis: the keyboard's two halves."""
    keep_l, keep_r = box(-50, -50, 50 - gap / 2, 150), box(50 + gap / 2, -50, 150, 150)
    out = []
    for g, w in layers:
        parts = [affinity.translate(g.intersection(keep_l), -shift, 0), affinity.translate(g.intersection(keep_r), shift, 0)]
        segs = [q for part in parts for q in getattr(part, "geoms", [part]) if q.length >= shortest]
        out.append((unary_union(segs), w))
    return out

def kumi_key(frame=2.4, piece=1.25, inset=0.58, star=True):
    """Mitsukude, the three-way kumiko joint, read as a cube: a key seen from above.
    The inset rhombus is the keycap's top face."""
    c = (50.0, 50.0)
    R = 45.0
    V = [(c[0] + R * math.cos(math.radians(-90 + 60 * k)), c[1] + R * math.sin(math.radians(-90 + 60 * k))) for k in range(6)]
    top, ur, lr, bottom, ll, ul = V
    y = unary_union([LineString([c, bottom]), LineString([c, ul]), LineString([c, ur])])
    face = [c, ul, top, ur]
    fc = (sum(p[0] for p in face) / 4, sum(p[1] for p in face) / 4)
    cap = [(fc[0] + (p[0] - fc[0]) * inset, fc[1] + (p[1] - fc[1]) * inset) for p in face]
    layers = [(LineString(V + [V[0]]), frame), (y, piece), (LineString(cap + [cap[0]]), piece)]
    if star:      # the keycap's top is an asanoha rhombus: two triangles, three spokes each
        a, b, c2, d = cap                         # near corner, left, far corner, right
        lines = [LineString([a, c2])]
        for t in ((a, c2, b), (a, c2, d)):
            g = (sum(q[0] for q in t) / 3, sum(q[1] for q in t) / 3)
            lines += [LineString([q, g]) for q in t]
        layers.append((unary_union(lines), piece * 0.85))
    return layers

def kumi_mon(frame=2.4, piece=1.25, radius=45.0):
    """Asanoha in a circle, the way it appears on a family crest: the star's tips touch the ring."""
    c = (50.0, 50.0)
    R = radius - frame * 0.9
    V = [(c[0] + R * math.cos(math.radians(-90 + 60 * k)), c[1] + R * math.sin(math.radians(-90 + 60 * k))) for k in range(6)]
    pieces = []
    for k in range(6):
        a, b = V[k], V[(k + 1) % 6]
        g = ((c[0] + a[0] + b[0]) / 3, (c[1] + a[1] + b[1]) / 3)
        pieces += [LineString([c, a]), LineString([a, g]), LineString([b, g]), LineString([c, g])]
    return [(Point(c).buffer(radius, quad_segs=96).exterior, frame), (unary_union(pieces), piece)]

# ---------------------------------------------------------------------------- Seda: seigaiha crest
def seda(R=21.0, rings=4, w=1.2, frame=2.4, radius=45.0, inset=3.6, shortest=7.0):
    """A seigaiha field held in a circle, like a family crest (mon). Rows are drawn top to
    bottom so each fan hides the part of the row above that it covers."""
    c = (50.0, 50.0)
    field = Point(c).buffer(radius - inset, quad_segs=96)
    lines = None
    rows = range(-int(60 / (R / 2)) - 1, int(60 / (R / 2)) + 2)
    for k in rows:                    # lattice centred on the crest: one fan sits on the axis
        y = 50.0 + R * 0.25 + k * R / 2
        for i in range(-int(60 / (2 * R)) - 2, int(60 / (2 * R)) + 3):
            x = 50.0 + i * 2 * R + (R if k % 2 else 0)
            fan = []
            for m in range(rings):
                r = R * (1 - m / rings) - w * 0.2
                fan.append(Point(x, y).buffer(r, quad_segs=64).exterior)
            fan = unary_union(fan)
            if lines is not None:
                lines = lines.difference(Point(x, y).buffer(R + w * 1.2, quad_segs=64))
                lines = unary_union([lines, fan])
            else:
                lines = fan
    lines = lines.intersection(field)
    lines = unary_union([g for g in getattr(lines, "geoms", [lines]) if g.length >= shortest])   # no crumbs at the rim
    return [(Point(c).buffer(radius, quad_segs=96).exterior, frame), (lines, w)]

# ---------------------------------------------------------------------------- Telar: diagonal weave
def woven(n=3, band=11.5, gap=2.2, span=64.0, margin=4.0, corner=0.0):
    """Warp and weft ribbons interlaced inside a square (or rounded) frame, drawn by their
    edges. Where a ribbon dips under another its ends stay open, so it reads as one ribbon."""
    s0 = (100 - span) / 2
    xs = [s0 + span * (i + 0.5) / n for i in range(n)]
    warp = [box(x - band / 2, s0 - 8, x + band / 2, s0 + span + 8) for x in xs]
    weft = [box(s0 - 8, y - band / 2, s0 + span + 8, y + band / 2) for y in xs]
    full_warp, full_weft = list(warp), list(weft)
    openings = []
    for i, x in enumerate(xs):
        for j, y in enumerate(xs):
            if (i + j) % 2 == 0:       # warp over weft
                cut = box(x - band / 2 - gap, y - band, x + band / 2 + gap, y + band)
                weft[j] = weft[j].difference(cut)
                openings.append(cut.buffer(0.05).difference(full_warp[i].buffer(0.25)))
            else:
                cut = box(x - band, y - band / 2 - gap, x + band, y + band / 2 + gap)
                warp[i] = warp[i].difference(cut)
                openings.append(cut.buffer(0.05).difference(full_weft[j].buffer(0.25)))
    tile = box(s0 + corner, s0 + corner, s0 + span - corner, s0 + span - corner).buffer(corner, quad_segs=24) if corner else box(s0, s0, s0 + span, s0 + span)
    inner = box(s0, s0, s0 + span, s0 + span).buffer(-(margin + corner * 0.32), join_style="mitre")
    ribbons = unary_union([g.intersection(inner) for g in warp + weft])
    ribbons = unary_union([q for q in getattr(ribbons, "geoms", [ribbons]) if q.area > 8])
    return ribbons.boundary.difference(unary_union(openings)), tile.exterior

def telar(n=3, band=11.5, gap=2.2, w=1.2, frame=2.4, margin=4.0):
    """The woven key on the diagonal: a square of interlaced ribbons standing on its point."""
    edges, tile = woven(n, band, gap, 64.0, margin)
    return [(affinity.rotate(g, 45, origin=(50, 50)), lw) for g, lw in ((edges, w), (tile, frame))]

def telar_key(n=3, band=12.5, gap=2.4, w=1.2, frame=2.4, margin=4.2, corner=12.0):
    """A keycap in plan: rounded square, woven straight."""
    edges, tile = woven(n, band, gap, 76.0, margin, corner)
    return [(edges, w), (tile, frame)]

def telar_warp(warps=7, band=10.0, gap=2.2, w=1.25, rib=1.25, top=18.0, bottom=82.0, left=20.0, right=80.0, rows=(39.0, 61.0)):
    """Warp threads on the loom with weft ribbons passing over and under, in opposite phase."""
    xs = [left + (right - left) * i / (warps - 1) for i in range(warps)]
    threads = [LineString([(x, top), (x, bottom)]) for x in xs]
    hide, opens, ribbons = [], [], []
    ex = 6.5
    for r, yc in enumerate(rows):
        y0, y1 = yc - band / 2, yc + band / 2
        outline = LineString([(left - ex, y0), (right + ex, y0), (right + ex, y1), (left - ex, y1), (left - ex, y0)])
        for i, x in enumerate(xs):
            if (i + r) % 2 == 0:
                hide.append(box(x - 1, y0 - gap, x + 1, y1 + gap))
            else:
                opens.append(box(x - gap, y0 - 1, x + gap, y1 + 1))
        ribbons.append(outline)
    threads = unary_union(threads).difference(unary_union(hide))
    edges = unary_union(ribbons).difference(unary_union(opens))
    return [(threads, w), (edges, rib)]

# ---------------------------------------------------------------------------- Flan
def _fillet(points, r):
    from silkscreen.prims import fillet
    return fillet(points, r)

def drip_path(y, x0, x1, drips, leg=2.1, bulb=3.0, r=1.6):
    """A caramel edge at height y from x0 to x1, dripping at each (x, depth): narrow legs that
    swell into a round drop, like the Caramelo silkscreen."""
    pts = [(x0, y)]
    for cx, yd in drips:
        n = 10
        sm = lambda t: t * t * (3 - 2 * t)
        left = [(cx - (leg + (bulb - leg) * sm(i / n)), y + (yd - y) * i / n) for i in range(n + 1)]
        arc = [(cx + bulb * math.cos(math.radians(a)), yd + bulb * math.sin(math.radians(a))) for a in range(180, -1, -10)][1:-1]
        right = [(2 * cx - px, py) for px, py in reversed(left)]
        pts += [(cx - leg - r, y)] + left + arc + right + [(cx + leg + r, y)]
    pts.append((x1, y))
    return LineString(_fillet(pts, r))

def flan_profile(base=76.0, top=36.0, bl=13.0, br=87.0, tl=23.0, tr=77.0, r=7.0):
    body = _fillet([(bl, base), (tl, top), (tr, top), (br, base)], r)
    return LineString(body + [(bl, base)])

def side_x(y, a, b):
    (x0, y0), (x1, y1) = a, b
    return x0 + (x1 - x0) * (y - y0) / (y1 - y0)

def flan(frame=2.4, piece=1.25, plate=True, drips=((33.0, 57.0), (45.0, 52.0), (64.0, 62.0)), level=46.0, leg=1.35, bulb=2.9):
    """Flan in profile: the custard's outline, the caramel edge dripping down its face, a plate."""
    body = flan_profile()
    x0, x1 = side_x(level, (13, 76), (23, 36)), side_x(level, (87, 76), (77, 36))
    caramel = drip_path(level, x0 + piece, x1 - piece, drips, leg=leg, bulb=bulb)
    layers = [(body, frame), (caramel, piece)]
    if plate:
        layers.append((LineString([(4, 83), (96, 83)]), frame))
    return layers

def flan_key(frame=2.4, piece=1.25, drips=((32.0, 55.0), (44.0, 50.5), (64.0, 59.0)), leg=1.35, bulb=2.9):
    """A Choc keycap in profile is already a flan: dished top, caramel drips, two Choc stems."""
    top = [(20, 38), (35, 39.6), (50, 40.1), (65, 39.6), (80, 38)]
    body = _fillet([(14, 68)] + top + [(86, 68)], 5.0)
    cap = LineString(body + [(14, 68)])
    level = 45.5
    x0, x1 = side_x(level, (14, 68), (20, 38)), side_x(level, (86, 68), (80, 38))
    caramel = drip_path(level, x0 + piece, x1 - piece, drips, leg=leg, bulb=bulb)
    stems = unary_union([LineString([(x, 68), (x, 78)]) for x in (44.0, 56.0)])
    return [(cap, frame), (caramel, piece), (stems, frame)]

def flan_mon(frame=2.4, piece=1.25, radius=45.0, n=12, base=34.0, pool=26.0, wave=1.6):
    """The flan from above, held in a circle like a crest: the custard's rim and the caramel
    pool with its softly scalloped edge."""
    c = (50.0, 50.0)
    pts = []
    for i in range(1441):
        t = 2 * math.pi * i / 1440
        rr = pool + wave * math.cos(n * t)
        pts.append((c[0] + rr * math.cos(t), c[1] + rr * math.sin(t)))
    return [(Point(c).buffer(radius, quad_segs=96).exterior, frame),
            (Point(c).buffer(base, quad_segs=96).exterior, piece), (LineString(pts), piece)]

def flan_split(gap=5.0, drips=((31.0, 57.0), (41.0, 52.0), (63.0, 61.0)), **kw):
    """The flan cut in two, like the keyboard; the drips stay clear of the cut."""
    return split_layers(flan(drips=drips, **kw), gap, shift=0.8)

MARKS = {"kumi": lambda: kumi(split=False), "kumi-split": kumi, "kumi-key": kumi_key, "kumi-mon": kumi_mon,
         "seda": seda,
         "telar": telar, "telar-key": telar_key, "telar-warp": telar_warp,
         "flan": flan, "flan-key": flan_key, "flan-mon": flan_mon, "flan-split": flan_split}

# heavier, sparser constructions for silkscreen and small relief (≈6–10 mm)
SMALL = {"kumi": lambda: kumi(split=False, frame=5.2, piece=3.6),
         "kumi-split": lambda: kumi(frame=5.2, piece=3.6, gap=7.0),
         "seda": lambda: seda(R=30.0, rings=3, w=3.6, frame=5.2, inset=6.0, shortest=8.0),
         "telar": lambda: telar(band=12.5, gap=3.2, w=3.2, frame=5.2, margin=5.5),
         "kumi-key": lambda: kumi_key(frame=5.2, piece=3.8, inset=0.52, star=False),
         "kumi-mon": lambda: kumi_mon(frame=5.2, piece=3.2),
         "telar-key": lambda: telar_key(band=14.0, gap=3.4, w=3.2, frame=5.2, margin=6.0),
         "telar-warp": lambda: telar_warp(warps=5, band=13.0, gap=4.0, w=3.6, rib=3.6, rows=(37.0, 63.0)),
         "flan": lambda: flan(frame=5.2, piece=3.8, drips=((37.0, 61.0), (62.0, 57.0)), leg=3.2, bulb=4.6),
         "flan-key": lambda: flan_key(frame=5.2, piece=3.8, drips=((36.0, 59.0), (62.0, 56.0)), leg=3.2, bulb=4.6),
         "flan-mon": lambda: flan_mon(frame=5.2, piece=3.6, n=8, pool=24.0, wave=2.6),
         "flan-split": lambda: split_layers(flan(frame=5.2, piece=3.8, drips=((33.0, 61.0), (66.0, 58.0)), leg=3.2, bulb=4.6), 8.0, 1.0)}
