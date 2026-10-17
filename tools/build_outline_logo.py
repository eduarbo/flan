#!/usr/bin/env python3
"""Trace the selected mono reference once; derive font-free SVGs from the master.

Default mode preserves the editable master. --trace replaces it from the pinned
reference and should only be used intentionally. No case/PCB geometry is changed.
SPDX-License-Identifier: GPL-3.0-or-later
"""
from pathlib import Path
from collections import defaultdict
import argparse, hashlib, json, re, zipfile
import xml.etree.ElementTree as ET
import numpy as np
from PIL import Image
from shapely.geometry import Polygon
from fontTools.misc.bezierTools import calcCubicBounds

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/branding/outline'
MASTER = OUT / 'flan36-outline-master.svg'
REFERENCE = ROOT / 'docs/images/branding/flan36-caramel-outline.png'
REFERENCE_SHA = '5f128bcd8a3cd5054c11abf70743a63fd32c7d7cc3a3d417e3cb923cce280395'
SVG = 'http://www.w3.org/2000/svg'
ET.register_namespace('', SVG)
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def fmt(v): return f'{float(v):.4f}'.rstrip('0').rstrip('.') or '0'
def pt(p): return ' '.join(map(fmt, p))

def contours(mask):
    """Oriented pixel-edge contours: outer rings and holes retain opposite winding."""
    edges = defaultdict(list)
    h, w = mask.shape
    for y, x in zip(*np.nonzero(mask)):
        if y == 0 or not mask[y-1,x]: edges[(x,y)].append((x+1,y))
        if x == w-1 or not mask[y,x+1]: edges[(x+1,y)].append((x+1,y+1))
        if y == h-1 or not mask[y+1,x]: edges[(x+1,y+1)].append((x,y+1))
        if x == 0 or not mask[y,x-1]: edges[(x,y+1)].append((x,y))
    rings = []
    while edges:
        start = min(edges); current = start; ring = []
        while True:
            ring.append(current)
            choices = edges[current]
            assert len(choices) == 1, 'Ambiguous diagonal pixel junction'
            following = choices.pop()
            if not choices: del edges[current]
            current = following
            if current == start: break
        polygon = Polygon(ring)
        assert polygon.is_valid
        if polygon.area > 8: rings.append(np.array(ring, dtype=float))
    return rings

def unit(v):
    return v / max(np.linalg.norm(v),1e-12)

def fit_cubics(points, tangent_start, tangent_end, tolerance=.65):
    """Adaptive least-squares cubic fitting with chord-length parameterization."""
    a,z=points[0],points[-1]
    if len(points)==2:
        third=np.linalg.norm(z-a)/3
        return [(a,a+tangent_start*third,z+tangent_end*third,z)]
    distances=np.r_[0,np.cumsum(np.linalg.norm(np.diff(points,axis=0),axis=1))]
    t=distances/distances[-1];u=1-t
    b=np.stack([u**3,3*u*u*t,3*u*t*t,t**3],axis=1)
    basis=np.stack([b[:,1,None]*tangent_start,b[:,2,None]*tangent_end],axis=2)
    residual=points-b[:,0,None]*a-b[:,1,None]*a-b[:,2,None]*z-b[:,3,None]*z
    alpha=np.linalg.lstsq(basis.reshape(-1,2),residual.reshape(-1),rcond=None)[0]
    chord=np.linalg.norm(z-a)
    if min(alpha)<chord*1e-6 or max(alpha)>chord*3:alpha=np.array([chord/3,chord/3])
    c1=a+alpha[0]*tangent_start;c2=z+alpha[1]*tangent_end
    estimate=b@np.array([a,c1,c2,z]);errors=np.linalg.norm(estimate-points,axis=1)
    split=int(np.argmax(errors))
    if errors[split]<=tolerance:return [(a,c1,c2,z)]
    split=max(1,min(len(points)-2,split));middle=unit(points[split-1]-points[split+1])
    return fit_cubics(points[:split+1],tangent_start,middle,tolerance)+fit_cubics(points[split:],-middle,tangent_end,tolerance)

