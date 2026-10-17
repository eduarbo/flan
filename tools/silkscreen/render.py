"""Realistic SVG preview of a bare board with silkscreen art."""
from shapely.geometry import Polygon

PALETTES = {
    "green": {"mask": "#1f5a3a", "mask_cu": "#2a6e47", "silk": "#f4f1e8", "pad": "#c9c5bb", "hole": "#0d1410", "bg": "#efece4", "edge": "#163f29"},
    "black": {"mask": "#16181a", "mask_cu": "#24272a", "silk": "#f1efe9", "pad": "#d6b25e", "hole": "#050505", "bg": "#efece4", "edge": "#0b0c0d"},
    "white": {"mask": "#f2f1ed", "mask_cu": "#e4e3de", "silk": "#1b1b1b", "pad": "#d3cfc6", "hole": "#2a2a2a", "bg": "#d9d6ce", "edge": "#cfcdc6"},
}

def path_d(geom, mirror=None):
    def ring(coords):
        pts = list(coords)
        if mirror is not None:
            pts = [(mirror - x, y) for x, y in pts]
        return "M" + " L".join(f"{x:.3f},{y:.3f}" for x, y in pts) + " Z"
    out = []
    if geom.is_empty:
        return ""
    gs = getattr(geom, "geoms", [geom])
    for g in gs:
        if isinstance(g, Polygon):
            out.append(ring(g.exterior.coords))
            for i in g.interiors:
                out.append(ring(i.coords))
        elif hasattr(g, "geoms"):
            out.append(path_d(g, mirror))
    return " ".join(out)

def svg(board, side, art=None, palette="green", margin=4, show_existing=True, scale=1.0, extra=""):
    """Bare-board preview; the back is mirrored so it reads as seen from below."""
    p = PALETTES[palette]
    d = board.side[side]
    minx, miny, maxx, maxy = board.outline.bounds
    mirror = (minx + maxx) if side == "B" else None
    w, h = maxx - minx + 2 * margin, maxy - miny + 2 * margin
    vb = f"{minx - margin:.3f} {miny - margin:.3f} {w:.3f} {h:.3f}"
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="{w*scale:.1f}mm" height="{h*scale:.1f}mm">',
             f'<rect x="{minx-margin}" y="{miny-margin}" width="{w}" height="{h}" fill="{p["bg"]}"/>',
             f'<path d="{path_d(board.outline, mirror)}" fill="{p["mask"]}" fill-rule="evenodd" stroke="{p["edge"]}" stroke-width="0.25"/>',
             f'<path d="{path_d(d["tracks"].intersection(board.outline), mirror)}" fill="{p["mask_cu"]}" fill-rule="evenodd"/>']
    if show_existing:
        parts.append(f'<path d="{path_d(d["silk"], mirror)}" fill="{p["silk"]}" fill-rule="evenodd" opacity="0.92"/>')
    if art is not None and not art.is_empty:
        parts.append(f'<path d="{path_d(art, mirror)}" fill="{p["silk"]}" fill-rule="evenodd"/>')
    parts.append(f'<path d="{path_d(d["pads"], mirror)}" fill="{p["pad"]}" fill-rule="evenodd"/>')
    parts.append(f'<path d="{path_d(board.holes.union(d["via_holes"]), mirror)}" fill="{p["hole"]}" fill-rule="evenodd"/>')
    parts.append(extra)
    parts.append("</svg>")
    return "\n".join(parts)
