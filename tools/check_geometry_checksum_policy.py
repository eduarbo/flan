#!/usr/bin/env python3
"""Verify the exact public geometry checksum exception and detection controls.
SPDX-License-Identifier: GPL-3.0-or-later
"""
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def run():
    catalog = json.loads((ROOT / 'keycaps/catalog.json').read_text())
    digest = hashlib.sha256(json.dumps(catalog['variants'], sort_keys=True).encode()).hexdigest()
    recipe = json.loads((ROOT / 'design/revI.json').read_text())['level_stack']
    assert recipe['inputs_sha256']['keycap_geometry'] == digest
    line = '    "keycap_geometry": "' + digest + '"\n'
    changed = ('0' if digest[0] != '0' else '1') + digest[1:]
    cases = [
        ('exact_geometry', 'design/revI.json', line, False),
        ('different_path', 'design/control.json', line, True),
        ('different_field', 'design/revI.json', line.replace('keycap_geometry', 'api_key'), True),
        ('different_value', 'design/revI.json', line.replace(digest, changed), True),
        ('additional_field', 'design/revI.json', line.rstrip() + ', "api_key": "' + changed + '"\n', True),
        ('other_line_same_file', 'design/revI.json', line + '"api_key": "' + changed + '"\n', True),
    ]
    manifests = {
        'validation/revI-mechanical.json': 'exported_files',
        'validation/revI-stock-display-mechanical.json': 'exported_files',
        'validation/revI-stock-display-adoption.json': 'final_exported_files',
    }
    plate_hashes = {}
    for side in ('left', 'right'):
        for extension in ('step', 'stl'):
            name = f'{side}-key-plate.{extension}'
            plate_digest = hashlib.sha256((ROOT / 'mechanical/revI' / name).read_bytes()).hexdigest()
            plate_hashes[name] = plate_digest
            altered = ('0' if plate_digest[0] != '0' else '1') + plate_digest[1:]
            for path, field in manifests.items():
                assert json.loads((ROOT / path).read_text())[field][name] == plate_digest
                exact = f'    "{name}": "{plate_digest}"\n'
                prefix = f'{side}_{extension}_{Path(path).stem}_'
                cases.extend([
                    (prefix + 'exact', path, exact, False),
                    (prefix + 'different_path', 'validation/control.json', exact, True),
                    (prefix + 'different_field', path, exact.replace(name, 'api_key'), True),
                    (prefix + 'different_value', path, exact.replace(plate_digest, altered), True),
                    (prefix + 'additional_field', path, exact.rstrip() + ', "api_key": "' + altered + '"\n', True),
                    (prefix + 'other_line', path, exact + '"api_key": "' + altered + '"\n', True),
                ])
    results = []
    with tempfile.TemporaryDirectory(prefix='flan36-checksum-policy-') as temp:
        for name, path, text, detect in cases:
            fixture = Path(temp) / name
            target = fixture / path
            target.parent.mkdir(parents=True)
            target.write_text(text)
            report = Path(temp) / (name + '.json')
            proc = subprocess.run([
                'gitleaks', 'dir', '.', '--config', str(ROOT / '.gitleaks.toml'),
                '--redact', '--no-banner', '--no-color', '--report-format', 'json',
                '--report-path', str(report),
            ], cwd=fixture, capture_output=True, text=True)
            findings = json.loads(report.read_text())
            assert proc.returncode == int(detect), (name, proc.returncode, proc.stderr)
            assert any(f['RuleID'] == 'generic-api-key' for f in findings) == detect, name
            results.append({'control': name, 'expected_detection': detect, 'passed': True})
    output = ROOT / 'build/level-case/checksum-policy-controls.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({
        'passed': True,
        'scanner_version': subprocess.check_output(['gitleaks', 'version'], text=True).strip(),
        'config_sha256': hashlib.sha256((ROOT / '.gitleaks.toml').read_bytes()).hexdigest(),
        'recomputed_geometry_sha256': digest,
        'recomputed_plate_sha256': plate_hashes,
        'controls': results,
    }, indent=2) + '\n')
    print(f'PASS: geometry checksums reproduced; {len(results)} exact exception/detection controls verified')


if __name__ == '__main__':
    run()
