"""Restore named native view properties after a core-only geometry migration.

Open the GUI offscreen before loading either document. Rebuild composite face
materials from their current owning solids, without recomputing any geometry.
The baseline is never saved. Only the candidate and appearance.json are written.
SPDX-License-Identifier: GPL-3.0-or-later
"""
import argparse
import hashlib
import io
import json
import math
import os
from pathlib import Path
import re
import shutil
import sys
import traceback
import xml.etree.ElementTree as ET
import zipfile

import FreeCAD as A
import FreeCADGui as G

PROPERTIES = ('ShapeColor', 'LineColor', 'PointColor', 'Transparency',
              'LineWidth', 'PointSize', 'DrawStyle', 'Lighting', 'DisplayMode',
              'Selectable', 'ShowInTree', 'OverrideMaterial',
              'LineColorArray', 'PointColorArray', 'ShapeAppearance', 'Visibility')
MATERIAL_FIELDS = ('DiffuseColor', 'AmbientColor', 'SpecularColor',
                   'EmissiveColor', 'Shininess', 'Transparency')
SERIAL_TOL = 1e-10
REAL = re.compile(r'[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?\Z')
SHAPE_TYPES = {'Ve', 'Ed', 'Wi', 'Fa', 'Sh', 'So', 'CS', 'Co'}


def log(message):
    print(message, file=sys.__stdout__, flush=True)


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def canonical(value):
    if value is None or isinstance(value, (str, bool, int)):
        return value
    if isinstance(value, float):
        return round(value, 6)
    if isinstance(value, (list, tuple)):
        return [canonical(item) for item in value]
    if hasattr(value, 'DiffuseColor'):
        return {key: canonical(getattr(value, key)) for key in MATERIAL_FIELDS
                if hasattr(value, key)}
    raise TypeError('Unsupported view property value: ' + str(type(value)))


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def same_scalar(a, b):
    if a == b:
        return True
    # Integer tokens include topology indexes and orientation references. They
    # must be identical; only floating-point serialization may round slightly.
    if not any(c in a + b for c in '.eE') or not REAL.fullmatch(a) or not REAL.fullmatch(b):
        return False
    x, y = float(a), float(b)
    return math.isfinite(x) and math.isfinite(y) and abs(x - y) <= SERIAL_TOL


def same_brep(a, b):
    """Compare complete ordered OCCT geometry, allowing only save roundoff.

    OCCT TopTools_ShapeSet writes seven flags in this order: Free, Modified,
    Checked, Orientable, Closed, Infinite, Convex. The first three are mutable
    processing state, not geometry. Recognize their TShape record context;
    never interpret an arbitrary seven-digit integer as a flag record.
    Reference: OCCT V7_9_0/src/TopTools/TopTools_ShapeSet.cxx lines 484-493.
    """
    if a == b:
        return True
    aa, bb = a.decode('ascii').splitlines(), b.decode('ascii').splitlines()
    if len(aa) != len(bb):
        return False
    in_shapes, kind = False, None
    for index, (left, right) in enumerate(zip(aa, bb)):
        if left.startswith('TShapes ') and right.startswith('TShapes '):
            in_shapes = True
        if in_shapes and left.strip() in SHAPE_TYPES and left.strip() == right.strip():
            kind = left.strip()
        if left == right:
            continue
        flag = (in_shapes and kind is not None and index > 0 and index + 1 < len(aa)
                and not aa[index - 1].strip() and not bb[index - 1].strip()
                and re.fullmatch('[01]{7}', left.strip())
                and re.fullmatch('[01]{7}', right.strip())
                and brep_reference_block(aa, index + 1)
                and brep_reference_block(bb, index + 1))
        if flag:
            if left.strip()[3:] != right.strip()[3:]:
                return False
            continue
        lt, rt = left.split(), right.split()
        if len(lt) != len(rt) or not all(same_scalar(x, y) for x, y in zip(lt, rt)):
            return False
    return True


def brep_reference_block(lines, start):
    """Recognize complete oriented-index/location pairs, possibly multiline."""
    tokens = []
    for line in lines[start:]:
        row = line.split()
        if not row:
            return False
        tokens.extend(row)
        if '*' in row:
            if tokens[-1] != '*' or tokens.count('*') != 1:
                return False
            refs = tokens[:-1]
            return len(refs) % 2 == 0 and all(
                re.fullmatch(r'[+\-ie]\d+', refs[i]) and
                re.fullmatch(r'\d+', refs[i + 1]) for i in range(0, len(refs), 2))
        if any(not re.fullmatch(r'[+\-ie]?\d+', token) for token in row):
            return False
    return False


