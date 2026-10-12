"""Bounded current-native port refinement; never regenerates the keyboard.

Run: python3 tools/freecad/run_macos.py tools/freecad/refine_ports.py
The input is pinned in design/revI-ports.json. Re-running after installation is a
read-only check; the candidate is validated before replacing the source file.
SPDX-License-Identifier: GPL-3.0-or-later
"""
import hashlib
import json
import os
from pathlib import Path
import sys
import traceback
import zipfile
sys.path.insert(0, str(Path(__file__).resolve().parent))
import FreeCAD as A
import FreeCADGui as G
import Part
from audit_repairs import usb_corridor
from restore_stock_display_appearance import same_brep, same_ordered_face, canonical, overlaps

ROOT = Path(__file__).resolve().parents[2]
SPEC = ROOT/'design/revI-ports.json'
NATIVE = ROOT/'mechanical/revI/Flan36.FCStd'
WORK = ROOT/'build/port-refinement'
RECEIPT = ROOT/'validation/revI-ports.json'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def shape_sha(shape):
    return shape.exportBrepToString().encode()


def log(text):
    print(text, file=sys.__stdout__, flush=True)


def volume(shape):
    return 0.0 if shape.isNull() or not shape.Vertexes else shape.Volume


def frame_material_assignment(obj):
    """Exact owner test, using individual matching faces before whole solids.

    Boolean unions can copy topology without preserving isSame identity. A
    face-to-face Boolean is sufficient and avoids intersecting every unchanged
    face with the complete decorated solid. Split faces retain the full-solid
    fallback and its original area threshold.
    """
    def key(face):
        b=face.BoundBox
        return tuple(round(getattr(b,a),5) for a in ['XMin','YMin','ZMin','XMax','YMax','ZMax'])+(round(face.Area,5),)
    owners=[];lookup={}
    for child in obj.MaterialParts:
        materials=list(child.ViewObject.ShapeAppearance)
        assert len({json.dumps(canonical(m),sort_keys=True) for m in materials})==1
        material=materials[0];owners.append((child.Shape,child.Shape.BoundBox,material))
        for face in child.Shape.Faces:lookup.setdefault(key(face),[]).append((face,material))
    assigned=[];fallbacks=0
    for face in obj.Shape.Faces:
        matches=[material for other,material in lookup.get(key(face),[]) if same_ordered_face(face,other)]
        if not matches:
            fallbacks+=1
            for shape,box,material in owners:
                if overlaps(face.BoundBox,box):
                    area=face.copy(True,False).common(shape.copy(True,False)).Area
                    if abs(area-face.Area)<=max(1e-6,face.Area*1e-5):matches.append(material)
        assert matches,(obj.Name,'no material owner',face.Area)
        assert len({json.dumps(canonical(m),sort_keys=True) for m in matches})==1,(obj.Name,'ambiguous material')
        assigned.append(matches[0])
    log('PASS owning materials: '+obj.Name+' / '+str(len(assigned))+' faces / '+str(fallbacks)+' split faces')
    return assigned


def actuator_envelope(doc, prefix):
    plastic = doc.getObject(prefix+'SliderModelSolid').Shape
    # Colored visuals are open face collections. Use the full library solid,
    # and isolate the protruding tab beyond the metal/plastic housing edge.
    body = doc.getObject(prefix+'SliderModelVisual0').Shape.BoundBox
    x = body.XMax+.05 if prefix=='L_' else body.XMin-5-.05
    actuator = plastic.common(Part.makeBox(5, 12, 4, A.Vector(x, -66, 5)))
    actuator = Part.makeCompound(actuator.Solids)
    assert actuator.Volume>.1 and actuator.BoundBox.YLength<2, 'Actuator identification changed'
    b = actuator.BoundBox
    # Full rectangular sweep dominates every intermediate actuator position.
    return Part.makeBox(b.XLength, b.YLength+3.4, b.ZLength,
                        A.Vector(b.XMin, b.YMin-1.7, b.ZMin))


