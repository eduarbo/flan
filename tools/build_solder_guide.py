"""Run with KiCad's Python to build the portable soldering guide from the eight current boards."""
# SPDX-License-Identifier: GPL-3.0-or-later
from pathlib import Path
import json
import pcbnew as pcb

ROOT = Path(__file__).resolve().parents[1]
def point(v):
    return [round(pcb.ToMM(v.x), 2), round(pcb.ToMM(v.y), 2)]

def diagram(path, keys):
    board = pcb.LoadBoard(str(path))
    edge = pcb.SHAPE_POLY_SET()
    board.GetBoardPolygonOutlines(edge, False)
    assert edge.OutlineCount() == 1
    outline = edge.Outline(0)
    perimeter = [point(outline.CPoint(i)) for i in range(outline.PointCount())]
    holes, parts, bodies = [], {}, {}
    for footprint in board.GetFootprints():
        ref = footprint.GetReference()
        if ref.startswith('H'):
            holes.append(point(footprint.GetPosition()))
            continue
        if ref in ('SW1','SW2','J1','J2','U1'):
            assert footprint.IsFlipped() == (ref == 'SW2')
        if ref == 'J1':
            rect, = [shape for shape in footprint.GraphicalItems() if shape.GetLayer() == pcb.F_Fab]
            box = rect.GetBoundingBox()
            bodies[ref] = [*point(box.GetOrigin()),*point(box.GetSize())]
        pads = []
        for pad in footprint.Pads():
            number = pad.GetNumber()
            if ref.startswith('K') and (not number or pad.GetAttribute() != pcb.PAD_ATTRIB_SMD):
                continue
            if not number and pad.GetAttribute() != pcb.PAD_ATTRIB_SMD:
                continue
            pads.append([*point(pad.GetPosition()),number])
            if ref.startswith('D'):
                assert pad.IsOnLayer(pcb.B_Cu) and not pad.IsOnLayer(pcb.F_Cu)
                assert pad.GetNetname().startswith('/ROW') if number == '1' else pad.GetNetname().endswith('_A')
            if ref.startswith('K'):
                assert pad.IsOnLayer(pcb.B_Cu) and not pad.IsOnLayer(pcb.F_Cu)
            if ref == 'J2':
                assert pad.GetNetname() == {'1':'/DISP_MOSI','2':'/DISP_SCK','3':'/VCC','4':'/GND','5':'/DISP_CS'}[number]
            if ref == 'J1':
                assert pad.GetNetname() == {'1':'/BAT_PLUS','2':'/GND'}[number]
        parts[ref] = pads
    refs = set(parts)
    assert len([r for r in refs if r.startswith('D')]) == keys // 2
    assert {r for r in refs if r.startswith('K')} == {'K'+r[1:] for r in refs if r.startswith('D')}
    assert refs - {r for r in refs if r[0] in 'DK'} == {'SW1','SW2','J1','J2','U1'}
    return dict(outline=perimeter, holes=holes, bodies=bodies, parts=dict(sorted(parts.items())))

def main():
    boards = {}
    for keys in (36,42,46,54):
        variant = f'flan{keys}'
        folder = 'revI' if keys == 36 else variant
        boards[variant] = {side: diagram(ROOT / 'hardware' / folder / f'{variant}-{side}.kicad_pcb', keys)
                           for side in ('left','right')}
    (ROOT/'design/solder-boards.json').write_text(json.dumps(boards,separators=(',',':'))+'\n')

if __name__ == '__main__':
    main()
