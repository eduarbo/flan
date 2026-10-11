"""Read back the saved nice!view supplied-connector stack against its baseline.

Run with run_macos.py. Neither source document is saved or modified on disk.
This checks native geometry, not the installer receipt or supplier tolerances.
SPDX-License-Identifier: GPL-3.0-or-later
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
import traceback

import FreeCAD as A
import Part

STYLES = ('talavera', 'gameboy', 'snes', 'phone', 'ipod', 'hanafuda')
EPS = 1e-5


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def near(actual, expected, label, tolerance=EPS):
    assert abs(actual - expected) <= tolerance, (label, actual, expected)


def bounds(shape):
    box = shape.optimalBoundingBox(False, False)
    return [getattr(box, name) for name in
            ('XMin', 'YMin', 'ZMin', 'XMax', 'YMax', 'ZMax')]


def signature(shape):
    """Independent geometric readback; no unstable FreeCAD topology hashes."""
    return {
        'bounds_mm': bounds(shape),
        'volume_mm3': shape.Volume,
        'area_mm2': shape.Area,
        'center_mm': [list(s.CenterOfMass) for s in shape.Solids],
        'topology': [len(shape.Solids), len(shape.Faces), len(shape.Edges)],
        'edge_lengths_mm': sorted(edge.Length for edge in shape.Edges),
    }


def equal_signature(old, new, label):
    assert old['topology'] == new['topology'], (label, 'topology changed')
    remaining = list(new['center_mm'])
    for center in old['center_mm']:
        index = next((i for i, point in enumerate(remaining)
                      if all(abs(a-b) <= EPS for a, b in zip(center, point))), None)
        assert index is not None, (label, 'solid center changed', center)
        remaining.pop(index)
    assert not remaining, (label, 'solid center count changed')
    for key in ('bounds_mm', 'edge_lengths_mm'):
        assert len(old[key]) == len(new[key]), (label, key)
        for a, b in zip(old[key], new[key]):
            near(a, b, (label, key))
    for key in ('volume_mm3', 'area_mm2'):
        near(old[key], new[key], (label, key))


def placement_values(obj):
    return list(obj.Placement.Base) + list(obj.Placement.Rotation.Q)


def part_map(doc):
    return {obj.PartID: obj for obj in doc.Objects
            if hasattr(obj, 'PartID') and hasattr(obj, 'Shape')}


def open_local(path):
    doc = A.openDocument(str(path))
    for prefix in ('L_', 'R_'):
        doc.getObject(prefix + 'Half').Placement = A.Placement()
    doc.recompute()
    return doc


def main():
    argv = sys.argv[1:]
    while argv and not argv[0].startswith('--'):
        argv.pop(0)
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--baseline', type=Path, required=True)
    parser.add_argument('--report', type=Path, required=True)
    args = parser.parse_args(argv)
    assert args.source.resolve() != args.baseline.resolve()
    hashes = {str(path): sha(path) for path in (args.source, args.baseline)}
    documents = []
    try:
        old = open_local(args.baseline); documents.append(old)
        doc = open_local(args.source); documents.append(doc)
        parts, previous = part_map(doc), part_map(old)
        report = {'schema': 'flan36-stock-display-readback-1',
                  'source_sha256': hashes[str(args.source)],
                  'baseline_sha256': hashes[str(args.baseline)],
                  'checker_sha256': sha(__file__),
                  'opened_from_saved_files': True,
                  'physical_acceptance': False, 'halves': {}, 'preserved': {}}

        # Compare geometry and placement, not only unchanged parameter values.
        for side in ('left', 'right'):
            fixed = ['pcb', 'mcu', 'battery', 'cradle', 'mcu-riser',
                     'mcu-sockets', 'jst', 'reset', 'slider', 'tray',
                     'hotswap-sockets', 'diodes']
            fixed += [f'magnet-{i}' for i in range(3)]
            fixed += [f'frame-target-{i}' for i in range(3)]
            for suffix in fixed:
                ident = side + '-' + suffix
                before, after = previous[ident], parts[ident]
                for a, b in zip(placement_values(before), placement_values(after)):
                    near(a, b, (ident, 'placement'))
                equal_signature(signature(before.Shape), signature(after.Shape), ident)
                entry = {'geometry_signature_equal': True, 'placement_equal': True}
                if suffix.startswith(('magnet-', 'frame-target-')):
                    difference = (before.Shape.cut(after.Shape).Volume +
                                  after.Shape.cut(before.Shape).Volume)
                    near(difference, 0, (ident, 'symmetric solid difference'))
                    entry['solid_difference_mm3'] = difference
                report['preserved'][ident] = entry

        old_keys = {obj.Name: placement_values(obj) for obj in old.Objects
                    if hasattr(obj, 'Mesh')}
        new_keys = {obj.Name: placement_values(obj) for obj in doc.Objects
                    if hasattr(obj, 'Mesh')}
        assert old_keys.keys() == new_keys.keys(), 'Key mesh object set changed'
        for name in old_keys:
            for a, b in zip(old_keys[name], new_keys[name]):
                near(a, b, (name, 'key mesh placement'))
        report['preserved_key_mesh_placements'] = len(old_keys)

        for side, prefix, center in (('left', 'L_', 123.0), ('right', 'R_', 37.0)):
            objects = {name: doc.getObject(prefix + name) for name in
                       ('NiceViewVisual0', 'NiceViewVisual2',
                        'SlimDisplaySocketHousing', 'SlimDisplaySocketPins',
                        'SlimDisplayMaleSpacer', 'SlimDisplayMaleContacts',
                        'LevelDisplaySolderReserve', 'LevelHeaderServiceWell')}
            for name, obj in objects.items():
                assert obj is not None and not obj.Shape.isNull(), (prefix, name)
                assert obj.Shape.isValid(), (prefix, name, 'invalid shape')
                assert obj.TypeId != 'PartDesign::FeaturePython' and not hasattr(obj, 'Proxy'), (name, 'custom proxy')
            bb = {name: bounds(obj.Shape) for name, obj in objects.items()}
            pcb = parts[side + '-pcb'].Shape
            near(bounds(pcb)[5], 5.4, (side, 'main PCB top'))
            for name, low, high in (
                    ('NiceViewVisual0', 12.4, 13.4),
                    ('SlimDisplaySocketHousing', 5.4, 10.4),
                    ('SlimDisplayMaleSpacer', 10.4, 12.4),
                    ('LevelDisplaySolderReserve', 13.4, 13.9)):
                near(bb[name][2], low, (side, name, 'bottom'))
                near(bb[name][5], high, (side, name, 'top'))
            near(bb['NiceViewVisual2'][5], 14.3, (side, 'glass top'))
            near(bb['NiceViewVisual0'][2] - bounds(pcb)[5], 7, (side, 'board separation'))
            near(bb['SlimDisplaySocketPins'][2], 2.8, (side, 'trimmed lower tails'))
            near(bb['SlimDisplayMaleContacts'][5], 13.7, (side, 'trimmed upper tails'))

            expected = [(center - 5.08 + i * 2.54, -50.8) for i in range(5)]
            # Cylindrical faces of the actual PCB prove the five drilled voids.
            drills = set()
            for face in pcb.Faces:
                surface = face.Surface
                if not isinstance(surface, Part.Cylinder):
                    continue
                if abs(surface.Radius - .5) > EPS or abs(abs(surface.Axis.z) - 1) > EPS:
                    continue
                if abs(surface.Center.y + 50.8) < EPS:
                    drills.add((round(surface.Center.x, 6), round(surface.Center.y, 6)))
            assert len(drills) == 5, (side, 'J2 actual drilled holes', sorted(drills))
            for xy, actual in zip(expected, sorted(drills)):
                for a, b in zip(xy, actual): near(a, b, (side, 'J2 drill center'))
            for name in ('SlimDisplaySocketPins', 'SlimDisplayMaleContacts'):
                centers = sorted((solid.CenterOfMass.x, solid.CenterOfMass.y)
                                 for solid in objects[name].Shape.Solids)
                assert len(centers) == 5, (name, centers)
                for xy, actual in zip(expected, centers):
                    for a, b in zip(xy, actual): near(a, b, (side, name, 'contact center'))

            frames = {}
            solder = objects['LevelDisplaySolderReserve'].Shape
            for style in STYLES:
                frame = doc.getObject(prefix + 'FlushFrame_' + style + '_Final').Shape
                near(bounds(frame)[5], 14.5, (side, style, 'frame roof'))
                covers = []
                for x, y in expected:
                    probe = Part.makeCylinder(.8, .7, A.Vector(x, y, 13.9))
                    cover = frame.common(probe)
                    assert cover.Volume > EPS, (side, style, 'missing pin cover', x, y)
                    cb = bounds(cover)
                    near(cb[2], 14.1, (side, style, 'pin cover underside'))
                    near(cb[5], 14.5, (side, style, 'pin cover top'))
                    covers.append(cb)
                near(frame.common(solder).Volume, 0, (side, style, 'solder collision'))
                clearance = frame.distToShape(solder)[0]
                assert clearance >= .2 - EPS, (side, style, 'solder clearance', clearance)
                frames[style] = {'roof_mm': 14.5, 'pin_cover_bounds_mm': covers,
                                 'solder_clearance_mm': clearance}
            near(bounds(doc.getObject(prefix + 'Case_level_plate').Shape)[5], 14.5,
                 (side, 'Level shell roof'))
            report['halves'][side] = {'actual_bounds_mm': bb,
                'board_separation_mm': 7.0, 'J2_hole_diameter_mm': 1.0,
                'J2_actual_hole_centers_mm': sorted(drills), 'frames': frames,
                'native_expression_count': sum(len(obj.ExpressionEngine) for obj in objects.values())}
            print('PASS saved supplied-connector stack: ' + side,
                  file=sys.__stdout__, flush=True)
        report['source_files_unchanged'] = all(sha(path) == digest for path, digest in hashes.items())
        assert report['source_files_unchanged']
        report['passed'] = True
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2) + '\n')
    finally:
        for doc in reversed(documents): A.closeDocument(doc.Name)
        assert all(sha(path) == digest for path, digest in hashes.items()), 'Source file changed'


if __name__ == '__main__':
    try:
        main()
    except Exception:
        traceback.print_exc(file=sys.__stderr__)
        sys.__stderr__.flush()
        os._exit(1)
    os._exit(0)