def validate(doc):
    results = {}
    for side, prefix in [('left', 'L_'), ('right', 'R_')]:
        usb = doc.getObject(prefix+'USBPlugAccess')
        cavity = doc.getObject(prefix+'MCUCornerClearance')
        power = doc.getObject(prefix+'PowerAccess')
        assert abs(usb.Length.Value-12.4)<1e-8 and abs(usb.Height.Value-5.4)<1e-8
        assert abs(cavity.Width.Value-34.8)<1e-8
        assert abs(power.Height.Value-2.2)<1e-8
        corridor = usb_corridor(doc, side)
        sweep = actuator_envelope(doc, prefix)
        blank = doc.getObject(prefix+'Frame_smooth_HeadRelief5').Shape
        assert blank.isValid() and len(blank.Solids)==1
        assert blank.common(corridor).Volume<.001, (side, 'USB access blocked')
        assert blank.common(sweep).Volume<.001, (side, 'actuator travel blocked')
        frame_records = {}
        for obj in doc.Objects:
            if obj.Name.startswith(prefix) and hasattr(obj, 'FrameStyle') and obj.TypeId!='App::Link':
                assert obj.Shape.isValid() and len(obj.Shape.Solids)==1, obj.Name
                frame_records[obj.FrameStyle] = {'volume_mm3': obj.Shape.Volume, 'valid_solid': True}
        cases = {}
        for style in ['solid', 'rim', 'terrace', 'level']:
            for group in ['base', 'plate']:
                obj = doc.getObject(prefix+'Case_'+style+'_'+group)
                shape = obj.Shape
                assert shape.isValid() and len(shape.Solids)==1, obj.Name
                usb_hit = shape.common(corridor).Volume
                power_hit = shape.common(sweep).Volume
                assert usb_hit<.001 and power_hit<.001, (obj.Name, usb_hit, power_hit)
                cases[style+'-'+group] = {'usb_collision_mm3': usb_hit, 'actuator_sweep_collision_mm3': power_hit,
                                         'valid_solid': True, 'volume_mm3': shape.Volume}
        results[side] = {'usb_aperture_mm': [12.4, 5.4], 'controller_relief_front_y_mm': cavity.Shape.BoundBox.YMax,
                         'power_opening_mm': [8.5, 2.2], 'actuator_sweep_checked_mm': 3.4,
                         'frame_blank_usb_collision_mm3': blank.common(corridor).Volume,
                         'frame_blank_actuator_collision_mm3': blank.common(sweep).Volume,
                         'frames': frame_records, 'cases': cases}
        log('PASS port access and solids: '+side)
    return results