def smooth_path(ring):
    # Remove one-pixel stair steps, then retain subpixel contour accuracy.
    smoothed = sum(np.roll(ring, i, axis=0)*weight for i,weight in
                   [(-3,1),(-2,3),(-1,6),(0,8),(1,6),(2,3),(3,1)]) / 28
    middle=len(smoothed)//2
    tangent0=unit(smoothed[3]-smoothed[-3])
    tangent_mid=unit(smoothed[middle+3]-smoothed[middle-3])
    curves=fit_cubics(smoothed[:middle+1],tangent0,-tangent_mid)+fit_cubics(np.vstack([smoothed[middle:],smoothed[:1]]),tangent_mid,-tangent0)
    d = 'M '+pt(smoothed[0])+' '+ ' '.join('C '+pt(c1)+' '+pt(c2)+' '+pt(q) for p,c1,c2,q in curves)+' Z'
    sampled = np.array([((1-t)**3*p+3*(1-t)**2*t*c1+3*(1-t)*t*t*c2+t**3*q)
                        for p,c1,c2,q in curves for t in np.linspace(0,1,64,endpoint=False)])
    polygon = Polygon(sampled)
    assert polygon.is_valid, 'Smoothing introduced an invalid ring'
    error = polygon.boundary.hausdorff_distance(Polygon(ring).boundary)
    assert error < 1.25, f'Contour shifted {error} pixels'
    bounds = np.array([calcCubicBounds(*map(tuple,c)) for c in curves])
    bbox = [bounds[:,0].min(),bounds[:,1].min(),bounds[:,2].max(),bounds[:,3].max()]
    return {'d':d, 'polygon':polygon, 'bbox':bbox, 'max_deviation_px':error, 'nodes':len(curves)}

def svg_root(bounds, width_mm, title):
    x,y,X,Y = bounds
    root=ET.Element(f'{{{SVG}}}svg', {'version':'1.1','width':fmt(width_mm)+'mm',
        'height':fmt(width_mm*(Y-y)/(X-x))+'mm','viewBox':' '.join(map(fmt,[x,y,X-x,Y-y]))})
    ET.SubElement(root,f'{{{SVG}}}title').text=title
    ET.SubElement(root,f'{{{SVG}}}desc').text='Flan36 Outline. Closed filled Bezier paths; no fonts or raster images. SVG page dimensions are in millimetres.'
    return root

def write_svg(path, root):
    ET.indent(root, space='  ')
    ET.ElementTree(root).write(path,encoding='utf-8',xml_declaration=True)

def trace():
    assert sha(REFERENCE)==REFERENCE_SHA
    # Selected board, bottom-left mono lockup, excluding labels/background panel.
    image=np.array(Image.open(REFERENCE).convert('RGB'))[800:1145,175:610]
    mask=image.mean(axis=2)<100
    rings=[smooth_path(r) for r in contours(mask)]
    parents={i:[j for j,b in enumerate(rings) if i!=j and b['polygon'].contains(a['polygon'])]
             for i,a in enumerate(rings)}
    outer=[i for i,p in parents.items() if not p]
    assert len(outer)==7, 'Expect one symbol and six independent glyphs'
    symbol=min(outer,key=lambda i:rings[i]['bbox'][1])
    glyphs=sorted((i for i in outer if i!=symbol),key=lambda i:rings[i]['bbox'][0])
    order=[symbol,*glyphs]; names=['flan-symbol','glyph-f','glyph-l','glyph-a','glyph-n','glyph-3','glyph-6']
    expected_holes=[2,0,0,1,0,0,1]
    b=np.array([v['bbox'] for v in rings]);bounds=[b[:,0].min()-.5,b[:,1].min()-.5,b[:,2].max()+.5,b[:,3].max()+.5]
    root=svg_root(bounds,30,'Flan36 Outline — editable master')
    for index,name,count in zip(order,names,expected_holes):
        holes=sorted([i for i,p in parents.items() if p==[index]],key=lambda i:rings[i]['bbox'][1])
        assert len(holes)==count,(name,holes)
        ET.SubElement(root,f'{{{SVG}}}path',{'id':name,'fill':'#171717','fill-rule':'evenodd',
            'd':' '.join(rings[i]['d'] for i in [index,*holes])})
    write_svg(MASTER,root)
    receipt={'reference':'docs/images/branding/flan36-caramel-outline.png','reference_sha256':REFERENCE_SHA,
        'reference_region_xyxy':[175,800,610,1145],'threshold_mean_rgb':100,
        'method':'Pixel boundaries, weighted subpixel smoothing and adaptive least-squares cubic fitting',
        'components':7,'holes':4,'closed_rings':len(rings),'cubic_nodes':sum(r['nodes'] for r in rings),
        'maximum_boundary_deviation_reference_pixels':max(r['max_deviation_px'] for r in rings),
        'master_sha256':sha(MASTER),'font_dependency':False}
    (ROOT/'validation/branding-outline-trace.json').write_text(json.dumps(receipt,indent=2)+'\n')

def path_bounds(d):
    tokens=re.findall(r'[MCZ]|-?\d*\.?\d+(?:e[-+]?\d+)?',d)
    i=0; bounds=[]
    while i<len(tokens):
        op=tokens[i];i+=1
        if op=='M': p=tuple(map(float,tokens[i:i+2]));i+=2; bounds.append((*p,*p))
        elif op=='C':
            coords=list(map(float,tokens[i:i+6]));i+=6;c1=tuple(coords[:2]);c2=tuple(coords[2:4]);q=tuple(coords[4:]);bounds.append(calcCubicBounds(p,c1,c2,q));p=q
        elif op!='Z': raise ValueError('Only explicit M/C/Z commands are supported in the editable master')
    a=np.array(bounds)
    return [a[:,0].min(),a[:,1].min(),a[:,2].max(),a[:,3].max()]

