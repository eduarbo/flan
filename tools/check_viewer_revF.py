#!/usr/bin/env python3
"""Read-only provenance, key-layout and exact mesh-vertex check for the 3D viewer.
SPDX-License-Identifier: GPL-3.0-or-later
"""
import base64
import hashlib
import json
import re
from pathlib import Path
import numpy as np
import vtk
from vtk.util.numpy_support import vtk_to_numpy

ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'docs/explore/index.html').read_bytes()
receipt=json.loads((ROOT/'validation/revF-viewer.json').read_text())
assert hashlib.sha256(html).hexdigest()==receipt['viewer_sha256']
for source in receipt['sources']:
    assert hashlib.sha256((ROOT/source['path']).read_bytes()).hexdigest()==source['sha256'],source['path']
data=json.loads(re.search(rb'<script id="scene-data" type="application/json">(.*?)</script>',html,re.S)[1])
assert len(data['parts'])==168
layout=json.loads((ROOT/'design/layout.json').read_text())
caps=[p for p in data['parts'] if p['group']=='keycaps'];assert len(caps)==36
for side,keys in layout['halves'].items():
    for k in keys:
        p=next(p for p in caps if p['name']==side+' · KLP '+k['ref'])
        assert p['position']==[(161 if side=='right' else 0)+k['x'],12.2,k['y']]
        assert p['angle_deg']==k['angle']
for path,g in data['geometries'].items():
    reader=vtk.vtkSTLReader();reader.SetFileName(str(ROOT/path));reader.Update();mesh=reader.GetOutput()
    expected=vtk_to_numpy(mesh.GetPoints().GetData()).copy()[:,[0,2,1]]
    if path.startswith('mechanical/revF/'):expected[:,2]*=-1
    actual=np.frombuffer(base64.b64decode(g['positions']),dtype='<f4').reshape(-1,3)
    assert set(map(tuple,actual))==set(map(tuple,expected)),path
    assert g['triangles']==mesh.GetNumberOfCells(),path
print('PASS: viewer and sources match; 36 key positions/angles; 43 meshes preserve vertices and triangle counts.')