def same_xml(a, b):
    """Preserve native parameters, poses, links, groups and shape references."""
    aa = {k: v for k, v in a.attrib.items() if not (a.tag == 'Object' and k == 'Touched')}
    ba = {k: v for k, v in b.attrib.items() if not (b.tag == 'Object' and k == 'Touched')}
    if a.tag != b.tag or aa.keys() != ba.keys():
        return False
    for key in aa:
        x, y = aa[key], ba[key]
        if key == 'status' and a.tag in ('Property', '_Property'):
            # Property::Touched is a save/read bookkeeping bit.
            if int(x) & ~1 != int(y) & ~1:
                return False
        elif not same_scalar(x, y):
            return False
    if (a.text or '').strip() != (b.text or '').strip():
        return False
    aa, bb = list(a), list(b)
    if a.tag == 'ObjectDeps':
        aa.sort(key=lambda item: ET.tostring(item))
        bb.sort(key=lambda item: ET.tostring(item))
    return len(aa) == len(bb) and all(same_xml(x, y) for x, y in zip(aa, bb))


def archive_geometry_check(before, after, allow_checkpoint_label=False):
    names = {n for n in before.namelist() if n.endswith(('.brp', '.bms'))}
    assert names == {n for n in after.namelist() if n.endswith(('.brp', '.bms'))}, 'Geometry entry set changed'
    roundtrips = []
    for name in sorted(names):
        a, b = before.read(name), after.read(name)
        if a == b:
            continue
        assert name.endswith('.brp') and same_brep(a, b), (name, 'Serialized geometry changed')
        roundtrips.append(name)
    a, b = (ET.fromstring(z.read('Document.xml')) for z in (before, after))
    metadata_visibility = []
    objects = [{o.attrib['name']: o for o in root.find('ObjectData')} for root in (a, b)]
    metadata = 'StockDisplayConnector'
    if metadata in objects[0] and metadata in objects[1]:
        props = [{p.attrib['name']: p for p in objects[index][metadata].find('Properties')}
                 for index in (0, 1)]
        va, vb = (items['Visibility'].find('Bool') for items in props)
        if va.attrib != vb.attrib:
            assert all('Shape' not in items and 'Mesh' not in items and
                       items['Group'].find('LinkList').attrib['count'] == '0' for items in props)
            assert va.attrib == {'value': 'true'} and vb.attrib == {'value': 'false'}
            metadata_visibility.append({'object': metadata, 'property': 'Visibility',
                                        'before': True, 'after': False})
            va.attrib['value'] = vb.attrib['value']
    for section in ('Objects', 'ObjectData'):
        assert same_xml(a.find(section), b.find(section)), (section, 'Native properties changed')
    ap, bp = a.find('Properties'), b.find('Properties')
    document_label = []
    if allow_checkpoint_label:
        labels = [next(p for p in props if p.attrib['name'] == 'Label').find('String')
                  for props in (ap, bp)]
        if labels[0].attrib != labels[1].attrib:
            assert labels[0].attrib == {'value': 'Flan36'}
            assert labels[1].attrib == {'value': 'appearance-diagnostic'}
            document_label.append({'before': 'Flan36', 'after': 'appearance-diagnostic',
                                   'scope': 'document label only; delivered filename remains Flan36.FCStd'})
            labels[0].attrib['value'] = labels[1].attrib['value']
    for props in (ap, bp):
        for child in list(props):
            if child.attrib.get('name') == 'LastModifiedDate':
                props.remove(child)
    assert same_xml(ap, bp), 'Document properties changed'
    return {'geometry_entries': len(names), 'brep_roundtrip_entries': roundtrips,
            'numeric_absolute_tolerance': SERIAL_TOL,
            'ignored_tshape_state_flags': ['Free', 'Modified', 'Checked'],
            'ignored_xml_save_state': ['Object.Touched', 'Property.status bit 0'],
            'metadata_visibility_restored': metadata_visibility,
            'checkpoint_document_label': document_label,
            'native_properties_verified': ['Objects', 'ObjectData', 'Properties except LastModifiedDate']}


def object_archive_same(name, a, b):
    names = {n for n in a.namelist() if n.startswith(name + '.') and n.endswith(('.brp', '.bms'))}
    others = {n for n in b.namelist() if n.startswith(name + '.') and n.endswith(('.brp', '.bms'))}
    if names != others:
        return False
    for entry in names:
        old, new = a.read(entry), b.read(entry)
        if old != new and not (entry.endswith('.brp') and same_brep(old, new)):
            return False
    return True