def export(paths,name,width,color=False,white=False):
    b=np.array([path_bounds(p['d']) for p in paths]);bounds=[b[:,0].min()-.5,b[:,1].min()-.5,b[:,2].max()+.5,b[:,3].max()+.5]
    root=svg_root(bounds,width,'Flan36 Outline — '+name)
    if color and paths[0]['id']=='flan-symbol':
        subpaths=re.findall(r'M[^M]+',paths[0]['d']);assert len(subpaths)==3
        for role,d,fill in zip(['caramel-fill','custard-fill'],subpaths[1:],['#B46A35','#F8D58A']):
            ET.SubElement(root,f'{{{SVG}}}path',{'id':role,'d':d.strip(),'fill':fill,'fill-rule':'evenodd'})
    for original in paths:
        attrs=dict(original);attrs['fill']='#FFFFFF' if white else ('#A95E2C' if color else '#171717')
        ET.SubElement(root,f'{{{SVG}}}path',attrs)
    path=OUT/('flan36-outline-'+name+'.svg');write_svg(path,root)
    return {'path':str(path.relative_to(ROOT)),'sha256':sha(path),'page_width_mm':width,
            'page_height_mm':float(root.attrib['height'][:-2]),'path_count':len(root.findall(f'{{{SVG}}}path'))}

def derive():
    root=ET.parse(MASTER).getroot();paths=[dict(p.attrib) for p in root.findall(f'{{{SVG}}}path')]
    assert [p['id'] for p in paths]==['flan-symbol','glyph-f','glyph-l','glyph-a','glyph-n','glyph-3','glyph-6']
    assert all(p['d'].strip().endswith('Z') and p['fill-rule']=='evenodd' for p in paths)
    exports=[]
    exports.append(export(paths,'black',30))
    exports.append(export(paths[:1],'symbol-black',12))
    exports.append(export(paths[1:],'wordmark-black',30))
    report={'master':'docs/branding/outline/flan36-outline-master.svg','master_sha256':sha(MASTER),
        'exports':exports,'units':'mm','shared_contours':True,'font_dependency':False,
        'raster_embedded':False,'manufacturing_qualified':False,
        'scope':'Editable vector artwork only. No placement or relief cut in the keyboard CAD or PCB.'}
    (ROOT/'design/branding-outline-vectors.json').write_text(json.dumps(report,indent=2)+'\n')

def preview():
    root=ET.Element(f'{{{SVG}}}svg',{'width':'800','height':'640','viewBox':'0 0 800 640'})
    ET.SubElement(root,f'{{{SVG}}}rect',{'width':'800','height':'640','fill':'#F7F4EB'})
    art=ET.parse(OUT/'flan36-outline-black.svg').getroot()
    art.attrib.update({'x':'140','y':'80','width':'520','height':'480','preserveAspectRatio':'xMidYMid meet'})
    root.append(art)
    write_svg(OUT/'preview.svg',root)

def package():
    paths=[MASTER,*[OUT/f'flan36-outline-{name}.svg' for name in ['black','symbol-black','wordmark-black']]]+[OUT/'preview.svg',OUT/'README.md']
    assert all(p.exists() for p in paths),'The kit requires its integration README'
    manifest={'master':'flan36-outline-master.svg','units':'mm','files':[{ 'path':p.name,'sha256':sha(p)} for p in paths],
        'manufacturing_qualified':False,'repository':'https://github.com/eduarbo/flan',
        'note':'SVG art and import guide. No placed PCB logo, case cut, toolpath or G-code.'}
    with zipfile.ZipFile(OUT/'flan36-outline-svg-kit.zip','w',zipfile.ZIP_DEFLATED) as z:
        for name,data in [(p.name,p.read_bytes()) for p in paths]+[('LICENSE.txt',(ROOT/'LICENSE').read_bytes()),('manifest.json',(json.dumps(manifest,indent=2)+'\n').encode())]:
            info=zipfile.ZipInfo(name,date_time=(2026,9,22,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o644<<16
            z.writestr(info,data)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--trace',action='store_true');parser.add_argument('--png',action='store_true');parser.add_argument('--package',action='store_true');args=parser.parse_args()
    OUT.mkdir(parents=True,exist_ok=True)
    if args.trace:trace()
    assert MASTER.exists(),'Run with --trace once to create the editable master'
    derive()
    preview()
    if args.png:
        import cairosvg
        cairosvg.svg2png(url=str(OUT/'preview.svg'),write_to=str(ROOT/'docs/images/branding/flan36-outline-vector-preview.png'),output_width=2400)
    if args.package:package()
    print('Wrote one editable master and three same-logo SVG exports; PCB and case geometry unchanged.')
