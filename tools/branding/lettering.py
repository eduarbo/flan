"""Monoline lettering for the naming study: round-capped strokes, like PCB traces.

Glyphs are skeletons on a grid with x-height 1.0 (y up). word() returns shapely geometry
in the same units; scale it to millimetres when placing. Font-free and production-ready
for silkscreen and printed relief.
"""
import math
from shapely.geometry import LineString, Point
from shapely.ops import unary_union

def arc(cx, cy, r, a0, a1, n=48):
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
             cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]

def ell(cx, cy, rx, ry, a0, a1, n=48):
    return [(cx + rx * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
             cy + ry * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]

DOT = "dot"

# each glyph: (advance width, [polylines | (DOT, x, y)])
GLYPHS = {
    "a": (1.0, [arc(.5, .5, .5, 0, 360), [(1, 0), (1, 1)]]),
    "d": (1.0, [arc(.5, .5, .5, 0, 360), [(1, 0), (1, 1.5)]]),
    "e": (1.0, [[(0, .5), (1, .5)] + arc(.5, .5, .5, 0, 318)]),
    "i": (0.0, [[(0, 0), (0, 1)], (DOT, 0, 1.38)]),
    "k": (0.82, [[(0, 0), (0, 1.5)], [(0.76, 1.0), (0, .4)], [(0.3, .6), (0.8, 0)]]),
    "l": (0.0, [[(0, 0), (0, 1.5)]]),
    "m": (1.6, [[(0, 0), (0, 1)], arc(.4, .6, .4, 180, 0) + [(.8, 0)], arc(1.2, .6, .4, 180, 0) + [(1.6, 0)]]),
    "n": (1.0, [[(0, 0), (0, 1)], arc(.5, .5, .5, 180, 0) + [(1, 0)]]),
    "o": (1.0, [arc(.5, .5, .5, 0, 360)]),
    "p": (1.0, [arc(.5, .5, .5, 0, 360), [(0, -.5), (0, 1)]]),
    "r": (0.62, [[(0, 0), (0, 1)], arc(.5, .5, .5, 180, 90) + [(.62, 1.0)]]),
    "s": (0.70, [ell(.35, .75, .35, .25, 20, 270) + ell(.35, .25, .35, .25, 90, -160)]),
    "t": (0.62, [[(.15, 1.38), (.15, .3)] + arc(.45, .3, .3, 180, 270) + [(.62, 0)], [(-.08, 1.0), (.6, 1.0)]]),
    "u": (1.0, [[(0, 1), (0, .5)] + arc(.5, .5, .5, 180, 360), [(1, 1), (1, 0)]]),
    "2": (0.92, [arc(.46, 1.0, .42, 165, -35) + [(0, 0), (.92, 0)]]),
    "3": (0.88, [arc(.44, 1.06, .34, 155, -90) + arc(.44, .36, .36, 90, -160)]),
    "4": (0.95, [[(.66, 1.42), (0, .44), (.95, .44)], [(.66, .9), (.66, 0)]]),
    "5": (0.9, [[(.84, 1.42), (.1, 1.42), (.06, .86)] + arc(.45, .45, .45, 118, -150)]),
    "6": (0.92, [arc(.46, .46, .46, 0, 360), arc(.96, .46, .9, 180, 112)]),
}

def word(text, sw=0.2, track=0.24, digit_scale=1.0, gap=0.62):
    """Lay out text; a space between letters and digits adds `gap`."""
    shapes, x = [], 0.0
    prev = None
    for ch in text:
        if ch == " ":
            x += gap
            prev = None
            continue
        adv, parts = GLYPHS[ch]
        s = digit_scale if ch.isdigit() else 1.0
        if prev is not None:
            x += track + sw
        for p in parts:
            if isinstance(p, tuple) and p[0] == DOT:
                shapes.append(Point(x + p[1] * s, p[2] * s).buffer(sw * 0.62, quad_segs=16))
            else:
                shapes.append(LineString([(x + px * s, py * s) for px, py in p]).buffer(sw / 2, quad_segs=16))
        x += adv * s
        prev = ch
    return unary_union(shapes)