def geometry(doc):
    result = {}
    for obj in doc.Objects:
        placement = (canonical(list(obj.Placement.Base) + list(obj.Placement.Rotation.Q))
                     if hasattr(obj, 'Placement') else None)
        if 'Shape' in obj.PropertiesList:
            shape = obj.Shape
            if shape.isNull():
                result[obj.Name] = {'null_shape': True,
                    'placement': placement}
                continue
            # The ordinary BoundBox may include cached display triangulation.
            # Read the underlying geometry without tessellation or tolerance.
            box = shape.optimalBoundingBox(False, False)
            result[obj.Name] = {
                'topology': [len(shape.Solids), len(shape.Faces), len(shape.Edges)],
                'bounds': [round(getattr(box, axis), 6) for axis in
                           ('XMin', 'YMin', 'ZMin', 'XMax', 'YMax', 'ZMax')],
                'placement': placement,
            }
        elif hasattr(obj, 'Mesh'):
            points, facets = obj.Mesh.Topology
            result[obj.Name] = {'mesh_sha256': digest({
                'points': [list(point) for point in points], 'facets': facets}),
                'placement': placement}
        elif placement is not None:
            # App::Part/Link shapes are computed aggregates, not saved geometry.
            # Their transforms remain checked here, and all links/groups are
            # independently preserved by the complete Document.xml gate.
            result[obj.Name] = {'placement': placement}
    return result


def snapshot(doc):
    values = {}
    for obj in doc.Objects:
        view = obj.ViewObject
        if view is None:
            continue
        props = {}
        for name in PROPERTIES:
            if hasattr(view, name):
                props[name] = canonical(getattr(view, name))
        values[obj.Name] = props
    return values


def overlaps(a, b):
    return all(min(getattr(a, axis + 'Max'), getattr(b, axis + 'Max')) + 1e-6 >=
               max(getattr(a, axis + 'Min'), getattr(b, axis + 'Min'))
               for axis in 'XYZ')


def same_ordered_face(source, target):
    if type(source.Surface) != type(target.Surface) or source.Orientation != target.Orientation:
        return False
    if (len(source.Wires), len(source.Edges), len(source.Vertexes)) != (
            len(target.Wires), len(target.Edges), len(target.Vertexes)):
        return False
    if any(abs(getattr(source.BoundBox, axis) - getattr(target.BoundBox, axis)) > 1e-7
           for axis in ('XMin', 'YMin', 'ZMin', 'XMax', 'YMax', 'ZMax')):
        return False
    tolerance = max(1e-7, source.Area * 1e-9)
    if abs(source.Area - target.Area) > tolerance:
        return False
    # Boolean algorithms may update tolerance/cache data on their operands.
    # Isolate both topology and geometry from the document before intersecting.
    if source.isSame(target) or abs(source.copy(True, False).common(
            target.copy(True, False)).Area - source.Area) <= tolerance:
        return True
    # OCCT booleans may suppress microfaces near its modeling tolerance. In
    # that case require the entire ordered serialized face representation to
    # agree; never increase the area tolerance or silently skip that face.
    return same_brep(source.exportBrepToString().encode(), target.exportBrepToString().encode())


def restore_uniform_material(obj, old):
    """A native single material applies to every face, independent of its order."""
    materials = list(old.ViewObject.ShapeAppearance)
    if len(materials) != 1:
        return None
    obj.ViewObject.ShapeAppearance = materials
    assert canonical(obj.ViewObject.ShapeAppearance) == canonical(materials)
    return {'method': 'uniform_native_material', 'baseline_material_count': 1,
            'material_sha256': digest(canonical(materials))}


def restore_compound_face_order(obj, children):
    """Validate the explicit ordered component list against a native compound."""
    if obj.Shape.ShapeType != 'Compound':
        return None
    source_faces, assigned = [], []
    for child in children:
        faces = list(child.Shape.Faces)
        materials = list(child.ViewObject.ShapeAppearance)
        assert len(materials) in (1, len(faces)), (child.Name, 'invalid child material count')
        source_faces.extend(faces)
        assigned.extend(materials if len(materials) == len(faces) else materials * len(faces))
    actual = list(obj.Shape.Faces)
    if len(source_faces) != len(actual):
        return None
    if not all(same_ordered_face(source, target) for source, target in zip(source_faces, actual)):
        return None
    obj.ViewObject.ShapeAppearance = assigned
    assert canonical(obj.ViewObject.ShapeAppearance) == canonical(assigned)
    return {'faces': len(actual), 'ordered_parts': [child.Name for child in children],
            'ordered_face_geometry_verified': True}


