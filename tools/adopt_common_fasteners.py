#!/usr/bin/env python3
"""Adopt the checked common-M2 plates and frames as the explorer's optional screw profile.

Copies only the native exports that differ from the default kit into mechanical/revI/common-m2/
and writes validation/revI-common-fasteners.json, which the viewer build requires. Every copied
file is bound to the installer's own export hash, and every case style needs a passed
driver-access report for the same native candidate. See docs/common-fasteners.md.

    python3 tools/adopt_common_fasteners.py build/common-fasteners [--dry-run]

Digital evidence only; nothing here is a physical acceptance.
SPDX-License-Identifier: GPL-3.0-or-later
"""
import argparse
import hashlib
import json
import math
import shutil
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'mechanical/revI'
TARGET = BASE / 'common-m2'
RECEIPT = ROOT / 'validation/revI-common-fasteners.json'
SPEC = 'design/common-fasteners.json'


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def triangles(path):
    data = Path(path).read_bytes()
    count = struct.unpack_from('<I', data, 80)[0]
    assert len(data) == 84 + 50 * count, (path, 'expected a binary STL')
    for i in range(count):
        v = struct.unpack_from('<9f', data, 84 + 50 * i + 12)
        yield (v[0:3], v[3:6], v[6:9])


def clip(polygon, limit, keep_above):
    out = []
    for a, b in zip(polygon, polygon[1:] + polygon[:1]):
        ina, inb = (a[2] >= limit) == keep_above, (b[2] >= limit) == keep_above
        if ina:
            out.append(a)
        if ina != inb:
            t = (limit - a[2]) / (b[2] - a[2])
            out.append(tuple(a[k] + t * (b[k] - a[k]) for k in range(3)))
    return out


def wall_gap(path, x, y, z0, z1, radius, reach=6.0):
    """Horizontal gap between a vertical cylinder and the mesh from z0 to z1; None when nothing is within reach."""
    best = None
    for tri in triangles(path):
        if max(p[2] for p in tri) < z0 or min(p[2] for p in tri) > z1:
            continue
        if (min(p[0] for p in tri) > x + reach or max(p[0] for p in tri) < x - reach
                or min(p[1] for p in tri) > y + reach or max(p[1] for p in tri) < y - reach):
            continue
        polygon = clip(clip(list(tri), z0, True), z1, False)
        if len(polygon) < 2:
            continue
        inside, sign = len(polygon) >= 3, None
        for a, b in zip(polygon, polygon[1:] + polygon[:1]):
            dx, dy = b[0] - a[0], b[1] - a[1]
            length2 = dx * dx + dy * dy
            t = 0 if length2 == 0 else max(0, min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / length2))
            distance = math.hypot(x - a[0] - t * dx, y - a[1] - t * dy)
            best = distance if best is None else min(best, distance)
            cross = dx * (y - a[1]) - dy * (x - a[0])
            if abs(cross) > 1e-12:
                if sign is None:
                    sign = cross > 0
                elif sign != (cross > 0):
                    inside = False
        if inside and sign is not None:
            best = 0.0          # the screw axis passes through this facet inside the head's height
    return None if best is None or best > reach else best - radius


