#!/usr/bin/env python3
"""Bounded current-revision delivery/provenance checks; no hardware approval.
SPDX-License-Identifier: GPL-3.0-or-later
"""
import hashlib,json,re,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def sha(p):return hashlib.sha256((ROOT/p).read_bytes()).hexdigest()
m=json.loads((ROOT/'design/revG.json').read_text())
assert sha('mechanical/revG/Filo36.FCStd')==m['fcstd_sha256']
for source in m['inputs']:assert sha(source['path'])==source['sha256'],source
for s in ['left','right']:
    for name,p in m['parts'].items():assert sha('mechanical/revG/'+name+'.stl')==p['stl_sha256'],name
mechanical=json.loads((ROOT/'validation/revG-mechanical.json').read_text())
for half in mechanical['halves'].values():
    assert not half['collisions']
    assert set(half['frame_variants'])=={'smooth','bevel','facet'}
    for f in half['frame_variants'].values():assert not f['component_collisions_mm3'] and f['usb_envelope_collision_mm3']==0 and f['closed_mesh']
render=json.loads((ROOT/'validation/revG-render.json').read_text());assert render['model_sha256']==sha('design/revG.json')
assert render['renderer_sha256']==sha('tools/render_revG.py')
for item in render['meshes']:assert sha(item['path'])==item['sha256']
for view,item in render['views'].items():assert sha(f'docs/images/revG-{view}.png')==item['image_sha256']
f=json.loads((ROOT/'validation/revG-frames-render.json').read_text());assert f['image_sha256']==sha('docs/images/revG-frames.png')
assert f['renderer_sha256']==sha('tools/render_frames.py')
for item in f['sources']:assert sha(item['path'])==item['sha256']
assert 'docs/images/revG-assembled.png' in (ROOT/'README.md').read_text()
for p in [ROOT/'README.md',ROOT/'ATTRIBUTION.md',ROOT/'CONTRIBUTING.md',*(ROOT/'docs').glob('*.md')]:
    for target in re.findall(r'\]\(([^)]+)\)',p.read_text()):
        if target.startswith(('https:','http:','#','mailto:')):continue
        assert (p.parent/target.split('#')[0]).exists(),(str(p),target)
ui=json.loads((ROOT/'build/viewer-ui-check.json').read_text());assert ui['viewer_sha256']==sha('docs/explore/index.html') and not ui['runtime_errors'] and ui['glb_selected_vertices_exact']
native=json.loads((ROOT/'validation/revG-freecad.json').read_text());assert native['source_sha256']==sha('mechanical/revG/Filo36.FCStd')
# Native App::Link delegates FrameStyle, so the 6 bodies plus 2 active links are sampled.
assert native['opaque_side_wall_samples']==96 and native['configuration_roundtrip']
assert sha('docs/parts.md')==json.loads((ROOT/'validation/revG-parts-links.json').read_text())['document_sha256']
assert not subprocess.check_output(['git','diff','6d7b035','--name-only','--','hardware/revF','design/layout.json'],cwd=ROOT).strip(),'PCB/layout changed outside revision scope'
print('PASS: current native source, 6 closed cover variants, 96 side-wall samples, renders, viewer, documentation paths, unchanged PCB/layout.')
