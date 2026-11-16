"""Headless SVG-as-geometry readback; never opens the keyboard or a GUI window.
SPDX-License-Identifier: GPL-3.0-or-later
"""
import hashlib,json,os,sys
from pathlib import Path
import FreeCAD as A
import Part
assert not A.GuiUp, 'This probe must not launch a GUI or interact with owner documents'
sys.path.insert(0,str(Path(A.getResourceDir())/'Mod/Draft'))
import importSVG

ROOT=Path(__file__).resolve().parents[2]
entries=[]
for suffix,width,faces,holes in [('black',30,7,4),('symbol-black',12,1,2),('wordmark-black',30,6,2)]:
    source=ROOT/f'design/branding/outline/flan36-outline-{suffix}.svg'
    doc=A.newDocument('OutlineProbe')
    importSVG.insert(str(source),doc.Name);doc.recompute()
    shapes=[o.Shape for o in doc.Objects if hasattr(o,'Shape') and not o.Shape.isNull()]
    assert shapes and all(s.isValid() for s in shapes)
    compound=Part.makeCompound(shapes)
    assert len(compound.Faces)==faces,(suffix,len(compound.Faces))
    actual_holes=sum(len(f.Wires)-1 for f in compound.Faces)
    assert actual_holes==holes,(suffix,actual_holes)
    assert abs(compound.BoundBox.XLength-width)<.1,(suffix,compound.BoundBox.XLength)
    # Trial extrusion only establishes that the imported faces form usable solids.
    solids=[f.extrude(A.Vector(0,0,.4)) for f in compound.Faces]
    assert all(s.isValid() and len(s.Solids)==1 and s.Volume>0 for s in solids)
    entries.append({'path':str(source.relative_to(ROOT)),'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
        'page_width_mm':width,'ink_width_mm':compound.BoundBox.XLength,'ink_height_mm':compound.BoundBox.YLength,
        'faces':faces,'holes':holes,'area_mm2':compound.Area,'valid_trial_extrusion_solids':len(solids)})
    A.closeDocument(doc.Name)
report={'freecad_version':A.Version()[:3],'headless':True,'imports':entries,'keyboard_geometry_changed':False,
        'scope':'Nominal SVG import and trial extrusion only; no logo placement, wall cut or manufacturing qualification.'}
(ROOT/'validation/branding-outline-freecad.json').write_text(json.dumps(report,indent=2)+'\n')
sys.__stdout__.write('PASS: headless FreeCAD imports, dimensions, counters and trial extrusions\n');sys.__stdout__.flush()
if os.environ.get('FILO_FREECAD_SUBPROCESS')=='1':os._exit(0)
