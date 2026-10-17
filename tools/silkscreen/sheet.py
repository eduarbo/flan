"""Preview sheet: both halves from below, side by side, as fabricated (one-ink legend)."""
from .render import path_d

PALETTES = {
    "navy":  {"mask": "#1c2f57", "mask_cu": "#24396a", "silk": "#eef0ea", "pad": "#c9ccd2", "hole": "#f3f2ec", "edge": "#14223f"},
    "green": {"mask": "#1f5a3a", "mask_cu": "#296b46", "silk": "#f2f0e8", "pad": "#c9c5bb", "hole": "#f3f2ec", "edge": "#163f29"},
    "black": {"mask": "#17191b", "mask_cu": "#222528", "silk": "#efede7", "pad": "#d4b05c", "hole": "#f3f2ec", "edge": "#0b0c0d"},
    "white": {"mask": "#f4f3ef", "mask_cu": "#e7e6e1", "silk": "#1c1c1c", "pad": "#cfcbc2", "hole": "#d8d5cc", "edge": "#c9c7c0"},
    "purple": {"mask": "#3a2a5c", "mask_cu": "#45336b", "silk": "#f1eef6", "pad": "#d4b05c", "hole": "#f3f2ec", "edge": "#281d42"},
}

def sheet(cv, art, palette="navy", margin=3.0, bg="none", plate=None):
    p = PALETTES[palette]
    u0, v0, u1, v1 = cv.bounds
    w, h = u1 - u0 + 2 * margin, v1 - v0 + 2 * margin
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{u0 - margin:.3f} {v0 - margin:.3f} {w:.3f} {h:.3f}" width="{w:.2f}mm" height="{h:.2f}mm">']
    if bg != "none":
        out.append(f'<rect x="{u0 - margin}" y="{v0 - margin}" width="{w}" height="{h}" fill="{bg}"/>')
    for half, b in cv.boards.items():
        d = b.side["B"]
        T = lambda g: cv.to_canvas(g, half)
        out.append(f'<path d="{path_d(T(b.outline))}" fill="{p["mask"]}" fill-rule="evenodd" stroke="{p["edge"]}" stroke-width="0.25"/>')
        out.append(f'<path d="{path_d(T(d["tracks"].intersection(b.outline)))}" fill="{p["mask_cu"]}" fill-rule="evenodd"/>')
        out.append(f'<path d="{path_d(T(d["silk"]))}" fill="{p["silk"]}" fill-rule="evenodd"/>')
        if half in art and not art[half].is_empty:
            out.append(f'<path d="{path_d(T(art[half]).simplify(0.008))}" fill="{p["silk"]}" fill-rule="evenodd"/>')
        if plate and half in plate:
            out.append(f'<path d="{path_d(T(plate[half]))}" fill="{p["silk"]}" fill-rule="evenodd"/>')
        out.append(f'<path d="{path_d(T(d["pads"]))}" fill="{p["pad"]}" fill-rule="evenodd"/>')
        out.append(f'<path d="{path_d(T(b.holes.union(d["via_holes"])))}" fill="{p["hole"]}" fill-rule="evenodd"/>')
    out.append("</svg>")
    return "\n".join(out)
