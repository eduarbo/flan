#!/usr/bin/env python3
"""Replace frame steel specifications with same-envelope magnets, without rebuilding.

Run: python3 tools/freecad/apply_frame_magnets.py
The exact preceding native file is read from Git. Only six Label and Label2
properties change; every other XML byte and every opaque ZIP member is retained.
SPDX-License-Identifier: GPL-3.0-or-later
"""
import hashlib
import copy
import io
import json
import re
import subprocess
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = '881735e2bed88894a9d7c7b89b8d2b6fac2c2e29'
NATIVE = 'mechanical/revI/Flan36.FCStd'
SOURCE_HASH = '62ee8d7556e553f4946584870a0fc746f2b9cba7085b0b50a13e9192691b1eea'
NOTE = 'Axially magnetized neodymium; opposite mating pole to base; verify attraction before embedding. Physical retention untested.'
sha = lambda data: hashlib.sha256(data).hexdigest()


def migrate():
    source = subprocess.check_output(['git', 'show', f'{BASE}:{NATIVE}'], cwd=ROOT)
    assert sha(source) == SOURCE_HASH
    destination = ROOT / NATIVE
    with zipfile.ZipFile(io.BytesIO(source)) as original:
        xml = original.read('Document.xml').decode()
        before = ET.fromstring(xml)
        labels = {}
        for prefix in ('L_', 'R_'):
            for index in range(3):
                name = f'{prefix}SteelTarget{index}'
                obj = before.find(f"ObjectData/Object[@name='{name}']")
                prop = obj.find("Properties/Property[@name='Label']/String")
                label = prop.attrib['value'].replace('steel pin', 'frame magnet')
                labels[name] = label
                pattern = rf'(<Object name="{name}"[^>]*>)(.*?)(</Object>)'
                match = re.search(pattern, xml, re.S)
                body = match[2]
                body, count = re.subn(r'(<Property name="Label"[^>]*>\s*<String value=")[^"]*("\s*/>)', lambda m: m[1]+label+m[2], body)
                assert count == 1
                body, count = re.subn(r'(<Property name="Label2"[^>]*>\s*<String value=")[^"]*("\s*/>)', lambda m: m[1]+NOTE+m[2], body)
                assert count == 1
                xml = xml[:match.start(2)] + body + xml[match.end(2):]
        after = ET.fromstring(xml)
        # Restore only allowed values; the full document must then equal baseline.
        for name in labels:
            for field in ('Label', 'Label2'):
                path = f"ObjectData/Object[@name='{name}']/Properties/Property[@name='{field}']/String"
                after.find(path).attrib = before.find(path).attrib.copy()
        assert ET.tostring(before) == ET.tostring(after)
        output = io.BytesIO()
        with zipfile.ZipFile(output, 'w') as result:
            result.comment = original.comment
            for info in original.infolist():
                result.writestr(copy.copy(info), xml.encode() if info.filename == 'Document.xml' else original.read(info.filename))
        candidate = output.getvalue()
        # Do not overwrite a native document that changed outside this migration.
        assert sha(destination.read_bytes()) in (SOURCE_HASH, sha(candidate)), 'Native source changed'
        with zipfile.ZipFile(io.BytesIO(candidate)) as result:
            assert result.namelist() == original.namelist()
            unchanged = [name for name in original.namelist() if name != 'Document.xml']
            assert all(original.read(name) == result.read(name) for name in unchanged)
        destination.write_bytes(candidate)
    # Geometry exports must also remain exactly the preceding committed objects.
    exports = []
    paths = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', BASE, 'mechanical/revI', 'hardware/revI'], cwd=ROOT).decode().splitlines()
    for path in paths:
        if Path(path).suffix.lower() not in ('.stl', '.step', '.wrl'): continue
        data = (ROOT/path).read_bytes()
        expected = subprocess.check_output(['git', 'rev-parse', f'{BASE}:{path}'], cwd=ROOT).decode().strip()
        actual = hashlib.sha1(f'blob {len(data)}\0'.encode()+data).hexdigest()
        assert actual == expected, path
        exports.append({'path': path, 'sha256': sha(data)})
    metadata_path = ROOT/'design/revI.json'
    metadata = json.loads(metadata_path.read_text())
    for part in metadata['parts'].values():
        if part['object'] in labels: part['role'] = labels[part['object']]
    metadata['fcstd_sha256'] = sha(candidate)
    metadata['all_magnets'] = json.loads((ROOT/'design/revI-magnets.json').read_text())
    metadata['export_execution'] = {
        'native_sha256': sha(candidate), 'analyzed_native_sha256': SOURCE_HASH,
        'receipt': 'validation/revI-mechanical.json',
        'geometry_identity_receipt': 'validation/revI-all-magnets-native.json',
        'method': 'Exports retained byte-for-byte; only six native Label and Label2 properties changed. No geometry recomputation claimed.'}
    script_path = Path(__file__).relative_to(ROOT).as_posix()
    if not any(entry['path'] == script_path for entry in metadata['inputs']):
        metadata['inputs'].append({'path': script_path})
    for entry in metadata['inputs']:
        entry['sha256'] = sha((ROOT/entry['path']).read_bytes())
    metadata_path.write_text(json.dumps(metadata, indent=2)+'\n')
    report = {'passed': True, 'baseline_commit': BASE, 'source_sha256': SOURCE_HASH,
              'native_sha256': sha(candidate), 'script_sha256': sha(Path(__file__).read_bytes()),
              'allowed_changes': ['Label', 'Label2'], 'objects': labels,
              'other_xml_unchanged': True, 'opaque_members_identical': len(unchanged),
              'export_files_identical': exports, 'geometry_recomputed': False,
              'physical_acceptance': False,
              'legacy_ids': 'SteelTarget and frame-target remain stable identifiers; both inserts are now axially magnetized neodymium.'}
    (ROOT/'validation/revI-all-magnets-native.json').write_text(json.dumps(report, indent=2)+'\n')
    print(f'PASS: six frame magnet specifications; {len(unchanged)} opaque native members and {len(exports)} exports unchanged')


if __name__ == '__main__': migrate()
