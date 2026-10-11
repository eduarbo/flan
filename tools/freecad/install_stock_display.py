"""Adapt the saved revI assembly to the connector supplied with nice!view.

Preserve the routed PCB, battery, MCU, key layout and approved XY artwork.
Run with run_macos.py; output must be a separate candidate directory.
SPDX-License-Identifier: GPL-3.0-or-later
"""
import argparse, hashlib, json, os, sys, traceback
from pathlib import Path
import FreeCAD as A
import Part

def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def log(s): print(s, file=sys.__stdout__, flush=True)
def signature(obj):
    shape=obj.Shape;b=shape.optimalBoundingBox(False,False)
    return {'topology':[len(shape.Solids),len(shape.Faces),len(shape.Edges)],
            'centers':[tuple(s.CenterOfMass) for s in shape.Solids],
            'measures':[shape.Volume,shape.Area,
                        *[getattr(b,k) for k in ['XMin','YMin','ZMin','XMax','YMax','ZMax']],
                        *sorted(e.Length for e in shape.Edges)],
            'placement':list(obj.Placement.Base)+list(obj.Placement.Rotation.Q)}

def run():
    ap=argparse.ArgumentParser();ap.add_argument('--source',type=Path,required=True);ap.add_argument('--output',type=Path,required=True)
    ap.add_argument('--resume-checkpoint',action='store_true',help='Verify a saved UNVALIDATED checkpoint without repeating the migration')
    argv=sys.argv[1:]
    while argv and not argv[0].startswith('--'):argv.pop(0)
    args=ap.parse_args(argv);assert args.source.resolve()!=args.output.resolve()
    before=sha(args.source);doc=A.openDocument(str(args.source));doc.recompute()
    assert not doc.getObject('StockDisplayConnector')
    assert abs(float(doc.Parameters.DisplayBottom)-11.49)<1e-7
    assert abs(float(doc.Parameters.FrameTop)-13.59)<1e-7
    unchanged={o.Name:signature(o) for o in doc.Objects if hasattr(o,'PartID') and hasattr(o,'Shape') and any(o.PartID.endswith('-'+s) for s in ['pcb','mcu','battery','cradle','mcu-riser','mcu-sockets','jst','reset','slider','tray','hotswap-sockets','diodes'])}
    keyposes={o.Name:str(o.Placement) for o in doc.Objects if hasattr(o,'Mesh')}
    report={'schema':'flan36-stock-display-1','baseline_sha256':before,'installer_sha256':sha(__file__),
      'supplier':'https://typeractive.xyz/products/5-pin-sockets','connector':'Pair included with each nice!view',
      'socket_height_mm':5.0,'header_height_mm':2.0,'board_separation_mm':7.0,
      'display_bottom_mm':12.4,'glass_top_mm':14.3,'frame_top_mm':14.5,
      'physical_acceptance':False,'envelope_status':'Supplier heights; nominal XY and contact reserves, not measured production tolerances',
      'assembly_limits':{'display_tail_above_board_mm':.3,'display_solder_above_board_mm':.5,'socket_tail_below_main_pcb_mm':1.0}}
    if args.resume_checkpoint:
        checkpoint=json.loads((args.output.parent/'checkpoint.json').read_text())
        assert checkpoint['status']=='UNVALIDATED' and checkpoint['source_sha256']==sha(args.output)
        A.closeDocument(doc.Name);doc=A.openDocument(str(args.output))
        previous=json.loads(doc.StockDisplayConnector.RecipeJSON)
        for key,value in report.items():
            if key!='installer_sha256':assert previous[key]==value,(key,'checkpoint recipe mismatch')
        assert float(doc.Parameters.DisplayBottom)==12.4 and float(doc.Parameters.FrameTop)==14.5
        report['resumed_checkpoint']={'sha256':checkpoint['source_sha256'],'generation_installer_sha256':previous['installer_sha256']}
        doc.StockDisplayConnector.RecipeJSON=json.dumps(report,sort_keys=True)
        log('Verifying saved unvalidated checkpoint; no geometry migration repeated')
    else:
      for side,prefix in [('left','L_'),('right','R_')]:
        cx=122.8 if side=='left' else 37.2
        # Keep each existing placement and its R4 +/-0.20 X and moving Y datum.
        def replace(name,shape):
            obj=doc.getObject(prefix+name);placement=A.Placement(obj.Placement)
            obj.Shape=shape;obj.Placement=placement
            return obj
        housing=Part.makeBox(13.2,3,5,A.Vector(cx-6.6,-52.3,5.4))
        pins=[];male=[];joints=[];spacer=Part.makeBox(13.2,3,2,A.Vector(cx-6.6,-52.3,10.4))
        for i in range(5):
            x=cx-5.08+i*2.54
            housing=housing.cut(Part.makeCylinder(.43,3.31,A.Vector(x,-50.8,7.1)))
            pins.append(Part.makeCylinder(.3,4.3,A.Vector(x,-50.8,2.8)))
            male.append(Part.makeCylinder(.3,6.6,A.Vector(x,-50.8,7.1)))
            spacer=spacer.cut(Part.makeCylinder(.31,2.02,A.Vector(x,-50.8,10.39)))
            joints.append(Part.makeCylinder(.8,.5,A.Vector(x,-50.8,13.4)).cut(Part.makeCylinder(.3,.52,A.Vector(x,-50.8,13.39))))
        replace('SlimDisplaySocketHousing',housing);replace('SlimDisplaySocketPins',Part.makeCompound(pins))
        for name,shape in [('SlimDisplayMaleSpacer',spacer),('SlimDisplayMaleContacts',Part.makeCompound(male)),('LevelDisplaySolderReserve',Part.makeCompound(joints))]:
            obj=replace(name,shape);obj.setExpression('Placement.Base.z','Parameters.DisplayBottom - 12.4 mm')
        socket=doc.getObject(prefix+'SlimDisplaySocket');socket.Label='J2 · supplied nice!view socket · 5 mm'
        socket.ModelStatus='Supplied pair: documented 5 + 2 mm height; nominal XY/contact reserves'
        # Reserve 0.20 mm around the entire included connector body in the sled.
        relief=doc.getObject(prefix+'HeaderReliefTool');relief.Length=13.6;relief.Width=3.4
        relief.Placement.Base.x-=.2;relief.setExpression('Placement.Base.y','-50.1 mm - Parameters.DisplayShiftY')
        relief.setExpression('Height','Parameters.DisplayBottom - 5.1 mm')
      doc.Parameters.set(doc.Parameters.getCellFromAlias('DisplayBottom'),'12.4 mm')
      doc.Parameters.set(doc.Parameters.getCellFromAlias('FrameTop'),'14.5 mm')
      marker=doc.addObject('App::DocumentObjectGroup','StockDisplayConnector');marker.addProperty('App::PropertyString','RecipeJSON','Flan36');marker.RecipeJSON=json.dumps(report,sort_keys=True)
      log('Recomputing supplied-connector stack');doc.recompute()
      log('Geometry recomputed; saving unvalidated checkpoint')
      args.output.parent.mkdir(parents=True,exist_ok=True);doc.saveAs(str(args.output))
      (args.output.parent/'checkpoint.json').write_text(json.dumps({'status':'UNVALIDATED','source_sha256':sha(args.output)},indent=2)+'\n')
    log('Checking native signatures and unchanged placements')
    for name,old in unchanged.items():
        now=signature(doc.getObject(name))
        assert old['topology']==now['topology'],(name,'unrelated topology changed')
        remaining=list(now['centers'])
        for center in old['centers']:
            match=next((i for i,p in enumerate(remaining) if all(abs(a-b)<1e-6 for a,b in zip(center,p))),None)
            assert match is not None,(name,'unrelated solid center changed',center)
            remaining.pop(match)
        assert not remaining,(name,'solid center count changed')
        for field in ['measures','placement']:
            assert len(old[field])==len(now[field]) and all(abs(a-b)<1e-6 for a,b in zip(old[field],now[field])),(name,field,'unrelated geometry changed')
    report['unrelated_solid_comparison']='Native bounds, volume, area, center, topology, edge lengths and placement; 1e-6 tolerance. Independent saved geometry and unrelated export mesh checks required before adoption.'
    assert keyposes=={o.Name:str(o.Placement) for o in doc.Objects if hasattr(o,'Mesh')}
    report['unrelated_solids_preserved']=sorted(unchanged);report['key_mesh_placements_preserved']=len(keyposes)
    doc.recompute();doc.saveAs(str(args.output));A.closeDocument(doc.Name)
    log('Saved; reopening candidate');doc=A.openDocument(str(args.output));doc.recompute()
    assert float(doc.Parameters.DisplayBottom)==12.4 and float(doc.Parameters.FrameTop)==14.5
    report.update(source_sha256=sha(args.output),saved_reopened=True,source_unchanged=sha(args.source)==before)
    assert report['source_unchanged'];(args.output.parent/'installation.json').write_text(json.dumps(report,indent=2)+'\n')
    log('PASS supplied-connector migration and unchanged fixed assembly');A.closeDocument(doc.Name)

if __name__=='__main__':
    try: run()
    except Exception: traceback.print_exc(file=sys.__stderr__);sys.__stderr__.flush();os._exit(1)
    os._exit(0)
