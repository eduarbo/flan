#!/usr/bin/env python3
"""Reject wrong duplicate pads and broken routes in disposable PCB copies.

--variant flan42 runs the same mutations on hardware/flan42 (an added key's pad) plus a
0.1 mm move of K00, which the variant geometry check must reject.
Run with KiCad Python. SPDX-License-Identifier: GPL-3.0-or-later
"""
import argparse
import json
from pathlib import Path
import shutil
import subprocess

import pcbnew as p
from check_routed_pcb import ROOT, verify

CLI='/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli'


def test(variant='flan36'):
    family=variant!='flan36'; key='K00' if family else 'K01'
    root=ROOT/('build/routing-negative-'+variant if family else 'build/routing-negative'); root.mkdir(parents=True,exist_ok=True)
    receipt=ROOT/(f'validation/{variant}-routing.json' if family else 'validation/revI-routing.json'); before=receipt.read_bytes(); cases=[]
    for kind in ('one-duplicate-pad','disconnected-row')+(('moved-added-key',) if family else ()):
        directory=root/kind; directory.mkdir(exist_ok=True)
        for side in ('left','right'):
            for ext in ('kicad_pcb','kicad_pro','kicad_sch'):
                name=f'{variant}-{side}.{ext}';shutil.copyfile(ROOT/('hardware/'+variant if family else 'hardware/revI')/name,directory/name)
        path=directory/f'{variant}-left.kicad_pcb';board=p.LoadBoard(str(path))
        if kind=='moved-added-key':
            fp=next(f for f in board.GetFootprints() if f.GetReference()==key)
            fp.Move(p.VECTOR2I(p.FromMM(.1),0))
        elif kind=='one-duplicate-pad':
            fp=next(f for f in board.GetFootprints() if f.GetReference()==key)
            pads=[q for q in fp.Pads() if q.GetNumber()=='1']; assert len(pads)>1
            net=next(n for n in board.GetNetsByNetcode().values() if n.GetNetname()=='/COL2')
            pads[0].SetNet(net)
        else:
            tracks=[t for t in board.GetTracks() if t.GetNetname()=='/ROW0']; assert tracks
            for track in tracks:board.Remove(track)
        p.SaveBoard(str(path),board)
        try: verify(directory,directory/'checks',CLI,variant)
        except AssertionError as error:
            assert (kind=='one-duplicate-pad' and key in str(error)) or (kind=='moved-added-key' and key in str(error)),error
        except subprocess.CalledProcessError:
            assert kind=='disconnected-row'
            drc=json.loads((directory/'checks/drc-left.json').read_text());assert drc['unconnected_items']
        else: raise AssertionError('Broken PCB accepted')
        assert receipt.read_bytes()==before
        cases.append({'mutation':kind,'rejected':True,'canonical_receipt_unchanged':True})
    out=ROOT/(f'validation/{variant}-routing-negative.json' if family else 'validation/revI-routing-negative.json')
    out.write_text(json.dumps({'cases':cases,'isolated_copy':True},indent=2)+'\n')
    print('PASS: one mismatched duplicate pad and a disconnected row rejected'+(', and a moved added key' if family else ''))


if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__); ap.add_argument('--variant',default='flan36')
    test(ap.parse_args().variant)
