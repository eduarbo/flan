#!/usr/bin/env python3
"""Choose where solid support posts stand under each Flan PCB.

A post may stand only where nothing hangs below the board on either half: clear of every drilled pad,
of the bodies soldered to the underside (sockets, diodes, reset), of the controller and battery bay and
of the board edge and its cutouts. Positions are for the left half in KiCad millimetres; the right half
mirrors them to x = 160 - x, and a position counts only if its mirror image is free on the right board.

  python tools/plan_pcb_supports.py           write design/pcb-supports.json
  python tools/plan_pcb_supports.py --check   verify the saved positions against the current boards

Needs numpy (FreeCAD's Python has it). SPDX-License-Identifier: GPL-3.0-or-later
"""
import json, math, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'design/pcb-supports.json'
SIZES = ('flan36', 'flan42', 'flan46', 'flan54')
POST_R, CLEAR, EDGE = 1.5, 0.9, 2.5          # post radius, air around it, distance from the board edge
BODY = {'socket': 2.6, 'sod': 1.0}            # half-width of the part body between its bottom pads
REACH, APART, MOST, WORTH = 13.0, 11.0, 10, 0.012


def footprints(text):
    out = []
    for block in re.split(r'\n\t\(footprint ', text)[1:]:
        name = block.split('\n', 1)[0].strip().strip('"')
        ref = re.search(r'\(property "Reference" "([^"]+)"', block)
        at = re.search(r'\n\t\t\(at ([-\d.]+) ([-\d.]+)(?: ([-\d.]+))?\)', block)
        layer = re.search(r'\n\t\t\(layer "([^"]+)"\)', block)
        fx, fy, fr = float(at.group(1)), float(at.group(2)), math.radians(float(at.group(3) or 0))
        pads = []
        for m in re.finditer(r'\n\t\t\(pad "([^"]*)" (\w+) (\w+)(.*?)(?=\n\t\t\(pad |\n\t\t\(model|\n\t\t\(embedded|\Z)', block, re.S):
            num, kind, shape, rest = m.groups()
            pat = re.search(r'\(at ([-\d.]+) ([-\d.]+)', rest); size = re.search(r'\(size ([-\d.]+) ([-\d.]+)\)', rest)
            drill = re.search(r'\(drill (?:oval )?([-\d.]+)(?: ([-\d.]+))?', rest); layers = re.search(r'\(layers ([^)]*)\)', rest)
            px, py = float(pat.group(1)), float(pat.group(2))
            x = fx + px * math.cos(fr) + py * math.sin(fr); y = fy - px * math.sin(fr) + py * math.cos(fr)
            pads.append({'num': num, 'kind': kind, 'x': x, 'y': y, 'size': max(float(size.group(1)), float(size.group(2))) if size else 0,
                         'drill': max(float(drill.group(1)), float(drill.group(2) or 0)) if drill else 0, 'layers': layers.group(1) if layers else ''})
        out.append({'name': name, 'ref': ref.group(1) if ref else '', 'bottom': layer and layer.group(1) == 'B.Cu', 'pads': pads, 'at': (fx, fy)})
    return out


def seg_dist(p, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]; s = dx * dx + dy * dy
    t = 0 if not s else min(1, max(0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / s))
    return math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)


def inside(p, poly):
    hit = False
    for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]):
        if (y1 > p[1]) != (y2 > p[1]) and p[0] < (x2 - x1) * (p[1] - y1) / (y2 - y1) + x1: hit = not hit
    return hit


def edge_loops(text):
    """Closed loops of the board edge: the outline first, then every cutout inside it."""
    segments = []
    for m in re.finditer(r'\n\t\(gr_line(.*?)\n\t\)', text, re.S):
        if '"Edge.Cuts"' not in m.group(1): continue
        a = re.search(r'\(start ([-\d.]+) ([-\d.]+)\)', m.group(1)); b = re.search(r'\(end ([-\d.]+) ([-\d.]+)\)', m.group(1))
        segments.append(((round(float(a.group(1)), 3), round(float(a.group(2)), 3)), (round(float(b.group(1)), 3), round(float(b.group(2)), 3))))
    links = {}
    for a, b in segments: links.setdefault(a, []).append(b); links.setdefault(b, []).append(a)
    assert all(len(v) == 2 for v in links.values()), 'open board edge'
    loops, seen = [], set()
    for start in links:
        if start in seen: continue
        loop, prev, here = [start], None, start
        while True:
            seen.add(here); nxt = [q for q in links[here] if q != prev] or links[here]
            prev, here = here, nxt[0]
            if here == start: break
            loop.append(here)
        loops.append(loop)
    area = lambda l: abs(sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(l, l[1:] + l[:1]))) / 2
    return sorted(loops, key=area, reverse=True)