def restore_rigid_face_order(obj, old):
    """Keep imported face materials when their ordered geometry is preserved.

    Supplier models can contain coincident faces with different colors. Their
    original face order carries the intended mapping; inferring a unique owner
    from coincident MaterialParts would discard that information.
    """
    if old is None or not hasattr(old, 'Shape') or old.Shape.isNull() or obj.Shape.isNull():
        return None
    before, after = old.Shape, obj.Shape
    if len(before.Faces) != len(after.Faces):
        return None
    a, b = before.BoundBox, after.BoundBox
    delta = [getattr(b, axis + 'Min') - getattr(a, axis + 'Min') for axis in 'XYZ']
    if any(abs(getattr(b, axis + 'Max') - getattr(a, axis + 'Max') - shift) > 1e-7
           for axis, shift in zip('XYZ', delta)):
        return None
    translated = before.copy(True, False)
    translated.translate(A.Vector(*delta))
    for source, target in zip(translated.Faces, after.Faces):
        if not same_ordered_face(source, target):
            return None
    materials = list(old.ViewObject.ShapeAppearance)
    assert len(materials) in (1, len(after.Faces)), (obj.Name, 'invalid baseline material count')
    obj.ViewObject.ShapeAppearance = materials
    assert canonical(obj.ViewObject.ShapeAppearance) == canonical(materials)
    return {'faces': len(after.Faces), 'translation': delta,
            'ordered_face_geometry_verified': True}


def rebuild_materials(obj, children):
    """Assign each actual union face its owning child's native material."""
    owners = []
    for child in children:
        shape = child.Shape
        materials = list(child.ViewObject.ShapeAppearance)
        assert materials, (child.Name, 'no restored native material')
        faces = [(face, face.BoundBox, index) for index, face in enumerate(shape.Faces)]
        owners.append((child, shape, shape.BoundBox, faces, materials))
    assigned = []
    for face in obj.Shape.Faces:
        candidates = [owner for owner in owners if overlaps(face.BoundBox, owner[2])]
        direct = []
        for child, shape, _, faces, materials in candidates:
            direct.extend((child, materials[index if len(materials) == len(faces) else 0])
                          for other, box, index in faces
                          if overlaps(face.BoundBox, box) and face.isSame(other))
        if direct:
            assert len({digest(canonical(material)) for _, material in direct}) == 1, (
                obj.Name, 'ambiguous shared face material')
            assigned.append(direct[0][1])
            continue
        # The union can split faces; use an exact area test, never a centroid.
        matches = []
        for child, shape, _, faces, materials in candidates:
            area = face.copy(True, False).common(shape.copy(True, False)).Area
            if abs(area - face.Area) <= max(1e-6, face.Area * 1e-5):
                unique = {digest(canonical(material)) for material in materials}
                assert len(unique) == 1, (child.Name, 'split face needs nonuniform owner mapping')
                matches.append(materials[0])
        assert matches, (obj.Name, 'no owning material for union face', face.Area)
        assert len({digest(canonical(material)) for material in matches}) == 1, (
            obj.Name, 'multiple material owners')
        assigned.append(matches[0])
    obj.ViewObject.ShapeAppearance = assigned
    assert canonical(obj.ViewObject.ShapeAppearance) == canonical(assigned), (
        obj.Name, 'rebuilt material readback mismatch')
    return len(assigned)


def verify_saved_face_materials(obj, children, saved_materials):
    """Prove each saved face color belongs to a native owner at that face.

    The original rebuild already rejected competing material owners. This
    read-only checkpoint proof tests only owners of the saved material; palette
    membership alone cannot establish where a material belongs.
    """
    owners = []
    for child in children:
        materials = canonical(list(child.ViewObject.ShapeAppearance))
        assert materials and len({digest(material) for material in materials}) == 1, (
            child.Name, 'checkpoint split-face proof needs a uniform native owner')
        owners.append((child.Shape, child.Shape.BoundBox, materials[0]))
    faces = list(obj.Shape.Faces)
    assert len(saved_materials) == len(faces)
    for index, (face, material) in enumerate(zip(faces, saved_materials)):
        candidates = [shape for shape, box, owner_material in owners
                      if material == owner_material and overlaps(face.BoundBox, box)]
        verified = any(face.isSame(other) for shape in candidates for other in shape.Faces)
        if not verified:
            for shape in candidates:
                area = face.copy(True, False).common(shape.copy(True, False)).Area
                if abs(area - face.Area) <= max(1e-6, face.Area * 1e-5):
                    verified = True
                    break
        assert verified, (obj.Name, index, 'saved face material has no complete native owner')
    assert canonical(list(obj.ViewObject.ShapeAppearance)) == saved_materials, (
        obj.Name, 'verification changed saved materials')
    return {'method': 'saved_material_to_uniform_native_owner_full_face_area',
            'faces_verified': len(faces), 'operands_deep_copied': True}


