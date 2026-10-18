#!/usr/bin/env python3
"""Verify the current color/frame update and its measured mount-study coverage.
This accepts digital artifacts only, never PCB routing or manufacturing readiness.
SPDX-License-Identifier: GPL-3.0-or-later
"""
from pathlib import Path
import hashlib,json,re,zipfile,subprocess,sys
ROOT=Path(__file__).resolve().parents[1]
sha=lambda p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest()
read=lambda p:json.loads((ROOT/p).read_text())
baseline=read('design/customization-workflow.json')['baseline_commit']
protected=['hardware','design/layout.json','design/revI-profiles.json','design/revI-mounts.json','design/revI-magnets.json','design/revI-wire-study.json','design/batteries.json']
assert not subprocess.check_output(['git','diff',baseline,'--name-only','--',*protected],cwd=ROOT).strip(),'Board, key layout or reference mounting definitions changed'
caps=read('validation/revI-keycaps.json');assert caps['catalog_sha256']==sha('keycaps/catalog.json')
source=sha('mechanical/revI/Flan36.FCStd');model=read('design/revI.json');catalog=read('keycaps/catalog.json')
bridge=read('validation/revI-document-label.json')
assert bridge['passed'] and bridge['output_sha256']==source
assert bridge['all_other_uncompressed_members_identical'] and bridge['label_normalized_xml_equal']
assert bridge['native_open']['label']=='Flan36' and not bridge['native_open']['document_errors']
for entry in bridge['inputs']:assert sha(entry['path'])==entry['sha256']
sys.path.insert(0,str(ROOT/'tools/freecad'))
from preserve_document_label import replace_label_xml
with zipfile.ZipFile(ROOT/'mechanical/revI/Flan36.FCStd') as z:
 assert len(z.namelist())==bridge['member_count']
 rows=sorted([name,hashlib.sha256(z.read(name)).hexdigest()] for name in z.namelist() if name!='Document.xml')
 assert hashlib.sha256(json.dumps(rows,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()==bridge['unchanged_members_aggregate_sha256']
 xml=z.read('Document.xml')
 assert hashlib.sha256(xml).hexdigest()==bridge['output_xml_sha256']
 assert hashlib.sha256(replace_label_xml(xml,'__DOCUMENT_LABEL__')[0]).hexdigest()==bridge['label_normalized_xml_sha256']
prevention=bridge['installer_prevention']
assert sha(prevention['path'])==prevention['after_sha256']
def checked_input(entry):
 # Historical execution retains its actual installer hash. Only the recorded
 # post-save Label correction is allowed to differ from that tested source.
 if entry['path']==prevention['path'] and entry['sha256']!=sha(entry['path']):
  assert entry['sha256']==prevention['before_sha256']
 else:assert sha(entry['path'])==entry['sha256'],entry['path']
assert model['fcstd_sha256']==source
for entry in model['inputs']:checked_input(entry)
for name,part in model['parts'].items():assert sha('mechanical/revI/'+name+'.stl')==part['stl_sha256'],name
native=read('validation/revI-frame-extensions.json')
assert sha('validation/revI-frame-extensions.json')==bridge['prior_geometry_validation']['receipt_sha256']
assert native['output_sha256']==bridge['source_sha256'] and native['source_objects_preserved']==1577
assert native['native_reopen_recompute_passed'] and native['original_geometry_appearance_unchanged'] and native['source_parameters_unchanged']
for entry in native['inputs']:checked_input(entry)
export=read('validation/revI-native-export.json')
assert export['passed'] and export['candidate_sha256']==bridge['source_sha256']
assert export['transformed_execution_sha256']==sha('tools/freecad/export_revI.py')
assert export['boolean_pruning_equivalence']['passed']
for item in export['artifacts']:
 if not item['path'].endswith('.FCStd'):assert sha(item['path'])==item['sha256']
mechanical=read('validation/revI-mechanical.json')
assert sha('validation/revI-mechanical.json')==export['mechanical_report_sha256']
for half in mechanical['halves'].values():
 assert not half['collisions'] and set(half['frame_variants'])==set(catalog['frame_styles'])
 assert len(half['frame_variants'])==10
 for frame in half['frame_variants'].values():assert frame['closed_mesh'] and not frame['component_collisions_mm3'] and frame['usb_envelope_collision_mm3']==0
 for case in half['case_variants'].values():assert case['closed_meshes'] and case['connected_solids'] and not case['component_collisions_mm3']
colors=read('build/keycolors/acceptance.json');cad=read('build/keycolors/freecad.json')
assert colors['keycaps']==colors['distinct_glb_colors']==36 and not colors['runtime_errors']
assert colors['viewer_sha256']==sha('docs/explore/index.html')
assert cad['passed'] and cad['source_unchanged'] and cad['source_sha256']==source and cad['native_save_reopen_roundtrip']
ui=read('build/viewer-ui-check.json');themes=read('build/themes-print/ui.json');kits=read('build/themes-print/print-validation.json')
for receipt in (ui,themes):assert receipt['viewer_sha256']==sha('docs/explore/index.html') and not receipt['runtime_errors']
assert ui['ten_preview_cards'] and ui['glb_selected_vertices_exact'] and ui['small_320px_viewport']
assert themes['global_keycap_colors'] and len(themes['new_frame_print_kits'])==4
assert kits['passed'] and len(kits['kits'])==6
study=read('validation/revI-slim-mounts.json')
assert study['source_sha256']==bridge['source_sha256'] and study['study_execution_complete'] and not study['physical_acceptance']
assert set(study['candidates'])=={'reference-16p6','nominal-15p6','limit-14p8'}
assert study['checker_sha256']==sha('tools/freecad/study_slim_mounts.py')
for path,digest in study['inputs'].items():
 if path=='tools/freecad/export_revI.py':assert digest==export['source_exporter_sha256']
 else:assert sha(path)==digest,path
with zipfile.ZipFile(ROOT/'mechanical/studies/slim-mounts.zip') as z:
 assert json.loads(z.read('report.json'))==study
 for item in study['artifacts']:assert hashlib.sha256(z.read(item['path'])).hexdigest()==item['sha256']
for p in [ROOT/'README.md',*(ROOT/'docs').glob('*.md')]:
 for target in re.findall(r'\]\(([^)]+)\)',p.read_text()):
  if not target.startswith(('https:','http:','#','mailto:')):assert (p.parent/target.split('#')[0]).exists(),(p,target)
inputs=['docs/explore/index.html','keycaps/catalog.json','design/keycap-themes.json','design/themes.json',
 'viewer/keycap-colors.js','viewer/keycolors-check.cjs','viewer/customize-check.cjs','tools/check_print_kit.py',
 'tools/freecad/check_keycolors.py','tools/freecad/configuration.py','tools/package_slim_study.py',
 'validation/revI-frame-extensions.json','validation/revI-document-label.json','validation/revI-native-export.json',
 'tools/freecad/preserve_document_label.py','tools/freecad/install_extra_frames.py',
 'validation/revI-mechanical.json','validation/revI-slim-mounts.json',
 'mechanical/studies/slim-mounts.zip']
report={'digital_update_accepted':True,'manufacturing_qualified':False,'native_source_sha256':source,
 'inputs':[{'path':p,'sha256':sha(p)} for p in inputs],
 'key_colors':colors,'native_colors':cad,'viewer':ui,'themes':themes,'print_kits':kits,
 'mount_study_summaries':{name:c['summary'] for name,c in study['candidates'].items()}}
(ROOT/'validation/revI-customization.json').write_text(json.dumps(report,indent=2)+'\n')
print('PASS: colors, ten native frames, exact print exports and complete measured mount-study coverage; physical acceptance remains open.')
