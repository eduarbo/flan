"""Open the mounting-side membranes in the reference Flan STL meshes for glued magnets.
Run python3 tools/glue_pockets.py to reproduce the printable meshes and fit coupons.
SPDX-License-Identifier: GPL-3.0-or-later
"""
import json
import math
import struct
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'mechanical/glue-in'
FACET = struct.Struct('<12fH')
SPEC = json.loads((ROOT / 'design/revI-magnets.json').read_text())
STATIONS = [(x, -y) for x, y in SPEC['stations_left']]


def facet(a, b, c):
    u = [b[i] - a[i] for i in range(3)]
    v = [c[i] - a[i] for i in range(3)]
    n = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]]
    length = math.sqrt(sum(i*i for i in n))
    if length < 1e-10:
        raise ValueError('Degenerate magnet pocket facet')
    return FACET.pack(*(i/length for i in n), *a, *b, *c, 0)


def open_pockets(data, base, centers):
    # Outside disk of the mating face, then the cap of the existing blind bore.
    planes = [(6.6, 1.4), (6.3, 1.15)] if base else [(6.8, 1.6), (7.0, 1.1)]
    if len(data) < 84 or len(data) != 84 + struct.unpack_from('<I',data,80)[0]*FACET.size:
        raise ValueError('Expected a binary STL with complete facets')
    caps = [[[] for _ in planes] for _ in centers]
    kept = bytearray()
    for offset in range(84, len(data), FACET.size):
        raw = data[offset:offset + FACET.size]
        row = FACET.unpack(raw)
        a, b, c = (row[i:i+3] for i in (3, 6, 9))
        removed = False
        if abs(a[2]-b[2]) < 1e-5 and abs(b[2]-c[2]) < 1e-5:
            for j, (z, radius) in enumerate(planes):
                if abs(a[2]-z) > 1e-5:
                    continue
                for i, (x, y) in enumerate(centers):
                    if all(math.hypot(p[0]-x, p[1]-y) <= radius+0.00005 for p in (a,b,c)):
                        caps[i][j].append((a,b,c))
                        removed = True
                        break
        if not removed:
            kept.extend(raw)

    for (x, y), disks in zip(centers, caps):
        rings = []
        for triangles, (_, radius) in zip(disks, planes):
            # Recover the actual shared boundary of each triangulated disk.
            edges = Counter(tuple(sorted((a,b))) for tri in triangles for a,b in zip(tri,tri[1:]+tri[:1]))
            boundary = {p for edge,count in edges.items() if count == 1 for p in edge}
            if len(boundary) < 12 or any(abs(math.hypot(a-x,b-y)-radius) > 0.00005 for a,b,_ in boundary):
                raise ValueError(f'Unexpected native pocket boundary at {(x,y)}')
            rings.append(sorted(boundary,key=lambda p:math.atan2(p[1]-y,p[0]-x)))
        outer, inner = rings
        if len(outer) != len(inner):
            raise ValueError(f'Incompatible native cylinder tessellations at {(x,y)}')
        # Native cylinders can cross the atan2 seam at slightly different angles.
        start = min(range(len(inner)),key=lambda i:math.dist(outer[0][:2],inner[i][:2]))
        inner = inner[start:]+inner[:start]
        mouth = [(a,b,outer[0][2]) for a,b,_ in inner]
        for i in range(len(outer)):
            j = (i+1) % len(outer)
            for a,b,c in [(outer[i],outer[j],mouth[j]),(outer[i],mouth[j],mouth[i]),
                          (mouth[i],mouth[j],inner[j]),(mouth[i],inner[j],inner[i])]:
                # Upper mating face points +Z on a base and -Z on a frame.
                kept.extend(facet(a,b,c) if base else facet(a,c,b))
    return data[:80]+struct.pack('<I',len(kept)//50)+kept


def source_files():
    for folder in ['revI','flan42','flan46','flan54']:
        yield from sorted((ROOT/'mechanical'/folder).glob('*-case-*-base.stl'))
    styles=json.loads((ROOT/'design/frame-selection.json').read_text())['selected']
    for folder in ['revI','revI/common-m2']:
        for side in ['left','right']:
            for style in styles:
                for suffix in ['', '-body']:
                    yield ROOT/'mechanical'/folder/(side+'-frame-'+style+suffix+'.stl')
    for kind in ['base','frame']:
        yield ROOT/'mechanical/revI'/('coupon-magnet-'+kind+'.stl')


if __name__ == '__main__':
    count=0
    for path in source_files():
        centers = STATIONS[-1:] if path.name.startswith('coupon-') else STATIONS
        if path.name.startswith('right-'):
            centers = [(160-x,y) for x,y in centers]
        out = OUT / path.relative_to(ROOT/'mechanical')
        out.parent.mkdir(parents=True,exist_ok=True)
        out.write_bytes(open_pockets(path.read_bytes(),path.stem.endswith('-base'),centers))
        count+=1
    print(f'Generated {count} glue-in meshes.')
