#!/usr/bin/env python3
"""Export and verify assembly BOM/placement files for the routed Flan36 revI boards.

KiCad's automatic position export is wrong for these boards: the hot-swap footprint is a
front-side, through-hole footprint centred on the switch, while the physical Kailh socket is a
surface-mount part on the back, centred between its two posts. This tool derives every
placement from the physical pads instead and checks it against the assembler's library
footprint before writing anything.

Run with a Python that can import pcbnew (see docs/electronics.md):

    "$KICAD_PY" tools/export_assembly.py                    # sockets + diodes + reset (back only)
    "$KICAD_PY" tools/export_assembly.py --profile diodes   # diodes + reset (back only)
    "$KICAD_PY" tools/export_assembly.py --profile full     # adds power switch and battery jack (front)

Outputs go to ignored build/assembly/<profile>/. Nothing here qualifies a physical assembly;
confirm every placement in the assembler's own preview before ordering.
SPDX-License-Identifier: GPL-3.0-or-later
"""
import argparse
import csv
import hashlib
import json
import math
from pathlib import Path

import pcbnew

ROOT = Path(__file__).resolve().parents[1]
HW = ROOT / 'hardware/revI'

# Assembler library footprints, in millimetres, as drawn in the library (top view, Y down),
# relative to the library origin. Read from the EasyEDA/JLCPCB library on 2026-11-12.
# 'polar' parts must land pad-number on pad-number; the others only need the same pad set.
PARTS = {
    'socket': dict(
        value='CHOC v1', mpn='CPG135001S30', maker='Kailh', lcsc='C5333465', side='bottom',
        package='Kailh Choc hot-swap socket', polar=False, mount='SMT',
        pads=[('1', -5.775, 1.100), ('2', 5.775, -1.100)], holes=[(-2.5, 1.1), (2.5, -1.1)]),
    'diode': dict(
        value='1N4148W', mpn='1N4148W', maker='Semtech', lcsc='C81598', side='bottom',
        package='SOD-123', polar=True, mount='SMT',
        pads=[('1', -1.735, 0.0), ('2', 1.735, 0.0)], holes=[]),
    'reset': dict(
        value='TL3342', mpn='TL3342F160QG/TR', maker='E-Switch', lcsc='C2918453', side='bottom',
        package='TL3342 5.2x5.2 mm', polar=False, mount='SMT',
        pads=[('1', -3.0, 1.85), ('2', 3.0, 1.85), ('3', -3.0, -1.85), ('4', 3.0, -1.85)], holes=[]),
    'power': dict(
        value='PCM12SMTR', mpn='PCM12SMTR', maker='C&K', lcsc='C221841', side='top',
        package='PCM12', polar=True, mount='SMT',
        pads=[('1', -2.25, -1.4), ('2', 0.75, -1.4), ('3', 2.25, -1.4)],
        holes=[(-1.5, 0.4), (1.5, 0.4)]),
    'jack': dict(
        value='JST_PH_S2B-PH-K-S', mpn='S2B-PH-K-S(LF)(SN)', maker='JST', lcsc='C173752', side='top',
        package='JST PH 2 mm side entry', polar=True, mount='THT', pads=None, holes=[]),
}
PROFILES = {
    'back': ('socket', 'diode', 'reset'),
    'diodes': ('diode', 'reset'),
    'full': ('socket', 'diode', 'reset', 'power', 'jack'),
}
EXPECTED = {'socket': 18, 'diode': 18, 'reset': 1, 'power': 1, 'jack': 1}
JOINTS = {'socket': 2, 'diode': 2, 'reset': 4, 'power': 7, 'jack': 2}   # hand joints each part replaces
TOLERANCE_MM = 0.25


def mm(value):
    return pcbnew.ToMM(value)


def pad_xy(pad):
    """Pad centre in fabrication coordinates: KiCad X, negated KiCad Y (as in the Gerbers)."""
    p = pad.GetPosition()
    return (mm(p.x), -mm(p.y))


def on(pad, layer):
    return pad.GetLayerSet().Contains(layer)


