"""Prepare and check an isolated native common-M2 candidate.

python3 tools/freecad/run_macos.py tools/freecad/install_common_fasteners.py \
  --source mechanical/revI/Flan36.FCStd --output build/common-fasteners/Flan36.FCStd
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
import MeshPart
from common_fasteners import apply, SPEC
from configuration import extract, apply as configure
from install_slim_flush import protected
from preserve_document_label import preserve_document_label


def say(s):
    print(s, file=sys.__stdout__, flush=True)


def digest(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()


def signature(shape):
    b = shape.BoundBox
    return [round(shape.Volume, 5), round(shape.Area, 5),
            *[round(getattr(b, k), 5) for k in ('XMin', 'YMin', 'ZMin', 'XMax', 'YMax', 'ZMax')]]


def selected_shapes(doc):
    return {o.Name: signature(o.Shape) for o in doc.Objects
            if getattr(o, 'PartID', '') and hasattr(o, 'Shape')
            and not any(o.PartID.endswith('-' + n) for n in
                        ['key-plate', 'electronics-lid', *['screw-' + str(i) for i in range(1, 6)]])}


def check(doc, out):
    mounts = json.loads((SPEC.parent / 'revI-mounts.json').read_text())['left']
    spec = json.loads(SPEC.read_text())
    result = {}
    for side, prefix in (('left', 'L_'), ('right', 'R_')):
        poses = A.Placement(doc.getObject(prefix + 'Half').Placement)
        doc.getObject(prefix + 'Half').Placement = A.Placement()
        doc.recompute()
        cases = [o for o in doc.Objects if o.Name.startswith(prefix) and hasattr(o, 'CaseStyle') and o.TypeId != 'App::Link']
        frames = [o for o in doc.Objects if o.Name.startswith(prefix) and hasattr(o, 'FrameStyle') and o.TypeId != 'App::Link']
        obstacles = {o.Name: o.Shape for o in doc.Objects if getattr(o, 'PartID', '').startswith(side + '-')
                     and hasattr(o, 'Shape') and '-screw-' not in o.PartID}
        obstacles.update({o.Name: o.Shape for o in cases + frames})
        records = []
        for i, mount in enumerate(mounts, 1):
            x, y = mount['xy']; x = x if side == 'left' else 160 - x
            head = Part.makeCylinder(spec['head_envelope_mm']['diameter'] / 2,
                                     spec['head_envelope_mm']['height'], A.Vector(x, -y, mount['seat_z']))
            clearances = {}
            for name, other in obstacles.items():
                a, b = head.BoundBox, other.BoundBox
                if any(getattr(a, ax+'Max') < getattr(b, ax+'Min') or getattr(b, ax+'Max') < getattr(a, ax+'Min') for ax in 'XYZ'):
                    continue
                hit = head.common(other).Volume
                if hit > .001:
                    raise ValueError((side, mount['id'], name, 'head collision mm3', hit))
                if i > 3 and (name in [o.Name for o in frames] or name.endswith('_plate')):
                    distance = head.distToShape(other)[0]
                    clearances[name] = round(distance, 6)
                    if distance < .299:
                        raise ValueError((side, mount['id'], name, 'head clearance mm', distance))
            records.append({'mount': mount['id'], 'short_head_clearances_mm': clearances})
            say(side + ' ' + mount['id'] + ': head clear')
        for obj in cases + frames:
            s = obj.Shape
            if not s.isValid() or len(s.Solids) != 1:
                raise ValueError((obj.Name, 'invalid/disconnected printable solid'))
        # Export changed print surfaces in their actual assembled coordinates.
        exported = {}
        for obj in cases + frames:
            if hasattr(obj, 'CaseStyle'):
                if obj.CaseGroup != 'plate': continue
                stem = side + '-case-' + obj.CaseStyle + '-plate'
            else:
                stem = side + '-frame-' + obj.FrameStyle
            for name, shape in [(stem, obj.Shape), *[(stem+'-'+p.ColorRole, p.Shape) for p in getattr(obj, 'MaterialParts', [])]]:
                mesh = MeshPart.meshFromShape(Shape=shape, LinearDeflection=.03, AngularDeflection=.12, Relative=False)
                if not mesh.isSolid(): raise ValueError((name, 'open mesh'))
                mesh.write(str(out / (name + '.stl')))
                shape.exportStep(str(out / (name + '.step')))
                exported[name] = {'volume_mm3': shape.Volume, 'stl_sha256': digest(out / (name + '.stl'))}
        result[side] = {'heads': records, 'valid_connected_print_parts': len(cases + frames), 'exports': exported}
        doc.getObject(prefix + 'Half').Placement = poses
        doc.recompute()
    return result


def run():
    argv = sys.argv[1:]
    while argv and not argv[0].startswith('--'): argv.pop(0)
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args(argv)
    source, out = args.source.resolve(), args.output.resolve()
    assert source != out and not out.exists()
    out.parent.mkdir(parents=True, exist_ok=True)
    source_hash = digest(source)
    G.showMainWindow(); G.getMainWindow().hide()
    doc = A.openDocument(str(source)); doc.recompute()
    say('Opened native source')
    label, config = doc.Label, extract(doc)
    caps = {k: v for k, v in protected(doc).items() if '_K' in k}
    unchanged = selected_shapes(doc)
    report = {'source_sha256': source_hash, 'installer_sha256': digest(__file__), 'physical_acceptance': False}
    report['recipe'] = apply(doc)
    say('Common head envelopes and local pockets recomputed')
    assert selected_shapes(doc) == unchanged, 'Unrelated part geometry changed'
    assert {k: v for k, v in protected(doc).items() if '_K' in k} == caps, 'Key poses/meshes changed'
    # Recoverable intermediate if a later collision or export check fails.
    prepared = out.with_name('prepared.FCStd')
    doc.saveAs(str(prepared))
    report['halves'] = check(doc, out.parent)
    configure(doc, config)
    # Preserve each variant's own palette after the underside booleans changed.
    from flush_frames import face_roles
    for side, prefix in (('left', 'L_'), ('right', 'R_')):
        for obj in doc.Objects:
            if obj.Name.startswith(prefix) and obj.TypeId != 'App::Link' and hasattr(obj, 'FrameStyle'):
                colors = {p.ColorRole: tuple(p.ViewObject.ShapeColor) for p in obj.MaterialParts}
                obj.ViewObject.DiffuseColor = [colors[role] for role in face_roles(obj)]
    temporary = out.with_name('unlabelled.FCStd')
    doc.saveAs(str(temporary)); A.closeDocument(doc.Name)
    preserve_document_label(temporary, out, label); temporary.unlink()
    say('Saved candidate; reopening')
    doc = A.openDocument(str(out)); doc.recompute()
    assert selected_shapes(doc) == unchanged
    assert {k: v for k, v in protected(doc).items() if '_K' in k} == caps
    assert extract(doc) == config
    assert not any('Invalid' in o.State for o in doc.Objects)
    assert apply(doc) == report['recipe']
    A.closeDocument(doc.Name)
    assert digest(source) == source_hash
    report.update(saved_reopened=True, unaffected_parts_preserved=True, cap_geometry_preserved=True,
                  configuration_preserved=True, output_sha256=digest(out), passed=True)
    (out.parent / 'installation.json').write_text(json.dumps(report, indent=2) + '\n')
    prepared.unlink()
    say('PASS: candidate saved/reopened, all head clearances and protected parts checked')


if __name__ == '__main__':
    try:
        run()
    except Exception:
        traceback.print_exc(file=sys.__stderr__); sys.__stderr__.flush(); os._exit(1)
    sys.__stdout__.flush(); sys.__stderr__.flush(); os._exit(0)
