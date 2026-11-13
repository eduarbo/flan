"""The eduarbo mark in one ink: the isometric cube of eduarbo.com.

Source: eduarbo.com public/favicon.svg (commit ebdc5147). Its four paths are filled as
published, in one colour: the three shades are lost and faces that touch merge. Nothing is
added or cut. Geometry is in millimetres, y down, origin at the mark's top-left.
"""
from shapely import affinity, union_all
from shapely.geometry import Polygon

FACES = [
    [(960, 377.846097), (960, 516.410162), (600, 724.256259), (600, 585.692194)],                          # right, upper
    [(600, 862.820323), (960, 654.974226), (960, 793.538291), (600, 1001.384388)],                         # right, lower
    [(240, 377.846097), (360, 447.128129), (360, 724.256259), (600, 862.820323), (600, 1001.384388), (240, 793.538291)],  # left
    [(240, 377.846097), (600, 170), (960, 377.846097), (840, 447.128129), (600, 308.564065), (360, 447.128129)],          # top
]
SOURCE = {"site": "https://eduarbo.com", "file": "public/favicon.svg", "commit": "ebdc5147ae48f14790c9d554485a86f29aa8c6a5"}

def mark(height):
    """The cube `height` mm tall: the four published faces as one outline."""
    faces = [Polygon(f) for f in FACES]
    g = union_all(faces, grid_size=1e-6)         # the published precision, so shared edges merge
    published = {p for f in FACES for p in f}
    assert g.geom_type == "Polygon" and not g.interiors and set(g.exterior.coords) <= published, "not the published outline"
    assert abs(g.area - sum(f.area for f in faces)) < 1e-3
    x0, y0, x1, y1 = g.bounds
    s = height / (y1 - y0)
    return affinity.translate(affinity.scale(g, s, s, origin=(x0, y0)), -x0, -y0)
