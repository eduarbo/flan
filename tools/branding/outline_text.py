"""Shape text with HarfBuzz at exact variable-font coordinates and return filled outlines.

Matches what a browser draws for `font-variation-settings`: axes not given keep the font's
defaults (Fraunces: WONK 1). Coordinates are in em (y up, baseline at 0); scale when placing.
"""
import uharfbuzz as hb
from shapely.geometry import Polygon
from shapely.ops import unary_union

class Pen:
    def __init__(self, steps=16):
        self.rings, self.cur, self.steps = [], [], steps
    def move_to(self, x, y, _=None):
        self.cur = [(x, y)]
    def line_to(self, x, y, _=None):
        self.cur.append((x, y))
    def quadratic_to(self, cx, cy, x, y, _=None):
        x0, y0 = self.cur[-1]
        for k in range(1, self.steps + 1):
            t = k / self.steps
            self.cur.append(((1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x, (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y))
    def cubic_to(self, c1x, c1y, c2x, c2y, x, y, _=None):
        x0, y0 = self.cur[-1]
        for k in range(1, self.steps + 1):
            t = k / self.steps
            a, b, c, d = (1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t * t, t ** 3
            self.cur.append((a * x0 + b * c1x + c * c2x + d * x, a * y0 + b * c1y + c * c2y + d * y))
    def close_path(self, _=None):
        if len(self.cur) > 2:
            self.rings.append(self.cur)
        self.cur = []

def signed_area(r):
    return 0.5 * sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(r, r[1:] + r[:1]))

def nonzero(rings):
    """Fill like the font does: overlapping contours of one direction add, the other cuts.
    Variable fonts keep overlaps, so even-odd would punch holes where stems meet."""
    if not rings:
        return Polygon()
    areas = [signed_area(r) for r in rings]
    outer_sign = 1 if areas[max(range(len(rings)), key=lambda i: abs(areas[i]))] > 0 else -1
    fill = unary_union([Polygon(r).buffer(0) for r, a in zip(rings, areas) if a * outer_sign > 0])
    holes = unary_union([Polygon(r).buffer(0) for r, a in zip(rings, areas) if a * outer_sign < 0])
    return fill.difference(holes)

def outline(text, font_path, variations, features=None):
    blob = hb.Blob.from_file_path(str(font_path))
    face = hb.Face(blob)
    font = hb.Font(face)
    upm = face.upem
    font.set_variations(variations)
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(font, buf, features or {})
    funcs = hb.DrawFuncs()
    funcs.set_move_to_func(lambda x, y, p: p.move_to(x, y))
    funcs.set_line_to_func(lambda x, y, p: p.line_to(x, y))
    funcs.set_quadratic_to_func(lambda a, b, x, y, p: p.quadratic_to(a, b, x, y))
    funcs.set_cubic_to_func(lambda a, b, c, d, x, y, p: p.cubic_to(a, b, c, d, x, y))
    funcs.set_close_path_func(lambda p: p.close_path())
    glyphs, x = [], 0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        pen = Pen()
        funcs.draw_glyph(font, info.codepoint, pen)
        rings = [[((px + x + pos.x_offset) / upm, (py + pos.y_offset) / upm) for px, py in r] for r in pen.rings]
        glyphs.append(nonzero(rings))
        x += pos.x_advance
    ext = font.get_font_extents("ltr")
    return unary_union(glyphs), {"advance": x / upm, "ascender": ext.ascender / upm, "descender": -ext.descender / upm,
                                 "glyphs": [font.glyph_to_string(i.codepoint) for i in buf.glyph_infos]}
