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
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'mechanical/revI'
TARGET = BASE / 'common-m2'
RECEIPT = ROOT / 'validation/revI-common-fasteners.json'
SPEC = 'design/common-fasteners.json'


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


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
    files, unchanged = {}, []
    for side in ('left', 'right'):
        stems = ['%s-case-%s-plate' % (side, style) for style in catalog['case_styles']]
        for frame in frames:
            stems.append('%s-frame-%s' % (side, frame))
            stems += [Path(part['stl']).stem for part in model['frameVariants']['%s-%s' % (side, frame)]['material_parts']]
        for stem in stems:
            source, default = candidate / (stem + '.stl'), BASE / (stem + '.stl')
            assert sha(source) == exports[stem]['stl_sha256'], ('export not bound to the installation', stem)
            if sha(source) == sha(default):
                unchanged.append(stem)
                continue
            files['mechanical/revI/common-m2/%s.stl' % stem] = sha(source)
            if not dry_run:
                TARGET.mkdir(exist_ok=True)
                shutil.copyfile(source, TARGET / (stem + '.stl'))
    plates = [f for f in files if f.endswith('-plate.stl')]
    assemblies = [f for f in files if any(f.endswith('-frame-%s.stl' % frame) for frame in frames)]
    assert len(plates) == 2 * len(catalog['case_styles']) and len(assemblies) == 2 * len(frames), 'a plate or frame is unchanged'
    receipt = {
        'schema': 'flan-common-fasteners-delivery-1', 'physical_acceptance': False,
        'status': 'Digital checks only: printed fit, thread strength, seating and driver use are untested.',
        'spec': {'path': SPEC, 'sha256': spec_hash},
        'native': {'source_sha256': installation['source_sha256'], 'installer_sha256': installation['installer_sha256'],
                   'candidate_sha256': native, 'saved_reopened': True, 'unaffected_parts_preserved': True,
                   'pockets': installation['recipe']['pockets'],
                   'heads': {side: half['heads'] for side, half in installation['halves'].items()}},
        'cap_travel': {key: travel[key] for key in ('scope', 'checked_reference_choice_head_pairs', 'minimum_xy_clearance_mm', 'limiting')},
        'driver_access': service, 'frames': frames, 'files': dict(sorted(files.items())), 'unchanged': sorted(unchanged),
    }
    if not dry_run:
        stale = sorted(p.name for p in TARGET.glob('*.stl') if 'mechanical/revI/common-m2/' + p.name not in files)
        assert not stale, ('unexpected files in the profile folder', stale)
        RECEIPT.write_text(json.dumps(receipt, indent=2) + '\n')
    print('%s: %d changed files (%d plates, %d frames, %d frame bodies), %d unchanged material parts; driver access %s' % (
        'DRY RUN' if dry_run else 'ADOPTED', len(files), len(plates), len(assemblies),
        len(files) - len(plates) - len(assemblies), len(unchanged), ', '.join(sorted(service))))


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('candidate', type=Path)
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()
    adopt(args.candidate.resolve(), args.dry_run)