def place(lib_xy, centre, rotation, side):
    """Library point (top view, Y down) -> board point (top view, Y up).

    Assumed assembler convention: a front part is the library footprint turned counter-clockwise
    by `rotation`; a back part is the same turned counter-clockwise as seen from the back.
    """
    x, y = lib_xy[0], -lib_xy[1]
    a = math.radians(rotation)
    rx, ry = x * math.cos(a) - y * math.sin(a), x * math.sin(a) + y * math.cos(a)
    if side == 'bottom':
        rx = -rx
    return (centre[0] + rx, centre[1] + ry)


def nearest(point, candidates):
    return min(candidates, key=lambda c: math.hypot(c[1][0] - point[0], c[1][1] - point[1]))


def physical(fp, kind):
    """Physical side, centre, rotation and the board pads/holes the part must land on."""
    part = PARTS[kind]
    side = part['side']
    layer = pcbnew.B_Cu if side == 'bottom' else pcbnew.F_Cu
    theta = fp.GetOrientationDegrees()
    pos = fp.GetPosition()
    origin = (mm(pos.x), -mm(pos.y))
    if kind == 'socket':
        smd = [p for p in fp.Pads() if p.GetAttribute() == pcbnew.PAD_ATTRIB_SMD and on(p, layer)
               and not on(p, pcbnew.F_Cu)]
        assert len(smd) == 2, (fp.GetReference(), 'expected two back-only socket contacts')
        posts = [p for p in fp.Pads() if p.GetAttribute() == pcbnew.PAD_ATTRIB_NPTH
                 and abs(mm(p.GetDrillSize().x) - 3.0) < 0.01]
        assert len(posts) == 2, (fp.GetReference(), 'expected two 3.0 mm socket post holes')
        a, b = (pad_xy(p) for p in smd)
        centre = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        h = [pad_xy(p) for p in posts]
        hole_mid = ((h[0][0] + h[1][0]) / 2, (h[0][1] + h[1][1]) / 2)
        assert math.hypot(centre[0] - hole_mid[0], centre[1] - hole_mid[1]) < 0.01, fp.GetReference()
        assert not fp.IsFlipped(), (fp.GetReference(), 'socket footprint is expected on the front')
        rotation = (-theta) % 360          # front footprint, part seen from the back
        targets = [(p.GetNumber(), pad_xy(p)) for p in smd]
        holes = h
    else:
        flipped = fp.IsFlipped()
        assert flipped == (side == 'bottom'), (fp.GetReference(), 'unexpected footprint side')
        centre = origin
        rotation = ((180 - theta) if flipped else theta) % 360
        targets = [(p.GetNumber(), pad_xy(p)) for p in fp.Pads() if p.GetNumber() and on(p, layer)]
        holes = [pad_xy(p) for p in fp.Pads() if p.GetAttribute() == pcbnew.PAD_ATTRIB_NPTH]
    worst = 0.0
    if part['pads'] is not None:
        for number, lx, ly in part['pads']:
            target = nearest(place((lx, ly), centre, rotation, side), targets)
            point = place((lx, ly), centre, rotation, side)
            error = math.hypot(target[1][0] - point[0], target[1][1] - point[1])
            assert error <= TOLERANCE_MM, (fp.GetReference(), 'pad', number, round(error, 3))
            if part['polar']:
                assert target[0] == number, (fp.GetReference(), 'pin', number, 'lands on', target[0])
            worst = max(worst, error)
        for lx, ly in part['holes']:
            point = place((lx, ly), centre, rotation, side)
            error = min(math.hypot(q[0] - point[0], q[1] - point[1]) for q in holes)
            assert error <= TOLERANCE_MM, (fp.GetReference(), 'post', round(error, 3))
            worst = max(worst, error)
    return dict(ref=fp.GetReference(), kind=kind, side=side, x=round(centre[0], 4), y=round(centre[1], 4),
                rotation=round(rotation, 3), kicad_origin=[round(origin[0], 4), round(origin[1], 4)],
                kicad_rotation=round(theta, 3), kicad_layer='B.Cu' if fp.IsFlipped() else 'F.Cu',
                origin_shift_mm=round(math.hypot(centre[0] - origin[0], centre[1] - origin[1]), 3),
                library_fit_mm=round(worst, 3) if part['pads'] is not None else None)


