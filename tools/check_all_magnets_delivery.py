#!/usr/bin/env python3
"""Bind and verify the same-envelope magnet substitution and its current outputs.

Run after apply_frame_magnets.py, check_frame_magnets.py, render_revI.py,
build_viewer_revI.py, viewer/build.mjs and check_stock_print.py.
SPDX-License-Identifier: GPL-3.0-or-later
"""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sha = lambda path: hashlib.sha256((ROOT/path).read_bytes()).hexdigest()
read = lambda path: json.loads((ROOT/path).read_text())
native = read('validation/revI-all-magnets-native.json')
reopen = read('validation/revI-all-magnets-reopen.json')
model = read('design/revI.json')
spec = read('design/revI-magnets.json')
assert native['passed'] and reopen['passed']
assert sha('mechanical/revI/Flan36.FCStd') == native['native_sha256'] == reopen['native_sha256'] == model['fcstd_sha256']
assert native['script_sha256'] == sha('tools/freecad/apply_frame_magnets.py')
assert reopen['checker_sha256'] == sha('tools/freecad/check_frame_magnets.py')
assert model['all_magnets'] == spec
assert spec['base_magnet_count'] == spec['frame_magnet_count'] == 6
assert [spec['magnet_diameter'],spec['magnet_height'],spec['frame_magnet_diameter'],spec['frame_magnet_height']] == [2,3,2,4]
assert not any(key.startswith('steel_') for key in spec)
assert read('validation/revI-mechanical.json')['source_sha256'] == native['source_sha256']
for entry in native['export_files_identical'] + model['inputs']:
    assert sha(entry['path']) == entry['sha256'], entry['path']
assert len([p for p in model['parts'].values() if 'Captive frame magnet' in p['role']]) == 6
scene = read('build/viewer-scene.json')
assert len([p for p in scene['parts'] if ' · Captive frame magnet ' in p['name']]) == 6
assert len([p for p in scene['parts'] if ' · Captive base magnet ' in p['name']]) == 6
for entry in scene['sources']: assert sha(entry['path']) == entry['sha256'], entry['path']
viewer = read('validation/revI-viewer.json')
assert sha('docs/index.html') == viewer['viewer_sha256']
assert sha('docs/offline.html') == viewer['offline_sha256']
assert sha(viewer['printing']['path']) == viewer['printing']['sha256']
render = read('validation/revI-render.json')
for entry in render['sources'] + render['meshes']: assert sha(entry['path']) == entry['sha256'], entry['path']
for view, entry in render['views'].items(): assert sha(f'docs/images/revI-{view}.png') == entry['image_sha256']
printing = read('build/stock-print/validation.json')
assert printing['passed'] and printing['all_magnet_joining_and_polarity_checked']
assert printing['scene_sha256'] == sha('build/viewer-scene.json')
assert printing['checker_sha256'] == sha('tools/check_stock_print.py')
assert len(printing['kits']) == 6
for kit in printing['kits']: assert sha('build/stock-print/'+kit['style']+'.zip') == kit['sha256']
(ROOT/'validation/revI-all-magnets-print.json').write_text(json.dumps(printing, indent=2)+'\n')
paths = ['mechanical/revI/Flan36.FCStd','design/revI.json','design/revI-magnets.json',
         'validation/revI-all-magnets-native.json','validation/revI-all-magnets-reopen.json',
         'validation/revI-all-magnets-print.json','validation/revI-viewer.json','validation/revI-render.json',
         'docs/build.md','docs/parts.md','viewer/printing.js','tools/check_all_magnets_delivery.py']
report = {
    'schema': 'flan36-all-magnets-delivery-1', 'date': '2026-10-11',
    'scope': 'Replace six steel frame targets with same-envelope axial magnets; update CAD, assembly, BOM, viewer and print kits.',
    'baseline_commit': native['baseline_commit'],
    'artifacts': [{'path': path, 'sha256': sha(path)} for path in paths],
    'digital_checks_passed': True, 'physical_acceptance': False,
    'installed': {'base': {'count':6,'diameter_mm':2,'height_mm':3}, 'frame': {'count':6,'diameter_mm':2,'height_mm':4}, 'magnetization':'axial'},
    'checks': {'native': 'Only six Label/Label2 pairs changed; all other XML and 12746 opaque members identical; saved document reopened in FreeCAD',
               'geometry': f"{len(native['export_files_identical'])} STL/STEP/WRL exports including KiCad models identical to baseline; prior geometric acceptance transferred by identity, not recomputed",
               'printing': 'Six complete kits: exact source STL bytes, every translated 3MF triangle, roof height and all-magnet polarity/capture instructions',
               'viewer': '220 objects and 260 meshes; six base and six frame magnet names; online/offline/payload source hashes checked',
               'renders': 'Seven views regenerated and sources/image hashes checked'},
    'review': {'independent_domain':'Same-envelope Ø2x4 frame magnet substitution accepted',
              'independent_adversarial':'Same configuration accepted with polarity/capture/thermal qualification',
              'dispositions': ['Polarity checked before closure; inverted printing uses final mating faces',
                               'Actual stock measured and thermal specification used; no assumed force rating',
                               'Native geometry retained with stable legacy IDs; no broad reconstruction',
                               'Physical coupon and whole-frame peel/sliding/cycling remain untested'],
              'unresolved_material_objections': []},
    'retrospective': {'trigger':'Use only magnets already available, without extra steel purchases',
                      'correction':'Six axial frame magnets use the exact previous target envelope',
                      'prevention':'Print-kit readme and manifest are verified against the current magnet specification; geometry identity guards unrelated CAD refinements'},
    'reproduction':'See docs/cad.md#all-magnet-frame-closure; build/stock-print is ignored and regenerated by tools/check_stock_print.py',
    'limits':['Actual magnet dimensions/grade and thermal exposure', 'Physical capture, mating polarity and whole-frame holding force']}
(ROOT/'validation/revI-all-magnets-delivery.json').write_text(json.dumps(report, indent=2)+'\n')
print('PASS: all-magnet CAD, preserved geometry, viewer, renders and six print kits agree')