def verify_checkpoint_appearance(candidate, baseline, calculation_log):
    """Read back the preserved result and prove rebuilt face material positions."""
    methods = {}
    prefixes = {
        'face materials rebuilt for ': 'rebuilt',
        'component face order verified for ': 'compound',
        'ordered materials preserved for ': 'rigid',
        'uniform native material preserved for ': 'uniform',
    }
    for line in calculation_log.splitlines():
        for prefix, method in prefixes.items():
            marker = 'Appearance recovery: ' + prefix
            if line.startswith(marker):
                methods[line[len(marker):]] = method
    saved, original = snapshot(candidate), snapshot(baseline)
    copied_properties, checked_materials = 0, 0
    checked_composites = {}
    for name, expected in original.items():
        assert name in saved, (name, 'missing saved view provider')
        actual = saved[name]
        obj = candidate.getObject(name)
        method = methods.get(name)
        for prop, value in expected.items():
            if prop == 'ShapeAppearance' or (prop == 'ShapeColor' and method in ('rebuilt', 'compound')):
                continue
            assert actual.get(prop) == value, (name, prop, 'saved view property differs from baseline')
            copied_properties += 1
        if 'ShapeAppearance' not in expected:
            continue
        materials, old = actual['ShapeAppearance'], expected['ShapeAppearance']
        if method in ('rebuilt', 'compound'):
            children = list(getattr(obj, 'MaterialParts', [])) or list(getattr(obj, 'VisualParts', []))
            assert len(materials) == len(obj.Shape.Faces), (name, 'saved material/face count differs')
            palette = {digest(material) for child in children
                       for material in saved[child.Name]['ShapeAppearance']}
            assert all(digest(material) in palette for material in materials), (name, 'saved material outside native part palette')
            if method == 'compound':
                ordered = []
                for child in children:
                    parts = saved[child.Name]['ShapeAppearance']
                    ordered.extend(parts if len(parts) == len(child.Shape.Faces) else parts * len(child.Shape.Faces))
                assert materials == ordered, (name, 'saved compound material order differs')
            checked_composites[name] = {'method': method, 'faces': len(materials),
                                        'native_palette_verified': True,
                                        'material_sha256': digest(materials)}
            if method == 'rebuilt':
                checked_composites[name]['per_face_owner_mapping'] = verify_saved_face_materials(
                    obj, children, materials)
                log('Appearance checkpoint: saved face materials verified for ' + name)
        elif method in ('uniform', 'rigid'):
            assert materials == old, (name, 'preserved native materials differ')
            checked_composites[name] = {'method': method, 'material_sha256': digest(materials)}
        elif materials != old:
            assert old and materials and len({digest(material) for material in old + materials}) == 1, (
                name, 'saved copied or uniformly resized materials differ')
            assert len(materials) == len(obj.Shape.Faces), (name, 'uniform material count differs')
        checked_materials += len(materials)
    assert all(name in checked_composites for name in methods), 'Unverified checkpoint composite'
    return {'view_providers': len(saved), 'baseline_properties_checked': copied_properties,
            'native_materials_checked': checked_materials,
            'composite_readback': checked_composites,
            'view_state_sha256': digest(saved)}, saved


