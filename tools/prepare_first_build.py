#!/usr/bin/env python3
"""Freeze a downloaded complete Flan36 kit with matching PCB/firmware and fit samples.
SPDX-License-Identifier: GPL-3.0-or-later
"""
import argparse
import json
import subprocess
import zipfile
from pathlib import Path

from check_build_candidate import ROOT, read, sha, verify


def prepare(print_kit, output):
    verify()
    files = {'printing/' + print_kit.name: print_kit.read_bytes()}
    with zipfile.ZipFile(print_kit) as archive:
        assert archive.testzip() is None
        manifest = json.loads(archive.read('manifest.json'))
        config = manifest['configuration']
        assert config['variant'] == 'flan36' and manifest['half'] == 'both' and manifest['scope'] == 'complete'
        assert not manifest['keycaps']['missing']
        assert sum(g['count'] for g in manifest['keycaps']['groups']) == 36
        for part in manifest['parts']:
            assert sha((ROOT / part['source']).read_bytes()) == part['source_sha256']
            assert sha(archive.read(f'STL/{part["id"]}.stl')) == part['source_sha256']
        for filename in manifest['keycaps']['bundled']:
            files['samples/' + filename] = archive.read('Keycaps/' + filename)
    files['configuration.json'] = (json.dumps(config, indent=2) + '\n').encode()
    edition = next(e for e in read('design/pcb-options.json')['editions'] if e['id'] == config['pcb_edition'])
    paths = list(edition['packages'].values())
    paths += [f'firmware/uf2/flan36-{side}.uf2' for side in ('left', 'right', 'right-no-display')]
    paths += [f'mechanical/revI/coupon-{name}.stl' for name in ('magnet-base', 'magnet-frame', 'm2-thread')]
    paths += [f'docs/{name}.md' for name in ('first-build', 'parts', 'build', 'electronics', 'firmware', 'launch')]
    paths += ['LICENSE', 'LICENSES/CC-BY-SA-4.0.txt', 'TRADEMARKS.md']
    for name in paths:
        files[name] = (ROOT / name).read_bytes()
    files['LEEME.txt'] = (
        'FLAN36 — PRIMER PROTOTIPO / FIRST PROTOTYPE\n\n'
        'Empieza por docs/first-build.md y docs/parts.md. La aceptación física sigue pendiente.\n'
        'No hay compras realizadas ni perfiles de impresora/G-code calificados.\n'
        'Imprime una copia de cada cap de samples/ y los tres cupones de mechanical/revI/.\n'
        'Después imprime las placas y comprueba el encaje del switch antes de las demás piezas.\n'
        'printing/ contiene el kit completo y sus licencias, instrucciones, STL y 3MF.\n'
        'hardware/ contiene los dos trabajos PCB: izquierdo y derecho, misma edición.\n'
        'firmware/ contiene izquierda, derecha y la alternativa derecha sin pantalla.\n'
        'Conserva configuration.json y manifest.json junto con los resultados del montaje.\n'
        'Los enlaces auxiliares de las guías se pueden consultar en https://github.com/eduarbo/flan/tree/main/docs\n'
    ).encode()
    receipt = {
        'schema': 'flan-first-build-1', 'physical_acceptance': False,
        'source_commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
        'source_has_local_changes': bool(subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT)),
        'configuration': config, 'print_kit_sha256': sha(print_kit.read_bytes()),
        'files': {name: sha(data) for name, data in sorted(files.items())},
    }
    files['manifest.json'] = (json.dumps(receipt, indent=2) + '\n').encode()
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for name, data in sorted(files.items()):
            info = zipfile.ZipInfo(name, (2026, 10, 20, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, data)
    with zipfile.ZipFile(output) as archive:
        assert archive.testzip() is None
        assert all(sha(archive.read(name)) == digest for name, digest in receipt['files'].items())
    print(f'PASS: {output} ({len(files)} files); SHA-256 {sha(output.read_bytes())}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--print-kit', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=ROOT / 'build/first-build/Flan36-first-build.zip')
    args = parser.parse_args()
    prepare(args.print_kit, args.output)
