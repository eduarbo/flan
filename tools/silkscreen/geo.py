"""Board geometry (outline, pads, holes, silk) read from kicad_extract.py output, in KiCad mm (y down)."""
import json
from pathlib import Path
from shapely.geometry import Polygon, LineString, Point
from shapely.ops import unary_union

def polys(lst):
    out = []
    for o in lst:
        p = Polygon(o["outer"], o["holes"])
        if not p.is_valid:
            p = p.buffer(0)
        out.append(p)
    return unary_union(out) if out else Polygon()

class Board:
    def __init__(self, side, geo_dir):
        self.name = side
        g = json.loads((Path(geo_dir) / f"geo-{side}.json").read_text())
        self.g = g
        self.outline = polys(g["outline"])
        self.holes = unary_union([Point(h["x"], h["y"]).buffer(max(h["dx"], h["dy"]) / 2, 32) for h in g["holes"]])
        self.fp = {f["ref"]: f for f in g["footprints"]}
        self.side = {}
        for s in ("F", "B"):
            d = g["sides"][s]
            tr = []
            for t in d["tracks"]:
                if t.get("via"):
                    tr.append(Point(t["x"], t["y"]).buffer(t["d"] / 2, 16))
                elif "poly" in t:
                    tr.append(polys(t["poly"]))
                else:
                    tr.append(LineString([t["a"], t["b"]]).buffer(t["w"] / 2, 8))
            vias = [t for t in d["tracks"] if t.get("via")]
            self.side[s] = {
                "pads": polys(d["pads"]), "courtyards": polys(d["courtyards"]),
                "silk": polys(d["silk"]), "fab": polys(d["fab"]),
                "tracks": unary_union(tr), "vias": vias,
                "via_holes": unary_union([Point(v["x"], v["y"]).buffer(v["drill"] / 2, 16) for v in vias]) if vias else Polygon(),
            }
        self.keys = sorted([f for f in g["footprints"] if f["lib"].startswith("Kailh")], key=lambda f: f["ref"])

    def keepout(self, s, pad_clear=0.20, hole_clear=0.30, edge_clear=0.40):
        """Area where silk must not go on side s (pads/mask openings, holes, edge)."""
        d = self.side[s]
        k = [d["pads"].buffer(pad_clear, 16), self.holes.buffer(hole_clear, 16), d["via_holes"].buffer(hole_clear, 16)]
        k.append(self.outline.exterior.buffer(edge_clear, 16) if hasattr(self.outline, "exterior") else Polygon())
        for interior in getattr(self.outline, "interiors", []):
            k.append(Polygon(interior).buffer(edge_clear, 16))
        return unary_union(k)

    def printable(self, s, **kw):
        return self.outline.buffer(-kw.get("edge_clear", 0.40)).difference(self.keepout(s, **kw))