def board(size, side):
    """Everything under one PCB: its edge, what hangs below it, and a test for a free spot."""
    folder = 'revI' if size == 'flan36' else size
    text = (ROOT / 'hardware' / folder / f'{size}-{side}.kicad_pcb').read_text()
    outline, *cutouts = edge_loops(text)
    edges = [(a, b) for loop in [outline] + cutouts for a, b in zip(loop, loop[1:] + loop[:1])]
    circles, capsules, mounts, bay = [], [], [], None
    for f in footprints(text):
        low = f['name'].lower()
        for p in f['pads']:
            if p['drill']: circles.append((p['x'], p['y'], max(p['drill'], p['size'] if p['kind'] == 'thru_hole' else 0) / 2))
        if f['ref'].startswith('H') and f['pads']: mounts.append((f['pads'][0]['x'], f['pads'][0]['y']))
        smd = [p for p in f['pads'] if p['kind'] == 'smd' and ('B.Cu' in p['layers'] or (f['bottom'] and 'F.Cu' in p['layers']))]
        if smd:
            half = next((v for k, v in BODY.items() if k in low), 0.8) + max(p['size'] for p in smd) / 4
            pts = [(p['x'], p['y']) for p in smd]
            for i, a in enumerate(pts):
                for b in pts[i:]: capsules.append((a, b, half))
        if f['ref'] == 'U1':                  # controller, battery and its cage live under here
            xs = [p['x'] for p in f['pads']]; ys = [p['y'] for p in f['pads']]
            bay = (min(xs) - 3, min(ys) - 6, max(xs) + 3, max(ys) + 3)
    on_board = lambda p: inside(p, outline) and not any(inside(p, c) for c in cutouts) and not (bay[0] <= p[0] <= bay[2] and bay[1] <= p[1] <= bay[3])
    def free(p):
        if not on_board(p) or min(seg_dist(p, a, b) for a, b in edges) < EDGE + POST_R: return False
        if any(math.hypot(p[0] - x, p[1] - y) < r + POST_R + CLEAR for x, y, r in circles): return False
        return not any(seg_dist(p, a, b) < half + POST_R + CLEAR for a, b, half in capsules)
    return {'outline': outline, 'cutouts': cutouts, 'circles': circles, 'capsules': capsules, 'mounts': mounts, 'bay': bay, 'on_board': on_board, 'free': free}


def free_on_both(size):
    left, right = board(size, 'left'), board(size, 'right')
    return left, lambda p: left['free'](p) and right['free']((160 - p[0], p[1]))


def plan(size, given=()):
    """Greedy: each post is the free spot that most reduces how far board area lies beyond REACH from a
    screw post or support. `given` are posts already decided for a smaller size; they stay if still free."""
    import numpy as np
    left, ok = free_on_both(size)
    xs = [p[0] for p in left['outline']]; ys = [p[1] for p in left['outline']]
    grid = [(x / 2, y / 2) for x in range(int(min(xs) * 2), int(max(xs) * 2) + 1) for y in range(int(min(ys) * 2), int(max(ys) * 2) + 1)]
    area = [p for p in grid if left['on_board'](p)]
    A, S = np.array(area), np.array([p for p in area if ok(p)])
    dist = lambda pts, q: np.hypot(pts[:, 0] - q[0], pts[:, 1] - q[1])
    cost = lambda g: float(np.sum(np.clip(g - REACH, 0, None) ** 2))
    screws = np.min([dist(A, m) for m in left['mounts']], axis=0)
    gap, chosen = screws.copy(), []
    def take(q):
        nonlocal gap, S
        chosen.append(q); gap = np.minimum(gap, dist(A, q)); S = S[dist(S, q) >= APART]
    for m in left['mounts']: S = S[dist(S, m) >= APART]
    for q in given:
        if ok(tuple(q)): take(tuple(q))
    while len(chosen) < MOST and len(S):
        D = np.hypot(A[None, :, 0] - S[:, None, 0], A[None, :, 1] - S[:, None, 1])
        gain = cost(gap) - np.sum(np.clip(np.minimum(gap[None, :], D) - REACH, 0, None) ** 2, axis=1)
        i = int(np.argmax(gain))
        if gain[i] < WORTH * cost(screws): break                    # no longer worth a post
        take((float(S[i, 0]), float(S[i, 1])))
    beyond = lambda g: round(100 * float(np.mean(g > REACH)), 1)
    return [[round(x, 1), round(y, 1)] for x, y in chosen], {'screws': len(left['mounts']), 'board_beyond_reach_pct': [beyond(screws), beyond(gap)]}


def main():
    if '--check' in sys.argv:
        saved = json.loads(OUT.read_text())
        assert [saved['post_diameter_mm'], saved['clearance_mm'], saved['edge_distance_mm']] == [2 * POST_R, CLEAR, EDGE]
        for size in SIZES:
            _, ok = free_on_both(size)
            blocked = [p for p in saved['supports'][size] if not ok(tuple(p))]
            assert not blocked, (size, 'support no longer free on both halves', blocked)
            assert saved['supports'][size][:len(saved['supports']['flan36'])] == saved['supports']['flan36'], (size, 'does not extend the Flan36 posts')
        print('PASS: every saved support is free under both halves of', ', '.join(SIZES))
        return
    supports, coverage = {}, {}
    for size in SIZES:
        supports[size], coverage[size] = plan(size, supports.get('flan36', ()))
    OUT.write_text(json.dumps({
        'schema': 'flan-pcb-supports-1', 'units': 'mm',
        'frame': 'KiCad board coordinates of the left half; the right half mirrors x to 160 - x',
        'purpose': 'Solid posts from the base floor to the PCB underside. They carry the board between the screw posts; they have no hole.',
        'post_diameter_mm': 2 * POST_R, 'clearance_mm': CLEAR, 'edge_distance_mm': EDGE,
        'reach_mm': REACH, 'supports': supports, 'coverage': coverage,
        'generator': 'tools/plan_pcb_supports.py', 'physical_acceptance': False}, indent=1) + '\n')
    print(json.dumps({'supports': supports, 'coverage': coverage}))


if __name__ == '__main__':
    main()