def export(profile):
    kinds = PROFILES[profile]
    out = ROOT / 'build/assembly' / profile
    out.mkdir(parents=True, exist_ok=True)
    by_value = {part['value']: kind for kind, part in PARTS.items()}
    report = {'schema': 'flan36-assembly-1', 'profile': profile, 'physical_acceptance': False,
              'rotation_convention': 'front: counter-clockwise; back: counter-clockwise seen from the back. '
                                     'Assumed; confirm in the assembler preview.',
              'library_checked': '2026-11-12', 'tolerance_mm': TOLERANCE_MM, 'halves': {}}
    verified = {}
    for side_name in ('left', 'right'):                 # verify both halves before writing anything
        pcb = HW / ('flan36-%s.kicad_pcb' % side_name)
        board = pcbnew.LoadBoard(str(pcb))
        found = {kind: [] for kind in PARTS}
        for fp in board.GetFootprints():
            kind = by_value.get(fp.GetValue())
            if kind:
                found[kind].append(physical(fp, kind))
        for kind, count in EXPECTED.items():
            assert len(found[kind]) == count, (side_name, kind, len(found[kind]))
        verified[side_name] = (pcb, sorted((r for kind in kinds for r in found[kind]),
                                           key=lambda r: (r['kind'], r['ref'])))
    for side_name, (pcb, rows) in verified.items():
        stem = 'flan36-%s-%s' % (side_name, profile)
        with open(out / (stem + '-bom-jlc.csv'), 'w', newline='') as f:
            w = csv.writer(f)
            w.writerow(['Comment', 'Designator', 'Footprint', 'LCSC Part #'])
            for kind in kinds:
                p = PARTS[kind]
                w.writerow([p['mpn'], ','.join(r['ref'] for r in rows if r['kind'] == kind), p['package'], p['lcsc']])
        with open(out / (stem + '-cpl-jlc.csv'), 'w', newline='') as f:
            w = csv.writer(f)
            w.writerow(['Designator', 'Mid X', 'Mid Y', 'Layer', 'Rotation'])
            for r in rows:
                w.writerow([r['ref'], '%.4fmm' % r['x'], '%.4fmm' % r['y'],
                            'Bottom' if r['side'] == 'bottom' else 'Top', '%g' % r['rotation']])
        with open(out / (stem + '-bom.csv'), 'w', newline='') as f:
            w = csv.writer(f)
            w.writerow(['Item', 'Quantity', 'Designators', 'Manufacturer', 'Manufacturer part', 'Package', 'Mount', 'Side'])
            for i, kind in enumerate(kinds, 1):
                p = PARTS[kind]
                refs = [r['ref'] for r in rows if r['kind'] == kind]
                w.writerow([i, len(refs), ' '.join(refs), p['maker'], p['mpn'], p['package'], p['mount'], p['side']])
        with open(out / (stem + '-centroid.csv'), 'w', newline='') as f:
            w = csv.writer(f)
            w.writerow(['Designator', 'X (mm)', 'Y (mm)', 'Side', 'Rotation (deg)', 'Manufacturer part'])
            for r in rows:
                w.writerow([r['ref'], '%.4f' % r['x'], '%.4f' % r['y'], r['side'], '%g' % r['rotation'], PARTS[r['kind']]['mpn']])
        joints = sum(JOINTS[r['kind']] for r in rows)
        report['halves'][side_name] = {
            'source_pcb_sha256': hashlib.sha256(pcb.read_bytes()).hexdigest(),
            'counts': {kind: sum(r['kind'] == kind for r in rows) for kind in kinds},
            'sides': sorted({r['side'] for r in rows}), 'solder_joints': joints, 'placements': rows}
    (out / 'assembly.json').write_text(json.dumps(report, indent=1) + '\n')
    for side_name, half in report['halves'].items():
        shifted = [r for r in half['placements'] if r['origin_shift_mm'] > 0.01]
        print('%s: %s, sides %s, %d joints; %d placements moved off the KiCad origin (max %.3f mm)' % (
            side_name, half['counts'], '+'.join(half['sides']), half['solder_joints'], len(shifted),
            max((r['origin_shift_mm'] for r in shifted), default=0)))
    print('PASS: every placement lands on its physical pads within %.2f mm -> %s' % (TOLERANCE_MM, out.relative_to(ROOT)))


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--profile', choices=sorted(PROFILES), default='back')
    export(ap.parse_args().profile)
