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
        keep_l = box(0, 0, 50 - gap / 2, 100)
        keep_r = box(50 + gap / 2, 0, 100, 100)
        out = []
        for g, w in layers:
            l = g.intersection(keep_l); r = g.intersection(keep_r)
            out.append((unary_union([affinity.translate(l, -0.8, 0), affinity.translate(r, 0.8, 0)]), w))
        layers = out
    return layers

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
def telar(n=3, band=11.5, gap=2.2, w=1.2, frame=2.4, margin=4.0):
    """Warp and weft ribbons interlaced on the diagonal, drawn by their edges like woven
    cane, inside a square frame: the key. Where a ribbon dips under another its ends stay
    open, so it reads as one ribbon passing beneath."""
    span = 64.0
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
    tile = box(s0, s0, s0 + span, s0 + span)
    inner = tile.buffer(-margin, join_style="mitre")
    ribbons = unary_union([g.intersection(inner) for g in warp + weft])
    ribbons = unary_union([q for q in getattr(ribbons, "geoms", [ribbons]) if q.area > 8])
    edges = ribbons.boundary.difference(unary_union(openings))
    layers = [(edges, w), (tile.exterior, frame)]
    return [(affinity.rotate(g, 45, origin=(50, 50)), lw) for g, lw in layers]

MARKS = {"kumi": lambda: kumi(split=False), "kumi-split": kumi, "seda": seda, "telar": telar}

# heavier, sparser constructions for silkscreen and small relief (≈6–10 mm)
SMALL = {"kumi": lambda: kumi(split=False, frame=5.2, piece=3.6),
         "kumi-split": lambda: kumi(frame=5.2, piece=3.6, gap=7.0),
         "seda": lambda: seda(R=30.0, rings=3, w=3.6, frame=5.2, inset=6.0, shortest=8.0),
         "telar": lambda: telar(band=12.5, gap=3.2, w=3.2, frame=5.2, margin=5.5)}