def adopt(candidate, dry_run=False):
    read = lambda name: json.loads((candidate / name).read_text())
    installation, travel = read('installation.json'), read('cap-travel.json')
    spec_hash = sha(ROOT / SPEC)
    assert installation['passed'] and installation['saved_reopened'] and installation['unaffected_parts_preserved']
    assert installation['recipe']['spec_sha256'] == spec_hash == travel['head_profile']['sha256'], 'specification changed'
    native = installation['output_sha256']
    assert sha(candidate / 'Flan36.FCStd') == native, 'native candidate changed after installation'
    catalog = json.loads((ROOT / 'keycaps/catalog.json').read_text())
    frames = json.loads((ROOT / 'design/frame-selection.json').read_text())['selected']
    model = json.loads((ROOT / 'design/revI.json').read_text())
    # Driver access was checked with the frame and caps removed, once per plate.
    service = {}
    for style in catalog['case_styles']:
        reports = [candidate / 'service.json', candidate / ('service-' + style) / 'service.json']
        report = next((r for r in map(lambda p: json.loads(p.read_text()) if p.exists() else None, reports)
                       if r and all(r['configuration']['cases'][s]['style'] == style for s in ('left', 'right'))), None)
        assert report, ('no driver-access report for case style', style)
        assert report['passed'] and report['candidate_sha256'] == native and report['exterior_bounds_preserved'], style
        collisions = sum(len(m['collisions']) for half in report['halves'].values() for m in half)
        assert collisions == 0, (style, 'driver collisions')
        service[style] = {'passed': True, 'mounts_checked': sum(len(h) for h in report['halves'].values()),
                          'driver_envelope': report['driver_envelope'], 'checker_sha256': report['checker_sha256']}
    exports = {}
    for half in installation['halves'].values():
        exports.update(half['exports'])
    files, unchanged = {}, {}
    for side in ('left', 'right'):
        stems = ['%s-case-%s-plate' % (side, style) for style in catalog['case_styles']]
        for frame in frames:
            stems.append('%s-frame-%s' % (side, frame))
            stems += [Path(part['stl']).stem for part in model['frameVariants']['%s-%s' % (side, frame)]['material_parts']]
        for stem in stems:
            source, default = candidate / (stem + '.stl'), BASE / (stem + '.stl')
            assert sha(source) == exports[stem]['stl_sha256'], ('export not bound to the installation', stem)
            if sha(source) == sha(default):
                unchanged[stem] = sha(default)
                continue
            files['mechanical/revI/common-m2/%s.stl' % stem] = sha(source)
            if not dry_run:
                TARGET.mkdir(exist_ok=True)
                shutil.copyfile(source, TARGET / (stem + '.stl'))
    plates = [f for f in files if f.endswith('-plate.stl')]
    assemblies = [f for f in files if any(f.endswith('-frame-%s.stl' % frame) for frame in frames)]
    assert len(plates) == 2 * len(catalog['case_styles']) and len(assemblies) == 2 * len(frames), 'a plate or frame is unchanged'
    # The installer proves no head collides. Its 0.30 mm clearance rule covers only the two pocketed short
    # screws, so the long screws' side gap is measured here on the adopted plates, between seat and head top.
    spec = json.loads((ROOT / SPEC).read_text())
    radius, height = spec['head_envelope_mm']['diameter'] / 2, spec['head_envelope_mm']['height']
    mounts = [m for m in json.loads((ROOT / 'design/revI-mounts.json').read_text())['left']
              if m['length'] == spec['lengths_mm']['plate']]
    long_heads = {}
    for style in catalog['case_styles']:
        long_heads[style] = {}
        for mount in mounts:
            gaps = []
            for side in ('left', 'right'):
                x = mount['xy'][0] if side == 'left' else 160 - mount['xy'][0]
                plate = candidate / ('%s-case-%s-plate.stl' % (side, style))
                gaps.append(wall_gap(plate, x, -mount['xy'][1], mount['seat_z'] + .05, mount['seat_z'] + height, radius))
            near = [g for g in gaps if g is not None]
            assert all(g > 0 for g in near), (style, mount['id'], 'long head touches the plate')
            long_heads[style][mount['id']] = round(min(near), 3) if near else None
    receipt = {
        'schema': 'flan-common-fasteners-delivery-1', 'physical_acceptance': False,
        'status': 'Digital checks only: printed fit, thread strength, seating and driver use are untested.',
        'spec': {'path': SPEC, 'sha256': spec_hash},
        'native': {'source_sha256': installation['source_sha256'], 'installer_sha256': installation['installer_sha256'],
                   'candidate_sha256': native, 'saved_reopened': True, 'unaffected_parts_preserved': True,
                   'pockets': installation['recipe']['pockets'],
                   'heads': {side: half['heads'] for side, half in installation['halves'].items()}},
        'cap_travel': {key: travel[key] for key in ('scope', 'checked_reference_choice_head_pairs', 'minimum_xy_clearance_mm', 'limiting')},
        'long_heads': {'scope': 'Horizontal gap in mm between the head envelope on its plate seat and the plate, from seat to head top, '
                                'smaller of both halves; null means no wall within 6 mm. Not enforced: a printed fit can differ.',
                       'head_mm': spec['head_envelope_mm'], 'gap_mm': long_heads},
        'driver_access': service, 'frames': frames, 'files': dict(sorted(files.items())), 'unchanged': dict(sorted(unchanged.items())),
    }
    if not dry_run:
        stale = sorted(p.name for p in TARGET.glob('*.stl') if 'mechanical/revI/common-m2/' + p.name not in files)
        assert not stale, ('unexpected files in the profile folder', stale)
        RECEIPT.write_text(json.dumps(receipt, indent=2) + '\n')
    tight = {'%s %s' % (style, mount): gap for style, gaps in long_heads.items() for mount, gap in gaps.items() if gap is not None}
    print('%s: %d changed files (%d plates, %d frames, %d frame bodies), %d unchanged material parts; driver access %s; '
          'long-head walls %s' % ('DRY RUN' if dry_run else 'ADOPTED', len(files), len(plates), len(assemblies),
                                 len(files) - len(plates) - len(assemblies), len(unchanged), ', '.join(sorted(service)), tight or 'none'))


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('candidate', type=Path)
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()
    adopt(args.candidate.resolve(), args.dry_run)