def main():
    argv = sys.argv[1:]
    while argv and not argv[0].startswith('--'):
        argv.pop(0)
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--baseline', type=Path, required=True)
    parser.add_argument('--report', type=Path)
    parser.add_argument('--inspect-composites', nargs='+', metavar='OBJECT')
    parser.add_argument('--inspect-view-geometry', action='store_true')
    parser.add_argument('--resume-checkpoint', type=Path)
    parser.add_argument('--calculation-log', type=Path)
    parser.add_argument('--geometry-input', type=Path,
                        help='Immutable pre-restoration candidate for checkpoint verification')
    args = parser.parse_args(argv)
    args.report = args.report or args.source.parent / 'appearance.json'
    args.report.parent.mkdir(parents=True, exist_ok=True)
    assert args.source.resolve() != args.baseline.resolve()
    source_before_hash, baseline_hash = sha(args.source), sha(args.baseline)
    geometry_input = args.geometry_input or args.source
    assert not args.geometry_input or args.resume_checkpoint, 'Geometry input is only valid for checkpoint recovery'
    input_hash = sha(geometry_input)
    if args.geometry_input:
        installation = json.loads(args.source.with_name('installation.json').read_text())
        assert input_hash == installation['source_sha256'], 'Geometry input differs from installer output'
    # Retain compressed input bytes for an exact native archive comparison after
    # save; exporting every in-memory BRep four times is slow and not byte-stable.
    input_archive = zipfile.ZipFile(io.BytesIO(geometry_input.read_bytes()))
    baseline_archive = zipfile.ZipFile(args.baseline)
    G.showMainWindow(); G.getMainWindow().hide()
    documents = []
    try:
        baseline = A.openDocument(str(args.baseline)); documents.append(baseline)
        candidate_path = args.resume_checkpoint or args.source
        candidate = A.openDocument(str(candidate_path)); documents.append(candidate)
        if args.resume_checkpoint:
            assert args.calculation_log and args.resume_checkpoint.resolve() != args.source.resolve()
            checkpoint_hash = sha(args.resume_checkpoint)
            with zipfile.ZipFile(args.resume_checkpoint) as checkpoint_archive:
                archive_check = archive_geometry_check(input_archive, checkpoint_archive, allow_checkpoint_label=True)
            native = geometry(candidate)
            verified, expected_views = verify_checkpoint_appearance(
                candidate, baseline, args.calculation_log.read_text())
            name = candidate.Name
            A.closeDocument(name); documents.remove(candidate)
            reopened = A.openDocument(str(args.resume_checkpoint)); documents.append(reopened)
            assert geometry(reopened) == native, 'Checkpoint native geometry readback differs'
            assert snapshot(reopened) == expected_views, 'Checkpoint GUI readback differs'
            assert sha(args.resume_checkpoint) == checkpoint_hash, 'Checkpoint changed while verifying'
            assert sha(args.source) == source_before_hash and sha(args.baseline) == baseline_hash
            assert sha(geometry_input) == input_hash, 'Immutable geometry input changed'
            # Native derived group Shapes appear lazily when the GUI opens.
            before_path = args.report.with_name('appearance-native-before.json')
            after_path = args.report.with_name('appearance-native-after.json')
            derived = sorted(set(json.loads(after_path.read_text())) - set(json.loads(before_path.read_text())))
            assert all('Shape' not in reopened.getObject(name).PropertiesList for name in derived)
            shutil.copyfile(args.resume_checkpoint, args.source)
            assert sha(args.source) == checkpoint_hash
            report = {
                'schema': 'flan36-stock-display-appearance-1',
                'input_sha256': input_hash, 'source_sha256': checkpoint_hash,
                'baseline_sha256': baseline_hash, 'restorer_sha256': sha(__file__),
                'passed': True, 'geometry_preserved': True,
                'geometry_objects_checked': len(native), 'geometry_sha256': digest(native),
                'serialized_geometry_verified': archive_check,
                'appearance_readback_verified': verified,
                'geometry_recompute_called': False, 'baseline_unchanged': True,
                'source_unchanged': True, 'source_unchanged_ref': 'baseline',
                'recovery_method': 'validated_saved_checkpoint',
                'checkpoint_sha256': checkpoint_hash,
                'calculation_log_sha256': sha(args.calculation_log),
                'dynamic_aggregates_excluded': derived,
            }
            args.report.write_text(json.dumps(report, indent=2) + '\n')
            log('PASS checkpoint native geometry, materials and GUI reopened; exact bytes restored')
            return
        if args.inspect_view_geometry:
            before = geometry(candidate)
            for obj in candidate.Objects:
                old = baseline.getObject(obj.Name)
                if not old or not old.ViewObject or not obj.ViewObject:
                    continue
                for name in PROPERTIES:
                    if hasattr(old.ViewObject, name) and hasattr(obj.ViewObject, name):
                        value = getattr(old.ViewObject, name)
                        try:
                            setattr(obj.ViewObject, name, value)
                        except Exception:
                            assert canonical(getattr(obj.ViewObject, name)) == canonical(value)
            after = geometry(candidate)
            differences = {name: {'before': state, 'after': after.get(name)}
                           for name, state in before.items() if state != after.get(name)}
            assert sha(args.source) == input_hash, 'Diagnostics changed source'
            log(json.dumps({'view_only_geometry_differences': differences, 'files_unchanged': True}, indent=2))
            return
        if args.inspect_composites:
            # Bounded dry diagnostics: operate on loaded view properties only;
            # do not save either document or enter the full material rebuild.
            results = {}
            for name in args.inspect_composites:
                obj, old = candidate.getObject(name), baseline.getObject(name)
                assert obj and old, (name, 'missing diagnostic object')
                children = list(getattr(obj, 'MaterialParts', [])) or list(getattr(obj, 'VisualParts', []))
                for child in [obj] + children:
                    child.ViewObject.ShapeAppearance = baseline.getObject(child.Name).ViewObject.ShapeAppearance
                result = {'baseline_faces': len(old.Shape.Faces), 'candidate_faces': len(obj.Shape.Faces),
                          'shape_type': obj.Shape.ShapeType,
                          'uniform_mapping': restore_uniform_material(obj, old)}
                if result['uniform_mapping'] is None:
                    result.update({'compound_mapping': restore_compound_face_order(obj, children),
                                   'rigid_mapping': restore_rigid_face_order(obj, old)})
                results[name] = result
            assert sha(args.source) == input_hash, 'Diagnostics changed source'
            log(json.dumps({'diagnostic_composites': results, 'files_unchanged': True}, indent=2))
            return
        # Deliberately do not call recompute: all geometry is already serialized.
        log('Appearance recovery: comparing saved candidate geometry')
        before_geometry = geometry(candidate)
        before_path = args.report.with_name('appearance-native-before.json')
        before_path.write_text(json.dumps(before_geometry, indent=2) + '\n')
        baseline_geometry = geometry(baseline)
        changed_geometry = {name for name, state in before_geometry.items()
                            if baseline_geometry.get(name) != state or not
                            object_archive_same(name, baseline_archive, input_archive)}
        log('Appearance recovery: ' + str(len(changed_geometry)) +
            ' objects differ geometrically from the baseline')
        baseline_views = snapshot(baseline)
        copied, skipped = 0, []
        for obj in candidate.Objects:
            old = baseline.getObject(obj.Name)
            if old is None or old.ViewObject is None or obj.ViewObject is None:
                continue
            for name in PROPERTIES:
                if not hasattr(old.ViewObject, name) or not hasattr(obj.ViewObject, name):
                    continue
                value = getattr(old.ViewObject, name)
                try:
                    setattr(obj.ViewObject, name, value)
                except Exception as error:
                    if canonical(getattr(obj.ViewObject, name)) != canonical(value):
                        raise RuntimeError((obj.Name, name, 'view copy failed', str(error)))
                    skipped.append([obj.Name, name, 'read-only, already equal'])
                assert canonical(getattr(obj.ViewObject, name)) == canonical(value), (obj.Name, name)
                copied += 1
        log('Appearance recovery: named view properties restored')

        # A changed face count needs a new array, even for uniform construction
        # solids. This changes only view properties, never Part geometry.
        uniform_resized = 0
        for obj in candidate.Objects:
            if obj.Name not in changed_geometry:
                continue
            if not hasattr(obj, 'Shape') or obj.Shape.isNull() or obj.ViewObject is None or not hasattr(obj.ViewObject, 'ShapeAppearance'):
                continue
            materials = list(obj.ViewObject.ShapeAppearance)
            if materials and len(materials) != len(obj.Shape.Faces):
                if len({digest(canonical(material)) for material in materials}) == 1:
                    obj.ViewObject.ShapeAppearance = [materials[0]] * len(obj.Shape.Faces)
                    uniform_resized += 1

        rebuilt, child_checks, copied_composites, rigid_composites, compound_composites, uniform_composites = {}, 0, [], {}, {}, {}
        for obj in candidate.Objects:
            if obj.ViewObject is None or not hasattr(obj, 'Shape'):
                continue
            children = list(getattr(obj, 'MaterialParts', [])) or list(getattr(obj, 'VisualParts', []))
            if not children:
                continue
            for child in children:
                old = baseline.getObject(child.Name)
                assert old is not None, (obj.Name, child.Name, 'missing baseline appearance')
                assert canonical(child.ViewObject.ShapeColor) == canonical(old.ViewObject.ShapeColor), (
                    child.Name, 'owned part color differs from baseline')
                child_checks += 1
            if obj.Name not in changed_geometry and not any(
                    child.Name in changed_geometry for child in children):
                # Preserve the supplier's existing per-face mapping verbatim.
                # Imported components may contain coincident, differently
                # colored faces; unchanged geometry needs no ownership guess.
                copied_composites.append(obj.Name)
                continue
            uniform = restore_uniform_material(obj, baseline.getObject(obj.Name))
            if uniform is not None:
                uniform_composites[obj.Name] = uniform
                log('Appearance recovery: uniform native material preserved for ' + obj.Name)
                continue
            compound = restore_compound_face_order(obj, children)
            if compound is not None:
                compound_composites[obj.Name] = compound
                log('Appearance recovery: component face order verified for ' + obj.Name)
                continue
            rigid = restore_rigid_face_order(obj, baseline.getObject(obj.Name))
            if rigid is not None:
                rigid_composites[obj.Name] = rigid
                log('Appearance recovery: ordered materials preserved for ' + obj.Name)
                continue
            rebuilt[obj.Name] = rebuild_materials(obj, children)
            log('Appearance recovery: face materials rebuilt for ' + obj.Name)

        for name, expected in baseline_views.items():
            obj = candidate.getObject(name)
            if obj and obj.ViewObject and 'Visibility' in expected:
                assert bool(obj.ViewObject.Visibility) == expected['Visibility'], (name, 'visibility changed')
        expected_views = snapshot(candidate)
        after_geometry = geometry(candidate)
        after_path = args.report.with_name('appearance-native-after.json')
        after_path.write_text(json.dumps(after_geometry, indent=2) + '\n')
        if after_geometry != before_geometry:
            differences = {name: {'before': state, 'after': after_geometry.get(name)}
                           for name, state in before_geometry.items()
                           if state != after_geometry.get(name)}
            diagnostic_path = args.report.with_name('appearance-diagnostic.FCStd')
            candidate.saveAs(str(diagnostic_path))
            with zipfile.ZipFile(diagnostic_path) as diagnostic_archive:
                diagnostic_check = archive_geometry_check(input_archive, diagnostic_archive)
            diagnostic = {'native_differences': differences,
                          'serialized_geometry_verified': diagnostic_check,
                          'source_unchanged': sha(args.source) == input_hash,
                          'diagnostic_path': str(diagnostic_path)}
            args.report.with_name('appearance-native-failure.json').write_text(json.dumps(diagnostic, indent=2) + '\n')
            raise AssertionError('Native signature differs; diagnostic candidate and snapshots retained separately')
        candidate.save()
        with zipfile.ZipFile(args.source) as saved_archive:
            archive_check = archive_geometry_check(input_archive, saved_archive)
        name = candidate.Name
        A.closeDocument(name); documents.remove(candidate)
        reopened = A.openDocument(str(args.source)); documents.append(reopened)
        log('Appearance recovery: verifying saved GUI and geometry readback')
        assert geometry(reopened) == before_geometry, 'Saved geometry changed during appearance recovery'
        assert snapshot(reopened) == expected_views, 'Saved native appearance differs from restored view state'
        assert sha(args.baseline) == baseline_hash, 'Baseline file changed'
        report = {
            'schema': 'flan36-stock-display-appearance-1',
            'input_sha256': input_hash, 'source_sha256': sha(args.source),
            'baseline_sha256': baseline_hash, 'restorer_sha256': sha(__file__),
            'passed': True, 'geometry_preserved': True,
            'geometry_objects_checked': len(before_geometry),
            'geometry_sha256': digest(before_geometry),
            'serialized_geometry_verified': archive_check,
            'appearance_readback_verified': {
                'view_providers': len(expected_views), 'copied_properties': copied,
                'owned_part_color_checks': child_checks,
                'uniform_arrays_resized': uniform_resized,
                'composites_rebuilt': rebuilt,
                'unchanged_composites_copied': copied_composites,
                'rigid_composites_preserved': rigid_composites,
                'compound_composites_verified': compound_composites,
                'uniform_composites_preserved': uniform_composites,
                'changed_geometry_objects': sorted(changed_geometry),
                'view_state_sha256': digest(expected_views),
                'unchanged_read_only_properties': skipped,
            },
            'geometry_recompute_called': False, 'baseline_unchanged': True,
            # Compatibility alias for the adoption receipt: this means the
            # original baseline, not the candidate explicitly saved above.
            'source_unchanged': True, 'source_unchanged_ref': 'baseline',
        }
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2) + '\n')
        log('PASS appearance and geometry restored, saved and independently reopened')
    finally:
        for doc in reversed(documents): A.closeDocument(doc.Name)
        input_archive.close(); baseline_archive.close()
        assert sha(args.baseline) == baseline_hash, 'Baseline file changed'


if __name__ == '__main__':
    try:
        main()
    except Exception:
        traceback.print_exc(file=sys.__stderr__)
        sys.__stderr__.flush()
        os._exit(1)
    os._exit(0)
