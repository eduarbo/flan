"""Concept B — Contorno: a three-line bus that follows the whole silhouette."""
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import substring
from .prims import stroke, ring

W = 0.20
INSETS = [0.95, 1.50, 2.05]
LEFT_ENDS = [76.1, 77.35, 78.6]   # outer → inner, below the bay and clear of the K32 corner mark

def ring_line(board, d):
    inner = Polygon(board.outline.exterior).buffer(-d, quad_segs=24, join_style="round")
    return LineString(inner.exterior.coords)

def span(line, a, b):
    """Portion of a closed ring from the projection of a to b, following the ring direction."""
    s, e = line.project(Point(a)), line.project(Point(b))
    L = line.length
    if e < s:
        e += L
    doubled = LineString(list(line.coords) + list(line.coords)[1:])
    return substring(doubled, s, e)

STAGGER = 1.25

def build(board, mx):
    art = None
    starts, ends = [], []
    for i, d in enumerate(INSETS):
        ln = ring_line(board, d)
        a = (mx(51.0 + STAGGER * i), 0.0)          # top edge, just outside the display bay
        b = (mx(26.0), LEFT_ENDS[i])               # left edge, below the bay
        p1 = span(ln, a, b)
        p2 = span(ln, b, a)
        # keep the direction that travels around the keys, not through the display bay
        through_bay = any(mx(x) < 49.5 and y < 66 for x, y in p1.coords)
        p = p2 if through_bay else p1
        s = stroke(p, W)
        art = s if art is None else art.union(s)
        starts.append(p.coords[0]); ends.append(p.coords[-1])
    for c in starts + ends:
        art = art.union(Point(c).buffer(0.25, quad_segs=32))      # test-point pads; 0.20 mm from the neighbour
    return art
