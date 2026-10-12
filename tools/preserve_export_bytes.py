#!/usr/bin/env python3
"""Preserve proven-identical export bytes after the bounded port refinement.

Only a STEP FILE_NAME timestamp or binary STL facet enumeration/header may
differ. Geometry, normals, winding, attributes and duplicate facets must agree.
The completed exporter receipt is checked before any write; historic receipts
are never changed. SPDX-License-Identifier: GPL-3.0-or-later
"""
import argparse
import collections
import hashlib
import json
import re
import struct
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = 'b86574ae5366a4d0ee397d3c3683c709b899a67d'
RECEIPT = 'validation/revI-export-preservation.json'
SCRIPT = 'tools/preserve_export_bytes.py'
TIMESTAMP = re.compile(rb"(FILE_NAME\('[^']*',')[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:]{8}(')")

def digest(data): return hashlib.sha256(data).hexdigest()
def sha(path): return digest((ROOT / path).read_bytes())
def read(path): return json.loads((ROOT / path).read_text())
def write(path, value): (ROOT / path).write_text(json.dumps(value, indent=2) + '\n')
def records(mapping): return [{'file': n, 'sha256': h} for n,h in mapping.items()]
def mapping(items): return items if isinstance(items, dict) else {i['file']: i['sha256'] for i in items}
def save_report(report, model, mechanical):
    report['normalizer_sha256'] = sha(SCRIPT)
    write(RECEIPT, report)
    provenance = {'tool': SCRIPT, 'sha256': sha(SCRIPT), 'receipt': RECEIPT,
        'receipt_sha256': sha(RECEIPT), 'baseline_commit': BASE,
        'method': 'Preserve exact baseline bytes only after timestamp-only STEP or complete binary STL facet-record equality proof'}
    model['inputs'] = [i for i in model['inputs'] if i['path'] != SCRIPT] + [{'path': SCRIPT, 'sha256': sha(SCRIPT)}]
    model['export_execution']['byte_preservation'] = provenance
    mechanical['byte_preservation'] = provenance
    write('design/revI.json', model)
    write('validation/revI-mechanical.json', mechanical)
def original(path):
    return subprocess.run(['git', 'show', f'{BASE}:{path}'], cwd=ROOT,
                          check=True, capture_output=True).stdout

def facets(raw):
    if len(raw) < 84: return None
    count = struct.unpack_from('<I', raw, 80)[0]
    if len(raw) != 84 + count * 50: return None
    return collections.Counter(raw[i:i+50] for i in range(84, len(raw), 50))