def main():
    WORK.mkdir(parents=True, exist_ok=True)
    spec = json.loads(SPEC.read_text())
    G.showMainWindow(); G.getMainWindow().hide()
    source_hash = sha(NATIVE)
    doc = A.openDocument(str(NATIVE))
    installed = doc.getObject('PortRefinement')
    if installed:
        assert installed.RecipeSHA256==sha(SPEC)
        result = validate(doc)
        log('PASS: port refinement already installed; source unchanged')
        return
    assert source_hash==spec['source_native_sha256'], 'Unexpected source; review before applying'
    magnet_names = [p+n+str(i) for p in ['L_', 'R_'] for n in ['Magnet', 'SteelTarget'] for i in range(3)]
    magnet_before = {n: shape_sha(doc.getObject(n).Shape) for n in magnet_names}
    unchanged = {o.Name: shape_sha(o.Shape) for o in doc.Objects if hasattr(o, 'PartID')
                 and not o.PartID.endswith(('-tray', '-key-plate', '-electronics-lid'))}
    bounded_names = [p+n for p in ['L_', 'R_'] for n in ['Frame_smooth_HeadRelief5',
                     'Case_solid_base', 'Case_rim_base', 'Case_terrace_base', 'Case_level_plate']]
    previous_shapes = {n: doc.getObject(n).Shape.copy() for n in bounded_names}
    volumes_before = {o.Name: o.Shape.Volume for o in doc.Objects if
                      (hasattr(o, 'FrameStyle') and o.TypeId!='App::Link') or
                      (o.Name.startswith(('L_Case_', 'R_Case_')) and o.Name.endswith(('_base', '_plate')))}
    checkpoint = WORK/'recomputed.FCStd'
    checkpoint_meta = WORK/'recomputed.json'
    cached = json.loads(checkpoint_meta.read_text()) if checkpoint_meta.exists() else {}
    if checkpoint.exists() and cached.get('source_sha256')==source_hash and cached.get('recipe_sha256')==sha(SPEC) and cached.get('checkpoint_sha256')==sha(checkpoint):
        doc = A.openDocument(str(checkpoint))
        log('Resuming exact hashed native checkpoint; all source/geometry guards run again')
    else:
        for prefix in ['L_', 'R_']:
            usb = doc.getObject(prefix+'USBPlugAccess')
            usb.Length = 12.4; usb.Width = 20.4; usb.Height = 5.4
            usb.Placement.Base.x = 116.6 if prefix=='L_' else 31.0
            usb.setExpression('Placement.Base.y', '-11.5 mm - Parameters.MCUShiftY')
            usb.setExpression('Placement.Base.z', 'Parameters.MCUBottom - 2.3 mm')
            # Preserve the rear datum and controller shift; shorten only the front.
            doc.getObject(prefix+'MCUCornerClearance').Width = 34.8
            doc.getObject(prefix+'PowerAccess').Height = 2.2
        log('Recomputing native dependencies after three cutter edits per half…')
        doc.recompute()
        log('Native dependency recompute complete')
        # Rebuild face assignments from the current complementary material solids;
        # stored face indices must not be reused after topology changes.
        for obj in doc.Objects:
            if hasattr(obj, 'MaterialParts') and hasattr(obj, 'FrameStyle') and obj.TypeId!='App::Link':
                for child in obj.MaterialParts:
                    child.ViewObject.DiffuseColor = [child.ViewObject.ShapeColor]
                obj.ViewObject.ShapeAppearance=frame_material_assignment(obj)
        log('Native dependencies and frame appearance recomputed')
        doc.saveAs(str(checkpoint))
        checkpoint_meta.write_text(json.dumps({'source_sha256':source_hash,'recipe_sha256':sha(SPEC),
                                               'checkpoint_sha256':sha(checkpoint)},indent=2)+'\n')
        log('Saved hashed recompute checkpoint')
    result = validate(doc)
    for name, before in unchanged.items():
        assert same_brep(shape_sha(doc.getObject(name).Shape), before), (name, 'unrelated geometry changed')
    proof_path = WORK/'bounded-proof.json'
    proof_key = {'source_sha256':source_hash, 'checkpoint_sha256':sha(checkpoint),
                 'installer_sha256':sha(Path(__file__))}
    proof = json.loads(proof_path.read_text()) if proof_path.exists() else {}
    bounded_changes = proof.get('bounded_changes', {}) if all(proof.get(k)==v for k,v in proof_key.items()) else {}
    def persist_bounded_proof():
        proof_path.write_text(json.dumps(dict(proof_key,bounded_changes=bounded_changes),indent=2)+'\n')
    for name, before in previous_shapes.items():
        if name in bounded_changes:
            saved = bounded_changes[name]
            assert saved['removed_mm3']<.001 and saved['outside_port_zones_mm3']<.001
            log('PASS hashed cached bounded proof: '+name)
            continue
        current = doc.getObject(name).Shape
        if same_brep(shape_sha(before),shape_sha(current)):
            bounded_changes[name]={'added_mm3':0.0,'removed_mm3':0.0,'outside_port_zones_mm3':0.0,'method':'identical ordered BRep geometry'}
            persist_bounded_proof()
            log('PASS identical bounded solid: '+name)
            continue
        removed = volume(before.cut(current))
        added = current.cut(before)
        x = 110 if name.startswith('L_') else 24
        zone = Part.makeBox(26, 15, 7, A.Vector(x, -21, 5.5)).fuse(
               Part.makeBox(26, 10, 4.2, A.Vector(x, -65, 5.1)))
        outside = 0.0 if volume(added)==0.0 else volume(added.cut(zone))
        assert removed<.001 and outside<.001, (name, 'nonlocal change', removed, outside)
        bounded_changes[name] = {'added_mm3': volume(added), 'removed_mm3': removed, 'outside_port_zones_mm3': outside}
        persist_bounded_proof()
        log('PASS bounded change: '+name)
    for name, before in magnet_before.items():
        assert same_brep(shape_sha(doc.getObject(name).Shape), before), (name, 'magnet changed')
    deltas = {name: doc.getObject(name).Shape.Volume-before for name, before in volumes_before.items()}
    assert all(v>=-.001 for v in deltas.values()), deltas
    assert any(v>1 for v in deltas.values()), 'No meaningful wall was restored'
    receipt = doc.addObject('App::DocumentObjectGroup', 'PortRefinement')
    receipt.addProperty('App::PropertyString', 'RecipeSHA256', 'Provenance'); receipt.RecipeSHA256=sha(SPEC)
    receipt.addProperty('App::PropertyString', 'SourceSHA256', 'Provenance'); receipt.SourceSHA256=source_hash
    receipt.addProperty('App::PropertyString', 'RecipeJSON', 'Provenance'); receipt.RecipeJSON=json.dumps(spec, sort_keys=True)
    receipt.Label='Refined USB and power openings · physical fit untested'
    candidate = WORK/'candidate.FCStd'; doc.saveAs(str(candidate))
    compressed = WORK/'compressed.FCStd'
    with zipfile.ZipFile(candidate) as source, zipfile.ZipFile(compressed, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as target:
        for info in source.infolist():
            target.writestr(info.filename, source.read(info.filename))
    assert compressed.stat().st_size<100*1024*1024, 'Native exceeds hosting limit'
    # Preserve the exact source locally until the candidate and exports pass.
    backup = WORK/('source-'+source_hash+'.FCStd')
    if backup.exists(): assert sha(backup)==source_hash
    else: backup.write_bytes(NATIVE.read_bytes())
    compressed.replace(NATIVE)
    report = {'passed': True, 'native_sha256': sha(NATIVE), 'source_native_sha256': source_hash,
              'recipe_sha256': sha(SPEC), 'installer_sha256': sha(Path(__file__)),
              'halves': result, 'restored_wall_volume_mm3': deltas, 'bounded_changes': bounded_changes,
              'unrelated_part_shapes_unchanged': len(unchanged), 'magnet_shapes_unchanged': True,
              'native_bytes': NATIVE.stat().st_size, 'physical_acceptance': False,
              'method': 'Modify only shared native cutter dimensions; recompute dependent source solids; preserve USB corridor; test conservative actuator sweep, case/frame solids and unchanged magnet shapes.'}
    RECEIPT.write_text(json.dumps(report, indent=2)+'\n')
    log('PASS: validated native installed '+report['native_sha256'])


if __name__=='__main__':
    try: main()
    except Exception:
        traceback.print_exc(file=sys.__stderr__); sys.__stderr__.flush(); os._exit(1)
    sys.__stdout__.flush(); sys.__stderr__.flush(); os._exit(0)
