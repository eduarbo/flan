"""The eduarbo mark as one-ink outlines: the isometric cube of eduarbo.com.

Source: eduarbo.com public/favicon.svg (commit ebdc5147), whose three jade faces are
separate paths. In one colour the faces merge, so two cuts keep the cube reading: the
front vertical edge and the inner bevel, where the original changes shade. Geometry is in
millimetres, y down, origin at the mark's top-left.
"""
from shapely import affinity
from shapely.geometry import LineString, Polygon
from shapely.ops import unary_union

FACES = [
    [(960, 377.846097), (960, 516.410162), (600, 724.256259), (600, 585.692194)],                          # right, upper
    [(600, 862.820323), (960, 654.974226), (960, 793.538291), (600, 1001.384388)],                         # right, lower
    [(240, 377.846097), (360, 447.128129), (360, 724.256259), (600, 862.820323), (600, 1001.384388), (240, 793.538291)],  # left
    [(240, 377.846097), (600, 170), (960, 377.846097), (840, 447.128129), (600, 308.564065), (360, 447.128129)],          # top
]
# shared edges between faces of different shade, extended past the silhouette so a cut is clean
EDGES = [((600, 840.0), (600, 1030.0)),                 # left | right, lower: front edge
         ((215.0, 363.4), (385.0, 461.5)),               # top | left: inner bevel
         ((840.0, 447.128129), (985.0, 363.4))]          # top | right, upper: they share this run
SOURCE = {"site": "https://eduarbo.com", "file": "public/favicon.svg", "commit": "ebdc5147ae48f14790c9d554485a86f29aa8c6a5"}

def mark(height, cut=0.0):
    """The cube `height` mm tall; `cut` mm wide separations between faces (0 = silhouette)."""
    g = unary_union([Polygon(f) for f in FACES])
    if cut:
        x0, y0, x1, y1 = g.bounds
        unit = cut * (y1 - y0) / height
        g = g.difference(unary_union([LineString(e).buffer(unit / 2, cap_style="flat") for e in EDGES]))
    x0, y0, x1, y1 = g.bounds
    s = height / (y1 - y0)
    return affinity.translate(affinity.scale(g, s, s, origin=(x0, y0)), -x0, -y0)
