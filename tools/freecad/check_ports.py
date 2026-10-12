"""Reopen native port refinement and check saved access/appearance.
Run: python3 tools/freecad/run_macos.py tools/freecad/check_ports.py
SPDX-License-Identifier: GPL-3.0-or-later
"""
import hashlib,json,os,sys,traceback
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import FreeCAD as A
import FreeCADGui as G
import Part
from refine_ports import validate, actuator_envelope, frame_material_assignment
from restore_stock_display_appearance import canonical
ROOT=Path(__file__).resolve().parents[2]

def main():
    G.showMainWindow();G.getMainWindow().hide()
    native=ROOT/'mechanical/revI/Flan36.FCStd';doc=A.openDocument(str(native))
    recipe=ROOT/'design/revI-ports.json'
    assert doc.PortRefinement.RecipeSHA256==hashlib.sha256(recipe.read_bytes()).hexdigest()
    access=validate(doc);approach={};appearance={};magnets=[]
    for side,prefix in [('left','L_'),('right','R_')]:
        for i in range(3):
            base=doc.getObject(prefix+'Magnet'+str(i));frame=doc.getObject(prefix+'SteelTarget'+str(i))
            assert abs(base.Radius.Value-1)<1e-8 and abs(base.Height.Value-3)<1e-8
            assert abs(frame.Radius.Value-1)<1e-8 and abs(frame.Height.Value-4)<1e-8
            gap=frame.Placement.Base.z-base.Placement.Base.z-base.Height.Value
            assert abs(gap-.9)<1e-8 and 'frame magnet' in frame.Label
            magnets.append({'side':side,'station':i,'base_mm':[2,3],'frame_mm':[2,4],'gap_mm':gap})
        sweep=actuator_envelope(doc,prefix).BoundBox
        x=sweep.XMax if side=='left' else 23
        end=137 if side=='left' else sweep.XMin
        # A finger/nail approach corridor reaches the tab from outside the wall.
        # Its .4 mm lateral reserve exceeds the swept tab in both directions.
        tool=Part.makeBox(end-x,sweep.YLength+.8,2.2,A.Vector(x,sweep.YMin-.4,5.1))
        nodes=[doc.getObject(prefix+'Frame_smooth_HeadRelief5')]
        nodes += [doc.getObject(prefix+'Case_'+style+'_'+group)
                  for style in ['solid','rim','terrace','level'] for group in ['base','plate']]
        hits={o.Name:o.Shape.common(tool).Volume for o in nodes}
        assert max(hits.values())<.001, hits
        approach[side]={'lateral_reserve_mm':.4,'height_mm':2.2,'collisions_mm3':hits}
        for style in ['talavera','gameboy','snes','phone','ipod','hanafuda']:
            obj=doc.getObject(prefix+'FlushFrame_'+style+'_Final')
            values=canonical(list(obj.ViewObject.ShapeAppearance))
            assert canonical(frame_material_assignment(obj))==values, (obj.Name,'saved materials mismatch')
            appearance[obj.Name]={'faces':len(obj.Shape.Faces),'assignments':len(values),'verified':True}
    report={'passed':True,'native_sha256':hashlib.sha256(native.read_bytes()).hexdigest(),
            'checker_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            'halves':access,'magnets':magnets,'magnet_count':12,'finger_nail_approach':approach,'native_frame_materials':appearance,
            'physical_acceptance':False,'method':'Reopen saved FreeCAD file without recompute; check actual solids, USB corridor, actuator sweep, approach path and owning-face color assignment.'}
    (ROOT/'validation/revI-ports-reopen.json').write_text(json.dumps(report,indent=2)+'\n')
    print('PASS: saved refined ports and frame appearance',file=sys.__stdout__,flush=True)
if __name__=='__main__':
    try:main()
    except Exception:
        traceback.print_exc(file=sys.__stderr__);sys.__stderr__.flush();os._exit(1)
    sys.__stdout__.flush();sys.__stderr__.flush();os._exit(0)
