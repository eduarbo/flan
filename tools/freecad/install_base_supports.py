"""Rework the shared base of both halves after the first printed build.

1. Open the five M2 pilots from 1.7 to 2.1 mm: the printed 1.7 mm pilot did not take the screw; 2.1 mm
   did, in the thinnest post, without tapping.
2. Remove the twelve magnets and open the three station posts of the base from above, as 2.4 mm sockets:
   the display frame will hold on to the display and plug three pins into these sockets.
3. Add solid posts between the floor and the PCB underside at design/pcb-supports.json.

Frames, plates and every other part stay as they were. Saves a candidate; never writes over its source.
SPDX-License-Identifier: GPL-3.0-or-later
"""
import argparse, hashlib, json, math, os, sys, traceback
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import FreeCAD as A, FreeCADGui as G, Part
from check_audit_delivery import shape_digest

ROOT = Path(__file__).resolve().parents[2]
V = A.Vector
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
STYLES = ('level', 'solid', 'rim', 'terrace')
MAGNETS = ('Magnet', 'SteelTarget')      # the magnets themselves; the station posts stay as sockets
SOCKET_R, SOCKET_TOP = 1.2, 6.7          # station bore; it now runs out through the locator on top of the post
OLD_PILOT, WEB = .85, 1.0        # H3 keeps at least this much plastic between its pilot and the socket relief


def log(s): print(s, file=sys.__stdout__, flush=True)


def containers(doc, obj):
    return [g for g in doc.Objects if obj in getattr(g, 'Group', ())]      # the half (App::Part) and its history group


def measures(shape):
    b = shape.BoundBox
    return [len(shape.Solids), len(shape.Faces), len(shape.Edges), len(shape.Vertexes), shape.Volume, shape.Area, b.XMin, b.YMin, b.ZMin, b.XMax, b.YMax, b.ZMax]


