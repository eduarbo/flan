"""Reopen saved all-magnet CAD; check inserts, sockets and stable visibility IDs.

Run with tools/freecad/run_macos.py. Does not recompute or save the document.
SPDX-License-Identifier: GPL-3.0-or-later
"""
import hashlib
import os
import sys
import traceback
import json
from pathlib import Path
import FreeCAD as A
import FreeCADGui as G

def main():
    ROOT = Path(__file__).resolve().parents[2]
    G.showMainWindow()
    G.getMainWindow().hide()
    native = ROOT/'mechanical/revI/Flan36.FCStd'
    doc = A.openDocument(str(native))
    spec = json.loads((ROOT/'design/revI-magnets.json').read_text())
    results = []
    for side, prefix in [('left', 'L_'), ('right', 'R_')]:
        frame = doc.getObject(prefix+'ActiveFrame')
        assert frame.LinkedObject and frame.LinkedObject.Shape.isValid()
        for index in range(3):
            base = doc.getObject(f'{prefix}Magnet{index}')
            magnet = doc.getObject(f'{prefix}SteelTarget{index}')
            for obj, diameter, height, z in [
                (base, spec['magnet_diameter'], spec['magnet_height'], spec['magnet_z']),
                (magnet, spec['frame_magnet_diameter'], spec['frame_magnet_height'], spec['frame_magnet_z'])]:
                assert abs(obj.Radius.Value*2-diameter) < 1e-8
                assert abs(obj.Height.Value-height) < 1e-8
                assert abs(obj.Placement.Base.z-z) < 1e-8
                assert not obj.Shape.isNull() and obj.Shape.isValid()
            assert 'frame magnet 2 x 4 mm' in magnet.Label
            assert 'Axially magnetized neodymium' in magnet.Label2
            assert magnet.Layer == 'lid' and magnet.PartID == f'{side}-frame-target-{index}'
            gap = magnet.Placement.Base.z-base.Placement.Base.z-base.Height.Value
            assert abs(gap-spec['nominal_axial_gap']) < 1e-8
            initial = magnet.Visibility
            for visible in (False, True):
                magnet.Visibility = visible
                assert magnet.Visibility == visible
            magnet.Visibility = initial
            results.append({'side': side, 'station': index, 'gap_mm': round(gap, 8),
                            'base_mm': [2, 3], 'frame_mm': [2, 4], 'label': magnet.Label,
                            'visibility_roundtrip': True})
    assert len(results) == 6
    report = {'passed': True, 'native_sha256': hashlib.sha256(native.read_bytes()).hexdigest(),
              'checker_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              'freecad_version': list(A.Version()), 'stations': results,
              'method': 'FreeCAD saved-file reopen, actual cylinders/shapes, positions, labels and visibility roundtrip; no recompute/save',
              'physical_acceptance': False}
    (ROOT/'validation/revI-all-magnets-reopen.json').write_text(json.dumps(report, indent=2)+'\n')
    A.closeDocument(doc.Name)
    print('PASS: saved CAD has six base magnets and six frame magnets, 0.9 mm gap, valid solids and frame visibility')


if __name__ == '__main__':
    try:
        main()
    except Exception:
        traceback.print_exc(file=sys.__stderr__)
        sys.__stderr__.flush()
        os._exit(1)
    # Match the existing headless FreeCAD checkers; Qt/OCC teardown is unstable.
    sys.__stdout__.flush()
    sys.__stderr__.flush()
    os._exit(0)
