#!/usr/bin/env python3
"""Render unaltered exported meshes before/after the native port refinement.
Run with the installed FreeCAD Python runtime (vtk). No mesh or image retouching.
SPDX-License-Identifier: GPL-3.0-or-later
"""
import hashlib,json,subprocess
from pathlib import Path
import vtk
ROOT=Path(__file__).resolve().parents[1]
BASE='b86574ae5366a4d0ee397d3c3683c709b899a67d'
WORK=ROOT/'build/port-refinement/render-before';WORK.mkdir(parents=True,exist_ok=True)
model=json.loads((ROOT/'design/revI.json').read_text())
parts=[('left-case-level-base.stl','#e6e5dc'),('left-case-level-plate.stl','#e6e5dc'),
       ('left-frame-talavera.stl','#e6e5dc'),('left-pcb.stl','#2d6d55')]
for key in ['left-mcu','left-slider','left-display']:
    part=model['parts'][key]
    parts += [(Path(v['path']).name,v['color']) for v in part['visuals']]
sources=[]
for name,color in parts:
    path='mechanical/revI/'+name
    before=subprocess.check_output(['git','show',BASE+':'+path],cwd=ROOT)
    (WORK/name).write_bytes(before)
    sources.append({'path':path,'before_sha256':hashlib.sha256(before).hexdigest(),
                    'after_sha256':hashlib.sha256((ROOT/path).read_bytes()).hexdigest()})
win=vtk.vtkRenderWindow();win.SetOffScreenRendering(1);win.SetSize(1600,1100);win.SetMultiSamples(0)
for row,kind in enumerate(['usb','power']):
    for col,phase in enumerate(['Before','After']):
        ren=vtk.vtkRenderer();ren.SetBackground(.96,.965,.97);ren.SetUseFXAA(True)
        ren.SetViewport(col*.5,(1-row)*.5,(col+1)*.5,(2-row)*.5);win.AddRenderer(ren)
        for name,color in parts:
            reader=vtk.vtkSTLReader();reader.SetFileName(str(WORK/name if phase=='Before' else ROOT/'mechanical/revI'/name));reader.Update()
            normals=vtk.vtkPolyDataNormals();normals.SetInputConnection(reader.GetOutputPort());normals.SetFeatureAngle(45);normals.ConsistencyOn();normals.AutoOrientNormalsOn();normals.Update()
            mapper=vtk.vtkPolyDataMapper();mapper.SetInputConnection(normals.GetOutputPort())
            actor=vtk.vtkActor();actor.SetMapper(mapper);prop=actor.GetProperty();prop.SetColor(*(int(color[i:i+2],16)/255 for i in [1,3,5]));prop.SetAmbient(.25);prop.SetDiffuse(.75);prop.SetSpecular(.1);prop.SetInterpolationToPhong();ren.AddActor(actor)
        camera=ren.GetActiveCamera();camera.ParallelProjectionOn();camera.SetViewUp(0,0,1)
        if kind=='usb':camera.SetPosition(130,30,16);camera.SetFocalPoint(122.8,-12.5,8.5);camera.SetParallelScale(8.5)
        else:camera.SetPosition(177,-44,13);camera.SetFocalPoint(133.5,-59.6,7.1);camera.SetParallelScale(6.5)
        ren.ResetCameraClippingRange()
        title=vtk.vtkTextActor();title.SetInput(('USB-C' if kind=='usb' else 'Power switch')+'  /  '+phase);title.GetPositionCoordinate().SetCoordinateSystemToNormalizedViewport();title.SetPosition(.033,.918);title.GetTextProperty().SetFontSize(24);title.GetTextProperty().SetColor(.12,.16,.22);title.GetTextProperty().SetBackgroundColor(.96,.965,.97);title.GetTextProperty().SetBackgroundOpacity(.96);ren.AddActor2D(title)
        text=vtk.vtkTextActor();text.SetInput('Same nominal components, camera and scale');text.GetPositionCoordinate().SetCoordinateSystemToNormalizedViewport();text.SetPosition(.033,.04);text.GetTextProperty().SetFontSize(16);text.GetTextProperty().SetColor(.35,.4,.46);text.GetTextProperty().SetBackgroundColor(.96,.965,.97);text.GetTextProperty().SetBackgroundOpacity(.96);ren.AddActor2D(text)
win.Render();capture=vtk.vtkWindowToImageFilter();capture.SetInput(win);capture.SetInputBufferTypeToRGB();capture.ReadFrontBufferOff();capture.Update()
out=ROOT/'docs/images/revI-port-refinement.png';writer=vtk.vtkPNGWriter();writer.SetFileName(str(out));writer.SetInputConnection(capture.GetOutputPort());writer.Write()
report={'baseline_commit':BASE,'sources':sources,'renderer_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'image_sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'physical_acceptance':False}
(ROOT/'validation/revI-port-render.json').write_text(json.dumps(report,indent=2)+'\n')
print('PASS: original before/after port meshes rendered at the same camera and scale')
