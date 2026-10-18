"""Both revI halves seen from below, controller sides adjacent, as one drawing surface.

Canvas coordinates are millimetres with u to the right and v down. A half's board point
(x, y) maps to (shift - x, y): the mirror shows the back as it is seen when the boards are
turned over. The same transform maps canvas art back onto the board.
"""
from shapely import affinity
from shapely.geometry import Point, Polygon
from shapely.ops import unary_union
from .geo import Board

GAP = 14.0          # space between the two tiles on the sheet
QUIET_REACH = 6.0   # mm over which a pattern calms down toward the signature

class Canvas:
    def __init__(self, geo_dir):
        self.boards = {h: Board(h, geo_dir) for h in ("right", "left")}
        r = self.boards["right"].outline.bounds
        l = self.boards["left"].outline.bounds
        self.shift = {"right": r[0] + r[2], "left": l[0] + l[2] + (r[2] + GAP - l[0])}
        self.bounds = (r[0], min(r[1], l[1]), r[2] + GAP + (l[2] - l[0]), max(r[3], l[3]))

    def to_canvas(self, geom, half):
        return affinity.translate(affinity.scale(geom, xfact=-1, yfact=1, origin=(0, 0)), self.shift[half], 0)

    to_board = to_canvas   # the mirror is its own inverse

    def point(self, half, x, y):
        return (self.shift[half] - x, y)

    def keys(self, half):
        return [self.point(half, k["x"], k["y"]) for k in self.boards[half].keys]

    def controller(self, half):
        """Centre of the battery opening under the nice!nano, in canvas coordinates."""
        b = self.boards[half]
        cut = max((Polygon(r) for r in b.outline.interiors), key=lambda p: p.area)
        c = cut.centroid
        return self.point(half, c.x, c.y)

    def quiet(self, zones):
        """Let patterns calm down around {half: board geometry}: calm() is 0 on a zone and
        rises smoothly to 1 at QUIET_REACH. Without zones every pattern draws as before."""
        from shapely.prepared import prep
        self._quiet = unary_union([self.to_canvas(z, h) for h, z in zones.items()]).simplify(0.05)
        self._quiet_near = prep(self._quiet.buffer(QUIET_REACH, quad_segs=4))

    def calm(self, u, v):
        q = getattr(self, "_quiet", None)
        if q is None:
            return 1.0
        p = Point(u, v)
        if not self._quiet_near.contains(p):
            return 1.0
        t = min(1.0, q.distance(p) / QUIET_REACH)
        return t * t * (3 - 2 * t)

    def hushed(self, geom):
        """True where a discrete element (a dot, a via) would touch a quiet zone."""
        q = getattr(self, "_quiet", None)
        return q is not None and q.intersects(geom)

    def region(self):
        return unary_union([self.to_canvas(self.boards[h].outline, h) for h in self.boards])

    def allowed(self):
        """Printable pattern area of both halves, in canvas coordinates."""
        if not hasattr(self, "_allowed"):
            self._allowed = unary_union([self.to_canvas(b.outline.buffer(-0.55).difference(pattern_keepout(b)), h)
                                         for h, b in self.boards.items()])
        return self._allowed

def bodies(board, side="B", grow=0.8):
    """Convex hulls of each part body on a side: clustered pads and their legend."""
    d = board.side[side]
    parts = list(getattr(d["silk"], "geoms", [d["silk"]])) + list(getattr(d["pads"], "geoms", [d["pads"]]))
    cl = unary_union([g.buffer(grow) for g in parts if not g.is_empty])
    return unary_union([c.convex_hull for c in getattr(cl, "geoms", [cl])])

def pattern_keepout(board, side="B", clear=0.30, hole=0.35, edge=0.55, legend=0.30, body_grow=0.35):
    """Where an all-over pattern must stop on a side: pads, holes, vias, edge, legends, part bodies."""
    d = board.side[side]
    k = [d["pads"].buffer(clear, quad_segs=12), board.holes.buffer(hole, quad_segs=12),
         d["silk"].buffer(legend, quad_segs=8), bodies(board, side, body_grow).buffer(0.10, quad_segs=8)]
    for v in d["vias"]:
        k.append(Point(v["x"], v["y"]).buffer(v["d"] / 2 + 0.2, quad_segs=12))
    for interior in board.outline.interiors:
        k.append(Polygon(interior).buffer(edge, quad_segs=12))
    return unary_union(k)
