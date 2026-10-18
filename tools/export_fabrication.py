#!/usr/bin/env python3
"""Export source-bound revI prototype Gerbers/drills after routed-board checks.

--variant flan42 exports hardware/flan42 the same way, bound to validation/flan42-routing.json,
into hardware/flan42/fabrication/ with validation/flan42-fabrication.json.
SPDX-License-Identifier: GPL-3.0-or-later
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def export(cli, variant='flan36'):
    family = variant != 'flan36'
    hw = ROOT / ('hardware/' + variant if family else 'hardware/revI')
    receipt = json.loads((ROOT / ('validation/%s-routing.json' % variant if family else 'validation/revI-routing.json')).read_text())
    out = hw / 'fabrication'; out.mkdir(exist_ok=True)
    result = {'schema': 'flan36-fabrication-1', 'physical_acceptance': False,
              'kicad_version': subprocess.check_output([cli, 'version'], text=True).strip(), 'halves': {}}
    if family:
        result = {'schema': 'flan-variant-fabrication-1', 'variant': variant, **{k: v for k, v in result.items() if k != 'schema'}}
    for side, checks in receipt['halves'].items():
        stem = variant + '-' + side
        pcb = hw / (stem + '.kicad_pcb')
        for suffix, key in (('.kicad_pcb','pcb_sha256'),('.kicad_sch','schematic_sha256'),('.kicad_pro','rules_sha256')):
            assert sha(pcb.with_suffix(suffix)) == checks[key], (side, 'Stale routing evidence')
        assert all(checks[k] == 0 for k in ('drc_violations','unconnected_items','schematic_parity','erc_violations'))
        directory = ROOT / ('build/fabrication-' + variant if family else 'build/fabrication') / side
        if directory.exists(): shutil.rmtree(directory)  # only this task's regenerable export
        directory.mkdir(parents=True)
        subprocess.run([cli,'pcb','export','gerbers','-l','F.Cu,B.Cu,F.Mask,B.Mask,F.Silkscreen,B.Silkscreen,Edge.Cuts',
                        '--subtract-soldermask','-o',str(directory)+'/',str(pcb)], check=True)
        subprocess.run([cli,'pcb','export','drill','--format','excellon','--excellon-units','mm',
                        '--excellon-separate-th','--generate-map','--map-format','svg',
                        '-o',str(directory)+'/',str(pcb)], check=True)
        expected = {'gtl','gbl','gts','gbs','gto','gbo','gm1'}
        assert expected <= {p.suffix[1:] for p in directory.iterdir()}
        assert (directory / (stem+'-PTH.drl')).is_file()
        assert (directory / (stem+'-NPTH.drl')).is_file()
        files = {p.name: sha(p) for p in sorted(directory.iterdir()) if p.is_file()}
        manifest = {'side':side,'source':checks,'files':files,'physical_acceptance':False,
                    'specification':{'copper_layers':2,'board_mm':1.6,'copper_oz':1,
                        'minimum_track_mm':.2,'netclass_clearance_mm':.2,'copper_edge_mm':.5},
                    'status':'Prototype candidate; confirm connectors, battery and assembly fit before ordering.'}
        (directory/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
        title = variant.upper() + ' prototype candidate (revI electronics) — ' if family else 'FLAN36 revI prototype candidate — '
        (directory/'README.txt').write_text(title+side+'\n'
            'Two copper layers, 1.6 mm FR4, nominal 1 oz copper. Internal routed cutouts on Edge.Cuts.\n'
            'No panelization or assembly service is specified. Inspect Gerber and drill previews.\n'
            'Digital DRC/ERC/netlist checks passed. This is not a physically qualified build kit.\n'
            'Check exact connectors, cell dimensions/polarity, printed fit and retention before ordering.\n'
            'Build, BOM and hardware acceptance: https://github.com/eduarbo/flan/blob/main/docs/build.md\n')
        package = out / (stem + ('-prototype.zip' if family else '-revI-prototype.zip'))
        with zipfile.ZipFile(package,'w',zipfile.ZIP_DEFLATED) as z:
            for file in sorted(directory.iterdir()): z.write(file,file.name)
        with zipfile.ZipFile(package) as z:
            assert z.testzip() is None
            for file, digest in files.items(): assert hashlib.sha256(z.read(file)).hexdigest() == digest
        result['halves'][side] = {'package':str(package.relative_to(ROOT)), 'sha256':sha(package), 'manifest':manifest}
    (ROOT/('validation/%s-fabrication.json' % variant if family else 'validation/revI-fabrication.json')).write_text(json.dumps(result,indent=2)+'\n')
    print('PASS: two source-bound prototype fabrication packages, ZIP readback verified')


if __name__ == '__main__':
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--cli',default='/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli')
    ap.add_argument('--variant',default='flan36',help='flan36 exports hardware/revI; flan42 hardware/flan42')
    a=ap.parse_args(); export(a.cli, a.variant)
