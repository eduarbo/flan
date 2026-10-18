#!/usr/bin/env python3
"""Reject wrong duplicate pads and broken routes in disposable PCB copies.

--variant flan42 (or flan46, flan54) runs the same mutations on hardware/<variant> (on the
variant's first added key) plus a 0.1 mm move of that key, which the variant geometry check
must reject; number-row variants also cut J1's GND link on the left, which the GND copper
check must reject now that U1 GND3 is released there.
Run with KiCad Python. SPDX-License-Identifier: GPL-3.0-or-later
"""
import argparse
import re
import json
from pathlib import Path
import shutil
import subprocess

import pcbnew as p
from check_routed_pcb import ROOT, verify

CLI='/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli'


def children(text):
    """Root-level items of a KiCad S-expression file as (start, end, text)."""
    depth=0;quoted=False;escaped=False;start=None
    for i,c in enumerate(text):
        if quoted:
            if escaped:escaped=False
            elif c=='\\':escaped=True
            elif c=='"':quoted=False
        elif c=='"':quoted=True
        elif c=='(':
            depth+=1
            if depth==2:start=i
        elif c==')':
            if depth==2:yield start,i+1,text[start:i+1]
            depth-=1


def test(variant='flan36'):
    family=variant!='flan36'
    key=json.loads((ROOT/'design/variants.json').read_text())['variants'][variant]['added_per_half'][0] if family else 'K01'
    wrong='/COL3' if key[2]=='2' else '/COL2'   # a column the key is not on
    root=ROOT/('build/routing-negative-'+variant if family else 'build/routing-negative'); root.mkdir(parents=True,exist_ok=True)
    receipt=ROOT/(f'validation/{variant}-routing.json' if family else 'validation/revI-routing.json'); before=receipt.read_bytes(); cases=[]
    number_row=family and json.loads((ROOT/'design/variants.json').read_text())['variants'][variant]['number_row']
    for kind in ('one-duplicate-pad','disconnected-row')+(('moved-added-key',) if family else ())+(('gnd-split',) if number_row else ()):
        directory=root/kind; directory.mkdir(exist_ok=True)
        for side in ('left','right'):
            for ext in ('kicad_pcb','kicad_pro','kicad_sch'):
                name=f'{variant}-{side}.{ext}';shutil.copyfile(ROOT/('hardware/'+variant if family else 'hardware/revI')/name,directory/name)
        path=directory/f'{variant}-left.kicad_pcb';board=p.LoadBoard(str(path))
        if family and kind in ('gnd-split','disconnected-row'):
            # As text: removing items through pcbnew corrupts the binding for later cases.
            if kind=='gnd-split':   # J1 pad 2 keeps GND only through its own tracks once GND3 is released
                j1=next(q for f in board.GetFootprints() if f.GetReference()=='J1' for q in f.Pads() if q.GetNumber()=='2')
                at={(round(p.ToMM(j1.GetPosition().x),4),round(p.ToMM(j1.GetPosition().y),4))}
                hit=lambda s:'(net "/GND")' in s and s.startswith('(segment') and at & {
                    (round(float(x),4),round(float(y),4)) for x,y in re.findall(r'\((?:start|end) ([-\d.]+) ([-\d.]+)\)',s)}
            else:
                hit=lambda s:'(net "/ROW0")' in s and s.startswith(('(segment','(via'))
            text=path.read_text(); kept=[]; last=0; removed=0
            for a,b,s in children(text):
                if hit(s): kept.append(text[last:a]); last=b; removed+=1
            kept.append(text[last:]); assert removed
            path.write_text(''.join(kept)); board=None
        elif kind=='moved-added-key':
            fp=next(f for f in board.GetFootprints() if f.GetReference()==key)
            fp.Move(p.VECTOR2I(p.FromMM(.1),0))
        elif kind=='one-duplicate-pad':
            fp=next(f for f in board.GetFootprints() if f.GetReference()==key)
            pads=[q for q in fp.Pads() if q.GetNumber()=='1']; assert len(pads)>1
            net=next(n for n in board.GetNetsByNetcode().values() if n.GetNetname()==wrong)
            pads[0].SetNet(net)
        else:
            tracks=[t for t in board.GetTracks() if t.GetNetname()=='/ROW0']; assert tracks
            for track in tracks:board.Remove(track)
        if board is not None: p.SaveBoard(str(path),board)
        try: verify(directory,directory/'checks',CLI,variant)
        except AssertionError as error:
            assert (kind=='one-duplicate-pad' and key in str(error)) or (kind=='moved-added-key' and key in str(error)) \
                or (kind=='gnd-split' and 'GND split' in str(error)),error
        except subprocess.CalledProcessError:
            assert kind=='disconnected-row'
            drc=json.loads((directory/'checks/drc-left.json').read_text());assert drc['unconnected_items']
        else: raise AssertionError('Broken PCB accepted')
        assert receipt.read_bytes()==before
        cases.append({'mutation':kind,'rejected':True,'canonical_receipt_unchanged':True})
    out=ROOT/(f'validation/{variant}-routing-negative.json' if family else 'validation/revI-routing-negative.json')
    out.write_text(json.dumps({'cases':cases,'isolated_copy':True},indent=2)+'\n')
    print('PASS: one mismatched duplicate pad and a disconnected row rejected'+(', and a moved added key' if family else '')
          +(', and a split GND' if number_row else ''))


if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__); ap.add_argument('--variant',default='flan36')
    test(ap.parse_args().variant)
