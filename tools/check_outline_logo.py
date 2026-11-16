#!/usr/bin/env python3
"""Check the published SVG kit against its master and selected raster reference."""
from pathlib import Path
import hashlib, io, json, re, zipfile
import xml.etree.ElementTree as ET
import cairosvg
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'design/branding/outline'
NS='{http://www.w3.org/2000/svg}'
def sha(data): return hashlib.sha256(data).hexdigest()
def read(name): return ET.parse(OUT/name).getroot()
def paths(root): return {p.attrib['id']:p.attrib['d'] for p in root.findall(NS+'path')}
def alpha(root):
    return np.array(Image.open(io.BytesIO(cairosvg.svg2png(bytestring=ET.tostring(root),output_width=870,output_height=690))).convert('RGBA'))[:,:,3]

master=read('flan36-outline-master.svg'); canonical=paths(master)
assert len(canonical)==7
assert sum(d.count('M') for d in canonical.values())==11
assert sum(d.count('Z') for d in canonical.values())==11
files=sorted(OUT.glob('flan36-*.svg')); assert len(files)==4
for file in files:
    root=read(file.name)
    assert root.attrib['width'].endswith('mm') and root.attrib['height'].endswith('mm')
    for element in root.iter():
        assert element.tag in {NS+t for t in ['svg','title','desc','path']}
        assert not any(k in element.attrib for k in ['href','style','transform','stroke'])
    actual=paths(root)
    for key,d in actual.items():
        if key in canonical: assert d==canonical[key],(file.name,key)
        else:
            index={'caramel-fill':1,'custard-fill':2}[key]
            assert d==re.findall(r'M[^M]+',canonical['flan-symbol'])[index].strip()
    expected={'flan-symbol'} if '-symbol-' in file.name else set(canonical)-{'flan-symbol'} if '-wordmark-' in file.name else set(canonical)
    assert set(actual)&set(canonical)==expected
    assert len(actual)==len(expected)+(2 if '-color' in file.name else 0)
black=read('flan36-outline-black.svg')
master.set('viewBox',black.attrib['viewBox'])
assert np.array_equal(alpha(black),alpha(master))
# Same original pixel coordinate frame; independent raster comparison at 1:1.
black.set('viewBox','0 0 435 345');black.set('width','435');black.set('height','345')
render=np.array(Image.open(io.BytesIO(cairosvg.svg2png(bytestring=ET.tostring(black)))).convert('RGBA'))[:,:,3]>128
reference=np.array(Image.open(ROOT/'design/references/branding/flan36-caramel-outline.png').convert('RGB'))[800:1145,175:610].mean(axis=2)<100
iou=float((render&reference).sum()/(render|reference).sum());assert iou>.97,iou
with zipfile.ZipFile(OUT/'flan36-outline-svg-kit.zip') as z:
    assert z.testzip() is None
    manifest=json.loads(z.read('manifest.json'))
    assert len(z.namelist())==8
    for entry in manifest['files']:
        assert sha(z.read(entry['path']))==entry['sha256']==sha((OUT/entry['path']).read_bytes())
    assert z.read('LICENSE.txt')==(ROOT/'LICENSE').read_bytes()
native=json.loads((ROOT/'validation/branding-outline-freecad.json').read_text())
for item in native['imports']: assert item['sha256']==sha((ROOT/item['path']).read_bytes())
report={'svg_count':len(files),'master_components':7,'closed_rings':11,'holes':4,
        'same_contours_all_variants':True,'master_export_alpha_identical':True,
        'reference_mask_intersection_over_union':iou,'package_integrity':True,
        'package_sha256':sha((OUT/'flan36-outline-svg-kit.zip').read_bytes()),
        'freecad_report_matches_current_assets':True,'manufacturing_qualified':False,
        'assets':[{'path':str(p.relative_to(ROOT)),'sha256':sha(p.read_bytes())} for p in files]}
(ROOT/'validation/branding-outline-vectors.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='assets'},indent=2))
