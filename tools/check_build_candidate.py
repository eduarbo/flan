#!/usr/bin/env python3
"""Check shipped PCB ZIPs and UF2s against their source-bound evidence, without regenerating.
SPDX-License-Identifier: GPL-3.0-or-later
"""
import argparse
import hashlib
import json
import re
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DATE = re.compile(rb'CreationDate|^G04 Created|^; DRILL file|SVG Image created', re.M)


def undated(data):
    # Same non-geometric export-date exclusions as export_editions.py.
    return b'\n'.join(line for line in data.split(b'\n') if not DATE.search(line))


def sha(data):
    return hashlib.sha256(data).hexdigest()


def read(path):
    return json.loads((ROOT / path).read_text())


def verify():
    result = {'physical_acceptance': False, 'variants': {}}
    model, mechanical = read('design/revI.json'), read('validation/revI-mechanical.json')
    native = sha((ROOT / 'mechanical/revI/Flan36.FCStd').read_bytes())
    assert native == model['fcstd_sha256'] == mechanical['source_sha256']
    changed_inputs = [source['path'] for source in model['inputs']
                      if sha((ROOT / source['path']).read_bytes()) != source['sha256']]
    for name, digest in mechanical['exported_files'].items():
        assert sha((ROOT / 'mechanical/revI' / name).read_bytes()) == digest, name
    for filename in ('revI-ports', 'revI-ports-reopen'):
        receipt = read(f'validation/{filename}.json')
        assert receipt['passed'] and receipt['native_sha256'] == native
    result['mechanical'] = {'native_sha256': native, 'revI_exports': len(mechanical['exported_files']),
                            'generation_tools_changed_since_export': changed_inputs,
                            'verification': 'Current files match recorded CAD checks; no new physical or CAD-kernel test'}
    for keyboard in ('flan36', 'flan42', 'flan46', 'flan54'):
        rev = 'revI' if keyboard == 'flan36' else keyboard
        if keyboard != 'flan36':
            case = read(f'validation/{keyboard}-case.json')
            assert case['source']['sha256'] == native
            for side, half in case['halves'].items():
                for style, parts in half['cases'].items():
                    for part in ('base', 'plate'):
                        path = f'mechanical/{keyboard}/{side}-case-{style}-{part}.stl'
                        assert sha((ROOT / path).read_bytes()) == parts[part]['stl_sha256'], path
        fabrication, editions, firmware = [read(f'validation/{rev}-{kind}.json') for kind in ('fabrication', 'editions', 'firmware')]
        for source in firmware['sources']:
            assert sha((ROOT / source['path']).read_bytes()) == source['sha256'], source['path']
        binaries = {}
        for variant, evidence in firmware['variants'].items():
            name = keyboard + '-' + variant if keyboard == 'flan36' else variant
            path = f'firmware/uf2/{name}.uf2'
            assert sha((ROOT / path).read_bytes()) == evidence['uf2_sha256'], path
            for source in evidence['build_attestation']['inputs']['sources']:
                assert sha((ROOT / source['path']).read_bytes()) == source['sha256'], source['path']
            binaries[path] = evidence['uf2_sha256']
        packages = {}
        for side, evidence in fabrication['halves'].items():
            manifest = evidence['manifest']
            for extension, field in [('kicad_pcb', 'pcb_sha256'), ('kicad_sch', 'schematic_sha256'), ('kicad_pro', 'rules_sha256')]:
                path = f'hardware/{rev}/{keyboard}-{side}.{extension}'
                assert sha((ROOT / path).read_bytes()) == manifest['source'][field], path
            for field in ('drc_violations', 'erc_violations', 'schematic_parity', 'unconnected_items'):
                assert manifest['source'][field] == 0, (keyboard, side, field)
            path = evidence['package']
            assert sha((ROOT / path).read_bytes()) == evidence['sha256'], path
            with zipfile.ZipFile(ROOT / path) as archive:
                assert archive.testzip() is None
                assert json.loads(archive.read('manifest.json')) == manifest
                base = {name: archive.read(name) for name in manifest['files']}
                for name, data in base.items():
                    assert sha(data) == manifest['files'][name], (path, name)
            packages[path] = evidence['sha256']
            assert editions['base'][side]['pcb_sha256'] == manifest['source']['pcb_sha256']
            assert editions['base'][side]['package_sha256'] == evidence['sha256']
            for edition in editions['editions'].values():
                e = edition['halves'][side]; path = e['package']
                assert sha((ROOT / path).read_bytes()) == e['package_sha256'], path
                with zipfile.ZipFile(ROOT / path) as archive:
                    assert archive.testzip() is None
                    changed = [name for name, data in base.items() if undated(archive.read(name)) != undated(data)]
                    assert changed == [f'{keyboard}-{side}-B_Silkscreen.gbo'], (path, changed)
                packages[path] = e['package_sha256']
        result['variants'][keyboard] = {'pcb_packages': packages, 'firmware': binaries}
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'build/build-candidate.json')
    args = parser.parse_args()
    result = verify()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print('PASS: 56 PCB packages and 12 shipped UF2s match current sources and recorded build evidence; physical acceptance pending')