def run():
    argv = sys.argv[1:]
    while argv and not argv[0].startswith('--'): argv.pop(0)
    p = argparse.ArgumentParser()
    p.add_argument('--source', type=Path, required=True); p.add_argument('--output', type=Path, required=True); p.add_argument('--report', type=Path, required=True)
    a = p.parse_args(argv)
    digest = sha(a.source); assert a.source.resolve() != a.output.resolve() and not a.output.exists()
    mounts = json.loads((ROOT / 'design/revI-mounts.json').read_text())
    plan = json.loads((ROOT / 'design/pcb-supports.json').read_text())
    stations = json.loads((ROOT / 'design/revI-magnets.json').read_text())['stations_left']
    pilot, radius = mounts['pilot_diameter'] / 2, plan['post_diameter_mm'] / 2
    assert abs(pilot - 1.05) < 1e-9, 'design/revI-mounts.json must hold the 2.1 mm pilot'
    G.showMainWindow(); G.getMainWindow().hide(); doc = A.openDocument(str(a.source)); doc.recompute()
    poses = {p: A.Placement(doc.getObject(p + 'Half').Placement) for p in ('L_', 'R_')}
    for p in poses: doc.getObject(p + 'Half').Placement = A.Placement()
    doc.recompute()
    report = {'schema': 'flan-base-supports-2', 'parent_source_sha256': digest, 'installer_sha256': sha(__file__),
              'pilot_diameter_mm': 2 * pilot, 'support_post_diameter_mm': 2 * radius,
              'station_socket_mm': {'bore': 2 * SOCKET_R, 'from_z': 3.1, 'open_at_z': 6.6}, 'halves': {}, 'physical_acceptance': False}
    gone = lambda o: o.PartID.split('-', 1)[1].startswith(('magnet-', 'frame-target-'))
    kept = {o.Name: shape_digest(o.Shape) for o in doc.Objects if hasattr(o, 'Shape') and getattr(o, 'PartID', '') and not o.PartID.endswith('-tray') and not gone(o)}
    before = {p + s: doc.getObject(f'{p}Case_{s}_base').Shape.copy() for p in poses for s in STYLES}
    for side, prefix in (('left', 'L_'), ('right', 'R_')):
        get = lambda name: doc.getObject(prefix + name)
        mx = (lambda x: x) if side == 'left' else (lambda x: 160 - x)
        floor, top = float(doc.Parameters.Floor), float(doc.Parameters.PCBTop) - float(doc.Parameters.PCBThickness)
        for i in range(1, 6):
            hole = get(f'Pilot{i}'); assert abs(hole.Radius.Value - OLD_PILOT) < 1e-8, (side, i, hole.Radius)
            hole.Radius = pilot
        for i in range(3):
            tool = get(f'MagnetPocketTool{i}'); assert abs(tool.Radius.Value - 1.15) < 1e-8 and abs(tool.Height.Value - 3.2) < 1e-8, (side, i)
            tool.Radius = SOCKET_R; tool.Height = SOCKET_TOP - tool.Placement.Base.z
        seat, power = get('MagnetPocket2'), get('TrayPowerCut')
        assert power.Base is seat
        home = containers(doc, get('Pillar1'))
        posts = []
        for k, (x, y) in enumerate(plan['supports']['flan36'], 1):
            post = doc.addObject('Part::Cylinder', f'{prefix}SupportPost{k}'); post.Radius = radius
            post.Placement = A.Placement(V(mx(x), -y, floor), A.Rotation())
            post.setExpression('Placement.Base.z', 'Parameters.Floor')
            post.setExpression('Height', 'Parameters.PCBTop - Parameters.PCBThickness - Parameters.Floor')
            post.Label = f'PCB support {k}'; posts.append(post)
        fused = doc.addObject('Part::MultiFuse', prefix + 'TraySupports'); fused.Shapes = [seat] + posts; fused.Refine = get('TrayPillar1').Refine
        for o in posts + [fused]:
            for g in home: g.addObject(o)
            o.Visibility = False
        power.Base = fused
        removed = []
        for i in range(3):
            for name in MAGNETS:
                o = get(f'{name}{i}')
                users = [u.Name for u in o.InList if o not in getattr(u, 'Group', ())]
                assert not users, (o.Name, 'still used by', users)
                removed.append(o.Name); doc.removeObject(o.Name)
        doc.recompute()
        bad = [o.Name for o in doc.Objects if 'Invalid' in o.State or 'Error' in o.State]; assert not bad, bad[:20]
        parts = {o.PartID.split('-', 1)[1]: o.Shape for o in doc.Objects if getattr(o, 'PartID', '').startswith(side + '-') and not o.PartID.endswith('-tray')}
        pcb = parts['pcb']
        clear = {}
        for k, post in enumerate(posts, 1):
            x, y = post.Placement.Base.x, post.Placement.Base.y
            assert abs(post.Shape.BoundBox.ZMin - floor) < 1e-7 and abs(post.Shape.BoundBox.ZMax - top) < 1e-7, (side, k, 'post height')
            assert pcb.isInside(V(x, y, top + .5), 1e-6, True), (side, k, 'no board above the post')
            assert all(pcb.isInside(V(x + dx, y + dy, top + .5), 1e-6, True) for dx in (-radius, radius) for dy in (-radius, radius)), (side, k, 'post reaches a board hole or edge')
            near = {name: round(shape.distToShape(post.Shape)[0], 3) for name, shape in parts.items()
                    if name != 'pcb' and shape.BoundBox.ZMin < top and shape.BoundBox.isValid()
                    and shape.BoundBox.XMin - 3 < x < shape.BoundBox.XMax + 3 and shape.BoundBox.YMin - 3 < y < shape.BoundBox.YMax + 3}
            near = {n: d for n, d in near.items() if d < 3}
            assert all(d >= .3 for d in near.values()), (side, k, 'support too close to a part', near)
            clear[f'S{k}'] = {'board_xy_mm': [round(x, 3), round(-y, 3)], 'nearest_parts_mm': near}
        web = get('SocketH3Relief').Shape.distToShape(get('Pilot3').Shape)[0]; assert web >= WEB, (side, 'H3 web', web)
        styles = {}
        for style in STYLES:
            base = get(f'Case_{style}_base').Shape; old = before[prefix + style]
            assert base.isValid() and len(base.Solids) == 1, (side, style, 'invalid base')
            for m in mounts['left']:
                x, y = mx(m['xy'][0]), -m['xy'][1]
                assert not base.isInside(V(x + pilot - .02, y, 2.6), 1e-6, True) and not base.isInside(V(x, y, .7), 1e-6, True), (side, style, m['id'], 'pilot not open')
                assert base.isInside(V(x - pilot - .1, y, 2.6), 1e-6, True), (side, style, m['id'], 'no wall around the pilot')
            for x, y in stations:
                x, y = mx(x), -y
                assert not base.isInside(V(x, y, 4.5), 1e-6, True) and not base.isInside(V(x + SOCKET_R - .05, y, 6.5), 1e-6, True), (side, style, 'station socket not open from above', x, y)
                assert base.isInside(V(x + SOCKET_R + .3, y, 4.5), 1e-6, True) and base.isInside(V(x, y, 2.5), 1e-6, True), (side, style, 'station wall or socket floor missing', x, y)
            for post in posts:
                c = post.Placement.Base
                assert base.isInside(V(c.x, c.y, top - .1), 1e-6, True) and not base.isInside(V(c.x, c.y, top + .1), 1e-6, True), (side, style, post.Name, 'support missing or too tall')
                assert not base.isInside(V(c.x + radius + .2, c.y, top - .1), 1e-6, True), (side, style, post.Name, 'support merged with a wall')
            added, cut = base.cut(old), old.cut(base)
            # Only the posts are new material: one solid cylinder each, floor to board. Cuts of near-equal
            # shells can leave zero-volume slivers elsewhere; those are not solids and are ignored.
            new = [s for s in added.Solids if s.Volume > 1e-4]
            want = math.pi * radius ** 2 * (top - floor)
            assert len(new) == len(posts) and all(abs(s.Volume - want) < .02 and s.BoundBox.ZMin >= floor - 1e-6 and s.BoundBox.ZMax <= top + 1e-6 for s in new), \
                (side, style, 'material added outside the support posts', [(round(s.Volume, 4), round(s.BoundBox.ZMin, 3), round(s.BoundBox.ZMax, 3)) for s in new])
            styles[style] = {'volume_mm3': round(base.Volume, 3), 'added_mm3': round(added.Volume, 3), 'removed_mm3': round(cut.Volume, 3), 'valid_single_solid': True}
        assert doc.getObject(prefix + 'Case_level_base').Links == [doc.getObject(prefix + 'Case_solid_base')]
        report['halves'][side] = {'supports': clear, 'h3_pilot_web_mm': round(web, 4), 'removed_objects': removed, 'bases': styles}
        log(f'{side}: {len(posts)} supports, H3 web {web:.3f} mm, ' + ', '.join(f'{s} +{v["added_mm3"]} -{v["removed_mm3"]} mm3' for s, v in styles.items()))
    for name, d in kept.items(): assert shape_digest(doc.getObject(name).Shape) == d, ('Unrelated part changed', name)
    marker = doc.addObject('App::DocumentObjectGroup', 'BaseSupports'); marker.addProperty('App::PropertyString', 'RecipeJSON'); marker.RecipeJSON = json.dumps(report, sort_keys=True)
    for p, pose in poses.items(): doc.getObject(p + 'Half').Placement = pose
    doc.recompute(); a.output.parent.mkdir(parents=True, exist_ok=True); doc.saveAs(str(a.output)); A.closeDocument(doc.Name)
    # Compare independently reopened files: nothing but the base may differ.
    original = A.openDocument(str(a.source))
    for p in poses: original.getObject(p + 'Half').Placement = A.Placement()
    original.recompute()
    was = {name: (shape_digest(original.getObject(name).Shape), measures(original.getObject(name).Shape)) for name in kept}
    A.closeDocument(original.Name)
    doc = A.openDocument(str(a.output)); doc.recompute(); assert not any('Invalid' in o.State or 'Error' in o.State for o in doc.Objects)
    for p in poses: doc.getObject(p + 'Half').Placement = A.Placement()
    doc.recompute()
    same = {}
    for name, (old_digest, old) in was.items():
        now = doc.getObject(name).Shape
        if shape_digest(now) == old_digest: same[name] = 'identical serialized BRep'
        else:                               # a reopened compound may be serialized differently; it must still measure the same
            new = measures(now)
            assert old[:4] == new[:4] and all(abs(u - v) < 1e-6 * max(1, abs(u)) for u, v in zip(old[4:], new[4:])), ('Unrelated part changed after reopening', name, old, new)
            same[name] = 'same topology counts, volume, area and bounds'
    assert not [o.Name for o in doc.Objects if getattr(o, 'PartID', '').split('-', 1)[-1].startswith(('magnet-', 'frame-target-'))], 'magnet part left in the model'
    for p in poses:
        for style in STYLES:
            base = doc.getObject(f'{p}Case_{style}_base').Shape; assert base.isValid() and len(base.Solids) == 1
    A.closeDocument(doc.Name); assert sha(a.source) == digest
    report.update(source_sha256=sha(a.output), saved_reopened=True, unrelated_parts_unchanged=len(same),
                  unrelated_part_comparisons={k: v for k, v in same.items() if v != 'identical serialized BRep'}, passed=True)
    a.report.parent.mkdir(parents=True, exist_ok=True); a.report.write_text(json.dumps(report, indent=2) + '\n')
    log(f'PASS: pilots {2 * pilot:g} mm, stations open as {2 * SOCKET_R:g} mm sockets, magnets removed, PCB supports added; {len(same)} other parts unchanged after reopening')


if __name__ == '__main__':
    try: run()
    except Exception: traceback.print_exc(file=sys.__stderr__); sys.__stderr__.flush(); os._exit(1)
    os._exit(0)
