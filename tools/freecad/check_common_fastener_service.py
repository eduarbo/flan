"""Check common-M2 tool access and preserve variant palettes in a saved candidate.

Run through run_macos.py with --source, --candidate and --output. The output is a
new native file; the source and candidate are never overwritten.
SPDX-License-Identifier: GPL-3.0-or-later
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
import traceback
sys.path.insert(0, str(Path(__file__).resolve().parent))
import FreeCAD as A
import FreeCADGui as G
import Part
from configuration import extract, apply as configure
from flush_frames import face_roles
from preserve_document_label import preserve_document_label

ROOT = Path(__file__).resolve().parents[2]
sha = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()


def say(s):
    print(s, file=sys.__stdout__, flush=True)


def frames(doc):
    return [o for o in doc.Objects if o.TypeId != 'App::Link' and hasattr(o, 'FrameStyle')]


def exterior_bounds(doc):
    return {o.Name: [round(getattr(o.Shape.BoundBox, axis+end), 6)
                     for axis in 'XYZ' for end in ('Min', 'Max')]
            for o in doc.Objects if o.TypeId != 'App::Link'
            and (hasattr(o, 'CaseStyle') or hasattr(o, 'FrameStyle'))}


def run():
    argv = sys.argv[1:]
    while argv and not argv[0].startswith('--'): argv.pop(0)
    p = argparse.ArgumentParser()
    for flag in ('source', 'candidate', 'output'): p.add_argument('--'+flag, type=Path, required=True)
    p.add_argument('--configuration', type=Path)
    args = p.parse_args(argv)
    assert len({x.resolve() for x in (args.source, args.candidate, args.output)}) == 3
    assert not args.output.exists()
    source_hash, candidate_hash = sha(args.source), sha(args.candidate)
    G.showMainWindow(); G.getMainWindow().hide()
    original = A.openDocument(str(args.source.resolve()))
    palettes = {o.Name: {s.ColorRole: tuple(s.ViewObject.ShapeColor) for s in o.MaterialParts} for o in frames(original)}
    bounds = exterior_bounds(original)
    A.closeDocument(original.Name)
    doc = A.openDocument(str(args.candidate.resolve()))
    assert exterior_bounds(doc) == bounds, 'Case or frame exterior bounds changed'
    config = extract(doc)
    if args.configuration:
        config = json.loads(args.configuration.read_text())
    report = {'physical_acceptance': False, 'source_sha256': source_hash,
              'exterior_bounds_preserved': True,
              'candidate_sha256': candidate_hash, 'checker_sha256': sha(__file__),
              'driver_envelope': 'Continuous vertical cylinder diameter3mm, length25mm above head; frame/caps removed, plate additionally removed for H4/H5.',
              'halves': {}}
    mounts = json.loads((ROOT/'design/revI-mounts.json').read_text())['left']
    for side, prefix in (('left', 'L_'), ('right', 'R_')):
        half = doc.getObject(prefix+'Half'); pose = A.Placement(half.Placement)
        half.Placement = A.Placement(); doc.recompute()
        parts = {o.PartID[len(side)+1:]: o.Shape for o in doc.Objects
                 if getattr(o, 'PartID', '').startswith(side+'-') and hasattr(o, 'Shape')}
        plates = {o.Name: o.Shape for o in doc.Objects if o.Name.startswith(prefix)
                  and o.TypeId != 'App::Link' and getattr(o, 'CaseGroup', '') == 'plate'}
        records = []
        for i, m in enumerate(mounts, 1):
            x, y = m['xy']; x = x if side == 'left' else 160-x
            driver = Part.makeCylinder(1.5, 25, A.Vector(x, -y, m['seat_z']+2))
            obstacles = {n: s for n, s in parts.items()
                         if n != 'electronics-lid' and not n.startswith(('screw-', 'frame-target-'))
                         and not (i > 3 and n == 'key-plate')}
            if i <= 3: obstacles.update(plates)
            hits = {}
            for n, shape in obstacles.items():
                a, b = driver.BoundBox, shape.BoundBox
                if any(getattr(a, ax+'Max') <= getattr(b, ax+'Min') or getattr(b, ax+'Max') <= getattr(a, ax+'Min') for ax in 'XYZ'): continue
                vol = driver.common(shape).Volume
                if vol > .001: hits[n] = vol
            if hits: raise ValueError((side, m['id'], 'driver blocked', hits))
            records.append({'mount': m['id'], 'collisions': hits})
        report['halves'][side] = records
        half.Placement = pose; doc.recompute()
        say(side+': all five driver paths clear')
    # Hidden alternatives retain their original material palettes.
    for obj in frames(doc):
        colors = palettes[obj.Name]
        for part in obj.MaterialParts: part.ViewObject.ShapeColor = colors[part.ColorRole]
        obj.ViewObject.DiffuseColor = [colors[role] for role in face_roles(obj)]
    configure(doc, config)
    expected = extract(doc)
    report['configuration'] = expected
    # Preserve the exact web selection too: native extraction does not represent
    # PCB artwork/mask choices, so keep those in an explicit document property.
    receipt = doc.getObject('CommonFasteners')
    if not hasattr(receipt, 'ConfigurationJSON'):
        receipt.addProperty('App::PropertyString', 'ConfigurationJSON')
    receipt.ConfigurationJSON = json.dumps(config, sort_keys=True)
    label = doc.Label
    temp = args.output.with_name('service-unlabelled.FCStd')
    doc.saveAs(str(temp)); A.closeDocument(doc.Name)
    preserve_document_label(temp, args.output, label); temp.unlink()
    doc = A.openDocument(str(args.output.resolve()))
    assert extract(doc) == expected
    assert json.loads(doc.getObject('CommonFasteners').ConfigurationJSON) == config
    for obj in frames(doc):
        expected_colors = {s.ColorRole: tuple(s.ViewObject.ShapeColor) for s in obj.MaterialParts}
        actual = list(obj.ViewObject.DiffuseColor)
        target = [expected_colors[role] for role in face_roles(obj)]
        assert len(actual) == len(target)
        assert all(max(abs(a-b) for a, b in zip(x[:3], y[:3])) < 1e-6 for x, y in zip(actual, target))
    A.closeDocument(doc.Name)
    assert sha(args.source) == source_hash and sha(args.candidate) == candidate_hash
    report.update(passed=True, saved_reopened=True, native_frame_palettes_verified=True,
                  output_sha256=sha(args.output))
    (args.output.parent/'service.json').write_text(json.dumps(report, indent=2)+'\n')
    say('PASS: continuous driver access, configured native file and saved material colors')


if __name__ == '__main__':
    try: run()
    except Exception:
        traceback.print_exc(file=sys.__stderr__); sys.__stderr__.flush(); os._exit(1)
    sys.__stdout__.flush(); sys.__stderr__.flush(); os._exit(0)