def proof(old, new, suffix):
    if suffix == '.step':
        a, na = TIMESTAMP.subn(rb'\1TIMESTAMP\2', old)
        b, nb = TIMESTAMP.subn(rb'\1TIMESTAMP\2', new)
        if na == nb == 1 and a == b: return 'STEP FILE_NAME timestamp only'
    if suffix == '.stl':
        a, b = facets(old), facets(new)
        if a is not None and b is not None and a == b:
            return 'Identical complete binary facet-record multiset'
    return None

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', help='Write proven-identical bytes and current manifests')
    parser.add_argument('--upgrade-receipt', action='store_true', help='Revalidate and convert a bound v1 receipt to explicit filename/hash records; changes no export')
    args = parser.parse_args()
    model = read('design/revI.json')
    mechanical = read('validation/revI-mechanical.json')
    ports = read('validation/revI-ports.json')
    bound_paths = ('mechanical/revI/Flan36.FCStd','tools/freecad/export_revI.py',
                   SCRIPT,'design/revI.json','validation/revI-mechanical.json','validation/revI-ports.json')
    source_snapshot = {p: sha(p) for p in bound_paths}
    assert ports['passed'] and ports['native_sha256'] == model['fcstd_sha256'] == mechanical['source_sha256'] == sha('mechanical/revI/Flan36.FCStd')
    assert mechanical['checker_sha256'] == sha('tools/freecad/export_revI.py')
    if 'byte_preservation' in mechanical:
        existing = read(RECEIPT)
        assert existing['native_sha256'] == model['fcstd_sha256']
        assert mechanical['byte_preservation'] == model['export_execution']['byte_preservation']
        assert mechanical['byte_preservation']['receipt_sha256'] == sha(RECEIPT)
        assert mapping(existing['exported_files_after']) == mechanical['exported_files']
        assert all(sha('mechanical/revI/'+n) == h for n,h in mechanical['exported_files'].items())
        if args.upgrade_receipt:
            assert existing['schema'] == 'flan36-exact-export-preservation-1'
            assert existing['normalizer_sha256'] == mechanical['byte_preservation']['sha256']
            before, after = mapping(existing['exported_files_before']), mapping(existing['exported_files_after'])
            expected = dict(before)
            for item in existing['preserved']:
                assert digest(original(item['path'])) == item['final_sha256'] == sha(item['path'])
                assert before[Path(item['path']).name] == item['generated_sha256']
                expected[Path(item['path']).name] = item['final_sha256']
            assert expected == after
            existing['receipt_upgrade'] = {'previous_receipt_sha256': sha(RECEIPT),
                'preservation_executor_sha256': existing['normalizer_sha256'],
                'method': 'Current native, all exports and preserved baseline bytes revalidated; checksum maps converted to explicit filename/hash records without changing evidence or exported bytes'}
            existing['schema'] = 'flan36-exact-export-preservation-2'
            existing['exported_files_before'], existing['exported_files_after'] = records(before), records(after)
            assert all(sha(p) == h for p,h in source_snapshot.items()), 'Bound inputs changed'
            assert all(sha('mechanical/revI/'+n) == h for n,h in after.items())
            save_report(existing, model, mechanical)
            print('PASS: receipt format upgraded; all 448 exported files unchanged')
            return
        assert existing['normalizer_sha256'] == sha(SCRIPT)
        print('PASS: existing exact-byte preservation receipt remains current')
        return
    baseline_model = json.loads(original('design/revI.json'))
    before = dict(mechanical['exported_files'])
    candidates = []
    for name, expected in before.items():
        assert Path(name).name == name and Path(name).suffix in ('.step', '.stl'), name
        path = 'mechanical/revI/' + name
        generated = (ROOT/path).read_bytes()
        assert digest(generated) == expected, ('Incomplete or changed export', name)
        baseline = original(path)
        if baseline == generated: continue
        reason = proof(baseline, generated, Path(name).suffix)
        if reason:
            candidates.append((path, baseline, {'path': path, 'proof': reason,
                'generated_sha256': expected, 'final_sha256': digest(baseline)}))
    print(f'{len(candidates)} of {len(before)} exports can retain their exact baseline bytes')
    if not args.apply: return
    expected_after = dict(before)
    for path, _, item in candidates:
        expected_after[Path(path).name] = item['final_sha256']
    assert all(sha(p) == h for p,h in source_snapshot.items()), 'Export inputs changed'
    assert all(sha('mechanical/revI/'+n) == h for n,h in before.items()), 'Exports changed during analysis'
    # Recheck candidates individually and the entire set after installation;
    # unrelated concurrent output changes must never be adopted into a receipt.
    for path, baseline, item in candidates:
        assert sha(path) == item['generated_sha256'], path
        (ROOT/path).write_bytes(baseline)
    assert all(sha('mechanical/revI/'+n) == h for n,h in expected_after.items()), 'Unexpected export writer'
    assert all(sha(p) == h for p,h in source_snapshot.items()), 'Export inputs changed during installation'
    mechanical['exported_files'] = expected_after
    for name, part in model['parts'].items():
        part['stl_sha256'] = sha('mechanical/revI/' + name + '.stl')
    for variant in model['frameVariants'].values():
        for part in variant['material_parts']:
            for ext in ('stl', 'step'):
                part[ext + '_sha256'] = sha('mechanical/revI/' + part[ext])
    report = {'schema': 'flan36-exact-export-preservation-2', 'passed': True,
        'baseline_commit': BASE, 'baseline_native_sha256': baseline_model['fcstd_sha256'],
        'native_sha256': model['fcstd_sha256'], 'normalizer_sha256': sha(SCRIPT),
        'exporter_sha256': sha('tools/freecad/export_revI.py'),
        'exported_files_before': records(before), 'exported_files_after': records(mechanical['exported_files']),
        'preserved': [item for _, _, item in candidates],
        'physical_acceptance': False}
    save_report(report, model, mechanical)
    assert all(sha('mechanical/revI/'+name) == value for name, value in mechanical['exported_files'].items())
    print('PASS: current manifests bind final bytes; historical receipts unchanged')

if __name__ == '__main__': main()
