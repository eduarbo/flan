#!/usr/bin/env python3
"""Verify the current port refinement, scene and downloadable viewer/print kits.

Historical all-magnet receipts describe their original revision. This checker binds
that retained closure to the new port geometry without claiming geometry identity
for the complete keyboard. Run after the CAD/scene/viewer/render/print checks.
SPDX-License-Identifier: GPL-3.0-or-later
"""
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
def read(path): return json.loads((ROOT/path).read_text())
def sha(path): return hashlib.sha256((ROOT/path).read_bytes()).hexdigest()
def entries(items):
    for item in items:
        assert sha(item['path']) == item['sha256'], item['path']

ports = read('validation/revI-ports.json')
reopen = read('validation/revI-ports-reopen.json')
model = read('design/revI.json')
mechanical = read('validation/revI-mechanical.json')
assert ports['passed'] and reopen['passed']
assert ports['native_sha256'] == reopen['native_sha256'] == model['fcstd_sha256'] == mechanical['source_sha256'] == sha('mechanical/revI/Flan36.FCStd')
assert ports['recipe_sha256'] == sha('design/revI-ports.json')
assert ports['installer_sha256'] == sha('tools/freecad/refine_ports.py')
assert reopen['checker_sha256'] == sha('tools/freecad/check_ports.py')
assert ports['magnet_shapes_unchanged'] and ports['unrelated_part_shapes_unchanged'] > 0
assert len(ports['halves']) == len(reopen['halves']) == 2
assert reopen['magnet_count'] == 12 and len(reopen['magnets']) == 6
for station in reopen['magnets']:
    assert station['base_mm'] == [2,3] and station['frame_mm'] == [2,4]
    assert abs(station['gap_mm']-.9) < 1e-8
for change in ports['bounded_changes'].values():
    assert change['removed_mm3'] < .001 and change['outside_port_zones_mm3'] < .001
assert not ports['physical_acceptance'] and not reopen['physical_acceptance']
port_render = read('validation/revI-port-render.json')
assert port_render['baseline_commit'] == 'b86574ae5366a4d0ee397d3c3683c709b899a67d'
assert port_render['renderer_sha256'] == sha('tools/render_port_refinement.py')
assert port_render['image_sha256'] == sha('docs/images/revI-port-refinement.png')
assert not port_render['physical_acceptance']
for item in port_render['sources']:
    assert item['after_sha256'] == sha(item['path']), item['path']
entries(model['inputs'])
for name, digest in mechanical['exported_files'].items():
    assert sha('mechanical/revI/'+name) == digest, name
preservation = read('validation/revI-export-preservation.json')
assert preservation['schema'] == 'flan36-exact-export-preservation-2'
before_files = {i['file']:i['sha256'] for i in preservation['exported_files_before']}
after_files = {i['file']:i['sha256'] for i in preservation['exported_files_after']}
assert len(before_files) == len(preservation['exported_files_before'])
assert len(after_files) == len(preservation['exported_files_after'])
assert preservation['passed'] and preservation['native_sha256'] == model['fcstd_sha256']
assert preservation['normalizer_sha256'] == sha('tools/preserve_export_bytes.py')
assert preservation['exporter_sha256'] == mechanical['checker_sha256'] == sha('tools/freecad/export_revI.py')
assert after_files == mechanical['exported_files']
assert model['export_execution']['byte_preservation'] == mechanical['byte_preservation']
assert mechanical['byte_preservation']['receipt_sha256'] == sha('validation/revI-export-preservation.json')
preserved = {Path(i['path']).name: i for i in preservation['preserved']}
assert len(preserved) == len(preservation['preserved'])
for name, before in before_files.items():
    after = after_files[name]
    if name not in preserved:
        assert before == after, name
    else:
        item = preserved[name]
        assert before == item['generated_sha256'] and after == item['final_sha256']
        assert item['proof'] in ('STEP FILE_NAME timestamp only','Identical complete binary facet-record multiset')
        original = subprocess.run(['git','show',preservation['baseline_commit']+':'+item['path']],cwd=ROOT,check=True,capture_output=True).stdout
        assert hashlib.sha256(original).hexdigest() == after, name
