import numpy as np
from shapely.geometry import box
from shapely.ops import unary_union
from shapely import contains_xy

def occupied(board, s, pad=0.8):
    d = board.side[s]
    parts = list(getattr(d["silk"], "geoms", [d["silk"]])) + list(getattr(d["pads"], "geoms", [d["pads"]]))
    cl = unary_union([g.buffer(pad) for g in parts])
    hulls = unary_union([c.convex_hull for c in getattr(cl, "geoms", [cl])])
    return unary_union([hulls, d["courtyards"]])

def free_area(board, s, extra=None):
    f = board.printable(s, pad_clear=0.25, hole_clear=0.35, edge_clear=0.6).difference(occupied(board, s).buffer(0.2))
    if extra is not None:
        f = f.difference(extra)
    return f

def rects(free, region=None, minw=6, minh=3.5, res=0.2, top=6):
    minx, miny, maxx, maxy = (region or free).bounds
    xs = np.arange(minx, maxx, res); ys = np.arange(miny, maxy, res)
    X, Y = np.meshgrid(xs, ys)
    M = contains_xy(free if region is None else free.intersection(region), X, Y)
    H = np.zeros(M.shape[1], int); best = []
    for i in range(M.shape[0]):
        H = np.where(M[i], H + 1, 0)
        st = []
        for j in range(len(H) + 1):
            h = H[j] if j < len(H) else 0
            s0 = j
            while st and st[-1][1] >= h:
                s0, hh = st.pop()
                w = j - s0
                if hh * res >= minh and w * res >= minw:
                    best.append((w * res * hh * res, xs[s0], ys[i - hh + 1], w * res, hh * res))
            st.append((s0, h))
    best.sort(reverse=True)
    seen = []
    for a, x, y, w, h in best:
        r = box(x, y, x + w, y + h)
        if any(r.intersects(q) for q in seen):
            continue
        seen.append(r)
        if len(seen) >= top:
            break
    return [q.bounds for q in seen]
