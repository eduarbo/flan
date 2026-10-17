"""Symbols for the naming study, as shapely geometry in a unit-height box (y up)."""
import math
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union
from shapely import affinity
from .lettering import arc

def strokes(lines, sw):
    return unary_union([LineString(l).buffer(sw / 2, quad_segs=16) for l in lines])

def weave(cols, rows, w=1.0, h=1.0, band=0.20, gap=0.06, over=0):
    """Warp and weft ribbons crossing over and under, with rounded ends."""
    xs = [band / 2 + (w - band) * i / (cols - 1) for i in range(cols)]
    ys = [band / 2 + (h - band) * j / (rows - 1) for j in range(rows)]
    warp = [LineString([(x, -0.06), (x, h + 0.06)]).buffer(band / 2, cap_style="round") for x in xs]
    weft = [LineString([(-0.06, y), (w + 0.06, y)]).buffer(band / 2, cap_style="round") for y in ys]
    for i, x in enumerate(xs):
        for j, y in enumerate(ys):
            if (i + j + over) % 2 == 0:     # warp over: cut the weft around it
                weft[j] = weft[j].difference(box(x - band / 2 - gap, y - band, x + band / 2 + gap, y + band))
            else:
                warp[i] = warp[i].difference(box(x - band, y - band / 2 - gap, x + band, y + band / 2 + gap))
    return unary_union(warp + weft)

def swatch(cols, rows, w, h, band, gap, radius, over=0):
    """A woven swatch: ribbons clipped to a rounded rectangle, so it reads as cloth."""
    cloth = weave(cols, rows, w=w + 0.2, h=h + 0.2, band=band, gap=gap, over=over)
    cloth = affinity.translate(cloth, -0.1, -0.1)
    frame = box(radius, radius, w - radius, h - radius).buffer(radius, quad_segs=16)
    return cloth.intersection(frame)

def telar_weave():
    return swatch(4, 4, 1.0, 1.0, band=0.165, gap=0.05, radius=0.16)

def asanoha_hex(sw=0.075, half=None, gap=0.10):
    """Kumiko asanoha in a hexagon; half='split' draws two mirrored halves apart."""
    R = 0.5
    c = (0.0, 0.0)
    V = [(R * math.cos(math.radians(60 * k + 30)), R * math.sin(math.radians(60 * k + 30))) for k in range(6)]
    lines = []
    for k in range(6):
        a, b = V[k], V[(k + 1) % 6]
        g = ((c[0] + a[0] + b[0]) / 3, (c[1] + a[1] + b[1]) / 3)
        lines += [[a, b], [c, a], [c, g], [a, g], [b, g]]
    art = strokes(lines, sw)
    if half == "split":
        left = art.intersection(box(-1, -1, -sw / 2, 1))
        right = art.intersection(box(sw / 2, -1, 1, 1))
        art = unary_union([affinity.translate(left, -gap / 2, 0), affinity.translate(right, gap / 2, 0)])
    return affinity.translate(art, 0.5 + (gap / 2 if half else 0), 0.5)

def pad(cx, cy, rx, ry, angle, sw, dots=(2, 3), dot_r=0.035):
    """A nopal pad: an egg-shaped outline that narrows toward its base, with keys as spines."""
    pts = []
    for i in range(96):
        t = 2 * math.pi * i / 96
        x, y = math.cos(t), math.sin(t)
        x *= 0.78 + 0.22 * (y + 1) / 2
        pts.append((cx + rx * x, cy + ry * y))
    shape = Polygon(pts)
    outline = shape.exterior.buffer(sw / 2, quad_segs=8)
    nx, ny = dots
    spines = [Point(cx + rx * 0.62 * (2 * i / (nx - 1) - 1) * 0.7, cy + ry * 0.62 * (2 * j / (ny - 1) - 1)).buffer(dot_r, quad_segs=12)
              for i in range(nx) for j in range(ny)]
    return affinity.rotate(unary_union([outline] + spines), angle, origin=(cx, cy - ry))

def nopal_pair(sw=0.07):
    left = pad(0.27, 0.47, 0.25, 0.42, 12, sw)
    right = pad(0.75, 0.52, 0.25, 0.42, -12, sw)
    tuna = Point(0.83, 1.02).buffer(0.065, quad_segs=16)
    return unary_union([left, right, tuna])

def seda_raimon(turns=3, sw=0.075):
    """One thread folded into a raimon (thunder fret): a square spiral, the meander's cousin."""
    step = (1.0 - sw) / (2 * turns + 0.5)
    x0, y0, x1, y1 = sw / 2, sw / 2, 1 - sw / 2, 1 - sw / 2
    pts = [(x0, y0)]
    while x1 - x0 > step * 0.9 and y1 - y0 > step * 0.9:
        pts += [(x1, y0), (x1, y1), (x0, y1), (x0, y0 + step)]
        x0, y0, x1, y1 = x0 + step, y0 + step, x1 - step, y1 - step
        pts[-1] = (pts[-1][0], y0)
    return LineString(pts).buffer(sw / 2, quad_segs=16, join_style="mitre")

MARKS = {
    "telar-weave": telar_weave,
    "kumi-asanoha": lambda: asanoha_hex(), "kumi-split": lambda: asanoha_hex(half="split"),
    "nopal-pair": nopal_pair,
    "seda-raimon": seda_raimon,
}