spec = read('design/revI-magnets.json')
assert model['all_magnets'] == spec
assert [spec['base_magnet_count'],spec['frame_magnet_count'],spec['magnet_diameter'],spec['magnet_height'],spec['frame_magnet_diameter'],spec['frame_magnet_height']] == [6,6,2,3,2,4]
scene = read('build/viewer-scene.json'); entries(scene['sources'])
assert sum('Captive frame magnet' in p['name'] for p in scene['parts']) == 6
assert sum('Captive base magnet' in p['name'] for p in scene['parts']) == 6
viewer = read('validation/revI-viewer.json'); entries(viewer['sources'])
assert viewer['viewer_sha256'] == sha('docs/explore/index.html')
assert viewer['offline_sha256'] == sha('docs/explore/offline.html')
assert viewer['printing']['sha256'] == sha(viewer['printing']['path'])
render = read('validation/revI-render.json'); entries(render['sources'] + render['meshes'])
for view,item in render['views'].items():
    assert item['image_sha256'] == sha(f'docs/images/revI-{view}.png')
printing = read('build/stock-print/validation.json')
assert printing['passed'] and printing['all_magnet_joining_and_polarity_checked']
assert printing['scene_sha256'] == sha('build/viewer-scene.json')
assert printing['checker_sha256'] == sha('tools/check_stock_print.py')
assert len(printing['kits']) == 6
for kit in printing['kits']:
    assert kit['sha256'] == sha('build/stock-print/'+kit['style']+'.zip')
interaction = read('validation/revI-interaction.json')
assert interaction['passed']; entries(interaction['sources'])
assert interaction['final_build_smoke']['viewer_sha256'] == sha('docs/explore/index.html')
assert interaction['final_build_smoke']['scene_sha256'] == sha('build/viewer-scene.json')
assert interaction['final_build_smoke']['native_sha256'] == model['fcstd_sha256']
paths=['mechanical/revI/Flan36.FCStd','design/revI.json','design/revI-ports.json','design/revI-magnets.json',
       'validation/revI-ports.json','validation/revI-ports-reopen.json','validation/revI-port-render.json','validation/revI-mechanical.json',
       'validation/revI-export-preservation.json','tools/preserve_export_bytes.py',
       'validation/revI-viewer.json','validation/revI-render.json','validation/revI-interaction.json',
       'viewer/printing.js','tools/check_stock_print.py','tools/check_interaction_delivery.py']
report={'schema':'flan36-port-interaction-delivery-1','baseline_commit':'b86574ae5366a4d0ee397d3c3683c709b899a67d',
        'passed':True,'physical_acceptance':False,
        'scope':'Bounded USB/power aperture refinement and requested viewer navigation/visual redesign',
        'artifacts':[{'path':p,'sha256':sha(p)} for p in paths],
        'checks':{'native_access_and_appearance':'Saved native reopen; both halves and all case/frame variants',
                  'magnetic_closure':'All twelve magnet shapes retained; six base 2x3 and six frame 2x4 cylinders',
                  'printing':'Six complete Level kits; exact source STL bytes and all registered color 3MF triangles',
                  'browser':'Task-integrated browser CUA checks recorded separately; no claim of unexecuted Playwright suites'},
        'print_kits':printing,'review':'docs/reviews/interaction-refinement.md',
        'reproduction':'Follow docs/reviews/interaction-refinement.md; build/ artifacts are ignored and reproducible',
        'limits':['Actual cable insertion and switch operation in an assembled print','Magnet polarity, temperature/capture and frame retention require physical acceptance']}
(ROOT/'validation/revI-interaction-delivery.json').write_text(json.dumps(report,indent=2)+'\n')
print('PASS: native ports, retained magnets, UI sources, online/offline viewer, renders and six print kits agree')
