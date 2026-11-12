#!/usr/bin/env python3
"""Check a configured kit against its native STL sources and 3MF registration.

Usage: python3 tools/check_configured_print_kit.py kit.zip
SPDX-License-Identifier: GPL-3.0-or-later
"""
import hashlib
import io
import json
from pathlib import Path
import struct
import sys
import xml.etree.ElementTree as E
import zipfile

ROOT = Path(__file__).resolve().parents[1]
NS = {'m': 'http://schemas.microsoft.com/3dmanufacturing/core/2015/02'}
sha = lambda data: hashlib.sha256(data).hexdigest()


def verify(path):
    records = []
    with zipfile.ZipFile(path) as archive:
        assert archive.testzip() is None
        manifest = json.loads(archive.read('manifest.json'))
        assert manifest['half'] == 'both' and manifest['scope'] == 'complete'
        assert len(manifest['parts']) == 20
        assert sum(g['count'] for g in manifest['keycaps']['groups']) == 36
        assert not manifest['keycaps']['missing']
        for part in manifest['parts']:
            source = (ROOT / part['source']).read_bytes()
            assert sha(source) == part['source_sha256']
            assert archive.read('STL/' + part['id'] + '.stl') == source
            with zipfile.ZipFile(io.BytesIO(archive.read('3MF/' + part['id'] + '.3mf'))) as model_zip:
                assert model_zip.testzip() is None
                model = E.fromstring(model_zip.read('3D/3dmodel.model'))
            assert model.attrib['unit'] == 'millimeter'
            objects = {o.attrib['id']: o for o in model.findall('m:resources/m:object', NS)}
            items = model.findall('m:build/m:item', NS)
            assert len(items) == 1 and 'transform' not in items[0].attrib
            members = objects[items[0].attrib['objectid']].findall('m:components/m:component', NS)
            assert {c.attrib['objectid'] for c in members} == {str(m['object_id']) for m in part['material_parts']}
            assert all('transform' not in c.attrib for c in members)
            palette = [b.attrib['displaycolor'][:7].lower() for b in model.findall('m:resources/m:basematerials/m:base', NS)]
            assert palette == [part['colors'].get(role, part['colors']['body']) for role in ('body', 'detail', 'accent', 'secondary')]
            count = 0
            for material in part['material_parts']:
                raw = (ROOT / material['source']).read_bytes()
                assert sha(raw) == material['source_sha256']
                if material['source'] != part['source']:
                    assert archive.read(f"Materials/{part['id']}/{material['role']}.stl") == raw
                obj = objects[str(material['object_id'])]
                points = [tuple(float(v.attrib[a])-part['translation_3mf_mm'][i] for i, a in enumerate('xyz'))
                          for v in obj.findall('m:mesh/m:vertices/m:vertex', NS)]
                faces = obj.findall('m:mesh/m:triangles/m:triangle', NS)
                triangles = struct.unpack_from('<I', raw, 80)[0]
                assert len(raw) == 84 + 50*triangles and len(faces) == triangles == material['triangles']
                for i, face in enumerate(faces):
                    actual = [v for key in ('v1', 'v2', 'v3') for v in points[int(face.attrib[key])]]
                    expected = struct.unpack_from('<9f', raw, 96+50*i)
                    assert max(abs(a-b) for a, b in zip(actual, expected)) < 1e-6, part['id']
                count += triangles
            records.append({'id': part['id'], 'triangles': count, 'exact_stl_and_registered_3mf': True})
        for group in manifest['keycaps']['groups']:
            native = ROOT / 'keycaps/variants' / group['file']
            assert archive.read('Keycaps/'+group['file']) == native.read_bytes()
    report = {'passed': True, 'kit_sha256': sha(path.read_bytes()), 'checker_sha256': sha(Path(__file__).read_bytes()),
              'parts': records, 'keycaps': 36, 'physical_acceptance': False, 'slicer_acceptance': False}
    path.with_suffix('.validation.json').write_text(json.dumps(report, indent=2)+'\n')
    print('PASS: exact STL, every 3MF triangle, material colors and all 36 keycaps')


if __name__ == '__main__':
    verify(Path(sys.argv[1]))
