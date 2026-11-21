"""Verify the glue-in magnet openings, seats and mesh seams on every shipped variant."""
from collections import Counter
from pathlib import Path
import math
import struct
from glue_pockets import FACET, OUT, ROOT, STATIONS, source_files


def area(a,b,c):
    return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])


def segment_distance(a,b):
    dx,dy=b[0]-a[0],b[1]-a[1]
    s=dx*dx+dy*dy
    t=min(1,max(0,-(a[0]*dx+a[1]*dy)/s)) if s else 0
    return math.hypot(a[0]+t*dx,a[1]+t*dy)


def inspect(path,base,centers):
    data=path.read_bytes()
    assert len(data)==84+struct.unpack_from('<I',data,80)[0]*50
    floor=3.1 if base else 11.2
    entry=6.6 if base else 6.3
    low,high=sorted([floor,entry])
    for x,y in centers:
        edges=Counter()
        has_seat=False
        for row in struct.iter_unpack(FACET.format,data[84:]):
            pts=[row[i:i+3] for i in (3,6,9)]
            if any(max(p[a] for p in pts)<v-2 or min(p[a] for p in pts)>v+2 for a,v in enumerate((x,y))):
                continue
            uv=[(p[0]-x,p[1]-y) for p in pts]
            lo,hi=min(p[2] for p in pts),max(p[2] for p in pts)
            signs=[area(a,b,(0,0)) for a,b in zip(uv,uv[1:]+uv[:1])]
            inside=min(signs)>=-1e-10 or max(signs)<=1e-10
            distance=min(segment_distance(a,b) for a,b in zip(uv,uv[1:]+uv[:1]))
            if abs(area(*uv))>1e-10 and inside:
                distance=0
            if abs(lo-floor)<1e-5 and abs(hi-floor)<1e-5 and distance==0:
                has_seat=True
            if hi>low+1e-5 and lo<high-1e-5:
                assert distance>=1.0,(path,x,y,'obstructed Ø2 mm passage',distance)
            for a,b in zip(pts,pts[1:]+pts[:1]):
                if all(math.hypot(p[0]-x,p[1]-y)<1.66 and low-0.01<p[2]<high+0.01 for p in (a,b)):
                    edges[(a,b)]+=1
        assert has_seat and edges,(path,x,y,'missing seat or boundary')
        assert all(n==1 and edges[(b,a)]==1 for (a,b),n in edges.items()),(path,x,y,'open or reversed seam')


if __name__=='__main__':
    paths=list(source_files())
    for p in paths:
        centers=STATIONS[-1:] if p.name.startswith('coupon-') else STATIONS
        if p.name.startswith('right-'):
            centers=[(160-x,y) for x,y in centers]
        inspect(OUT/p.relative_to(ROOT/'mechanical'),p.stem.endswith('-base'),centers)
    print(f'{len(paths)} meshes: full Ø2 mm passage, blind seats and closed, oriented pocket seams.')
