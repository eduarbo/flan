#!/usr/bin/env python3
"""Check current print-kit downloads against native STL and material coordinates.

Run after build_viewer_revI.py and viewer/build.mjs. Uses the production printKit
function in Node, without browser automation or printer/slicer acceptance.
SPDX-License-Identifier: GPL-3.0-or-later
"""
from pathlib import Path
import hashlib
import io
import json
import struct
import subprocess
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'build/stock-print'
OUT.mkdir(parents=True, exist_ok=True)
sha = lambda value: hashlib.sha256(value).hexdigest()
scene_path = ROOT / 'build/viewer-scene.json'
scene = json.loads(scene_path.read_text())
metadata = json.loads((ROOT / 'design/revI.json').read_text())
assert metadata['stock_display_connector']['board_separation_mm'] == 7
for item in scene['sources']:
    assert sha((ROOT / item['path']).read_bytes()) == item['sha256'], item['path']
code = r"""
const fs=require('fs'),path=require('path');
const root=process.argv[2],out=process.argv[3],viewer=path.join(root,'viewer');
require(path.join(viewer,'node_modules/esbuild')).buildSync({stdin:{contents:"export {printKit} from './printing.js'; export {normalize} from './config.js';",resolveDir:viewer},bundle:true,platform:'node',format:'cjs',outfile:path.join(out,'printing.cjs')});
const {printKit,normalize}=require(path.join(out,'printing.cjs'));
const scene=JSON.parse(fs.readFileSync(path.join(root,'build/viewer-scene.json')));
global.requestAnimationFrame=fn=>setImmediate(fn);
(async()=>{for(const style of Object.keys(scene.catalog.frame_styles)){
 const cfg=normalize(structuredClone(scene.catalog.default_configuration),scene.catalog);
 for(const side of ['left','right']){cfg.cases[side].style='level';cfg.cases[side].cover=true;cfg.frames[side].style=style;}
 const result=await printKit(cfg,scene.printing,{half:'both',scope:'complete'});
 fs.writeFileSync(path.join(out,style+'.zip'),result.bytes);
}})().catch(error=>{console.error(error);process.exitCode=1;});
"""
script = OUT / 'generate.cjs'
script.write_text(code)
subprocess.run(['node', str(script), str(ROOT), str(OUT)], check=True)
ns = {'m': 'http://schemas.microsoft.com/3dmanufacturing/core/2015/02'}
results = []
for style in scene['catalog']['frame_styles']:
    kit = OUT / (style + '.zip')
    with zipfile.ZipFile(kit) as archive:
        manifest = json.loads(archive.read('manifest.json'))
        assert manifest['configuration'] == json.loads(archive.read('Flan36-config.json'))
        assert len(manifest['parts']) == 2 * (3 + len(scene['printing']['supports']))
        materials = 0
        for part in manifest['parts']:
            native = (ROOT / part['source']).read_bytes()
            assert archive.read('STL/' + part['id'] + '.stl') == native
            assert sha(native) == part['source_sha256']
            with zipfile.ZipFile(io.BytesIO(archive.read('3MF/' + part['id'] + '.3mf'))) as colored:
                model = ET.fromstring(colored.read('3D/3dmodel.model'))
            assert model.attrib['unit'] == 'millimeter'
            objects = {o.attrib['id']: o for o in model.findall('m:resources/m:object', ns)}
            build = model.findall('m:build/m:item', ns)
            assert len(build) == 1 and 'transform' not in build[0].attrib
            members = objects[build[0].attrib['objectid']].findall('m:components/m:component', ns)
            assert {x.attrib['objectid'] for x in members} == {str(m['object_id']) for m in part['material_parts']}
            assert all('transform' not in x.attrib for x in members)
            maximum_z = float('-inf')
            for material in part['material_parts']:
                raw = (ROOT / material['source']).read_bytes()
                assert sha(raw) == material['source_sha256']
                if material['source'] != part['source']:
                    assert archive.read(f"Materials/{part['id']}/{material['role']}.stl") == raw
                obj = objects[str(material['object_id'])]
                points = [tuple(float(v.attrib[a]) - part['translation_3mf_mm'][i]
                                for i, a in enumerate('xyz'))
                          for v in obj.findall('m:mesh/m:vertices/m:vertex', ns)]
                faces = obj.findall('m:mesh/m:triangles/m:triangle', ns)
                count = struct.unpack_from('<I', raw, 80)[0]
                assert len(raw) == 84 + count * 50 and len(faces) == count == material['triangles']
                for i, face in enumerate(faces):
                    actual = [value for key in ('v1', 'v2', 'v3') for value in points[int(face.attrib[key])]]
                    expected = struct.unpack_from('<9f', raw, 84 + i * 50 + 12)
                    assert all(abs(a-b) < 1e-6 for a, b in zip(actual, expected)), part['id']
                maximum_z = max(maximum_z, max(p[2] for p in points))
                materials += 1
            if '-frame-' in part['id'] or '-case-level-plate' in part['id']:
                assert abs(maximum_z - metadata['parameter_values_mm']['FrameTop']) < 1e-5
        results.append({'style': style, 'parts': len(manifest['parts']),
                        'materials': materials, 'sha256': sha(kit.read_bytes())})
report = {'passed': True, 'method': 'Production printKit in Node; every STL byte and every translated 3MF triangle compared with native exports',
          'scene_sha256': sha(scene_path.read_bytes()), 'checker_sha256': sha(Path(__file__).read_bytes()),
          'frame_top_mm': metadata['parameter_values_mm']['FrameTop'],
          'kits': results, 'browser_download_tested': False, 'physical_acceptance': False}
(OUT / 'validation.json').write_text(json.dumps(report, indent=2) + '\n')
print(f'PASS: {len(results)} complete current print kits, exact STL bytes, registered 3MF triangles and roof height')
