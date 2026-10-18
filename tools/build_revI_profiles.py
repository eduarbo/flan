#!/usr/bin/env python3
"""Intentional control vertices, analytical fillets and matching derived contours.
Run with the documented CAD Python runtime (Shapely).
SPDX-License-Identifier: GPL-3.0-or-later
"""
import json, math
from pathlib import Path
from shapely.geometry import Polygon,Point
ROOT=Path(__file__).resolve().parents[1]
from outline import MARGIN, THUMB_MARGIN, rounded, control_outline   # noqa: E402  (shared with the variants)

FRAME_WALL = 1.2

layout=json.loads((ROOT/'design/layout.json').read_text())
controls,radii=control_outline(layout['halves']['left'])
outer,arcs=rounded(controls,radii)
segments=[]
for i,arc in enumerate(arcs):
    segments.append(dict(kind='arc',**arc))
    segments.append({'kind':'line','start':arc['end'],'end':arcs[(i+1)%len(arcs)]['start']})
shell=Polygon(outer);assert shell.is_valid
# The frame and case share the north/outside corner, including its tangencies.
# Inset lips use concentric radii; changing the radius must not widen the bay.
shared_corner=controls.index([135,11])
shared_radius=math.dist(arcs[shared_corner]['start'],controls[shared_corner])
frame_radii=[1.2,shared_radius,1.2,1.2]
hood,h_arcs=rounded([[111,11],[135,11],[135,67],[111,67]],frame_radii)
assert all(math.dist(h_arcs[1][k],arcs[shared_corner][k])<1e-9 for k in ('start','mid','end'))
frame=Polygon(hood)
coords=lambda p:[list(v) for v in p.exterior.coords][:-1]
profiles={};frames={}
left={'outer':outer,'outer_arcs':arcs,'control_vertices':controls,'exposed_margin_mm':MARGIN,'thumb_margin_mm':THUMB_MARGIN,
      'inner':coords(shell.buffer(-1.3,join_style=2)),
      'pcb_outline':coords(shell.buffer(-1.65,join_style=2).difference(Point(133,52.8).buffer(2.05,quad_segs=32))),
      'plate':coords(shell.difference(frame.buffer(.18,join_style=2))),
      'hood':hood,'hood_arcs':h_arcs}
left['rim_inset']=coords(shell.buffer(-1.1,join_style=2))
left['rim_inner']=coords(shell.buffer(-.9,join_style=2))
left['terrace_inset']=coords(shell.buffer(-.25,join_style=2))
left['pcb_cutouts']=[coords(Point(x,y).buffer(2.05,quad_segs=32)) for x,y in [(113,52.8),(122.8,64.7)]]
for side in ['left','right']:
    reflect=lambda p:[160-p[0],p[1]] if side=='right' else p
    cutouts=left.pop('pcb_cutouts',None) if side=='left' else cutouts
    profiles[side]={k:([ {n:reflect(p) for n,p in a.items()} for a in v] if k.endswith('_arcs') else [reflect(p) for p in v]) if isinstance(v,list) else v for k,v in left.items()}
    profiles[side]['pcb_cutouts']=[[reflect(p) for p in loop] for loop in cutouts]
    profiles[side]['outer_segments']=[{k:([reflect(p) for p in v] if k=='poles' else reflect(v)) if k!='kind' else v for k,v in s.items()} for s in segments]
    profiles[side]['lcd_flank_x_mm']=reflect([135,0])[0]
    profiles[side]['plate_frame_clearance']=[reflect(p) for p in coords(frame.buffer(.18,join_style=2))]
    frames[side]={'outer':profiles[side]['hood'],'outer_arcs':profiles[side]['hood_arcs'],
                  'inner':[reflect(p) for p in coords(frame.buffer(-FRAME_WALL,join_style=2))]}
    # A modest 0.4 mm lip bevel; older styles remain available as plain options.
    for style,inset in [('bevel',.4),('facet',.8)]:
        outline,arcs=rounded([[111+inset,11+inset],[135-inset,11+inset],
                             [135-inset,67-inset],[111+inset,67-inset]],[r-inset for r in frame_radii])
        frames[side][style]=[reflect(p) for p in outline]
        frames[side][style+'_arcs']=[{n:reflect(p) for n,p in a.items()} for a in arcs]
(ROOT/'design/revI-profiles.json').write_text(json.dumps(profiles,indent=2)+'\n')
(ROOT/'design/revI-frame-profiles.json').write_text(json.dumps(frames,indent=2)+'\n')
print('21 local tangent rounds; key-aligned thumb faces, LCD-aligned flank and exact mirrored halves')
