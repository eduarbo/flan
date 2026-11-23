"""Prepare registered KiCad photographs for the solder guide.

Run with the silkscreen Python environment after tools/build_silkscreen_textures.py.
The original R3 bare-board photographs can be reused with --r3-cache.
Only board copies in the temporary directory are stripped of models and ink.
"""
# SPDX-License-Identifier: GPL-3.0-or-later
import argparse
import io
import json
from pathlib import Path
import subprocess
import tempfile
import zipfile

from PIL import Image, ImageOps
from gerbonara import GerberFile

ROOT = Path(__file__).resolve().parents[1]
from build_silkscreen_textures import KICAD_PY
CLI = Path('/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli')
OUTPUT = ROOT / 'docs/explore/assets/solder'
OPTIONS = json.loads((ROOT/'design/pcb-options.json').read_text())
STRIP = """
import sys, pcbnew
b = pcbnew.LoadBoard(sys.argv[1])
layers = (pcbnew.F_SilkS, pcbnew.B_SilkS)
for fp in b.GetFootprints():
    fp.Models().clear()
    for item in list(fp.GraphicalItems()):
        if item.GetLayer() in layers: item.SetLayer(pcbnew.Dwgs_User)
    for field in fp.GetFields():
        if field.GetLayer() in layers: field.SetVisible(False)
for item in list(b.GetDrawings()):
    if item.GetLayer() in layers: item.SetLayer(pcbnew.Dwgs_User)
pcbnew.SaveBoard(sys.argv[2],b)
"""

def registered_image(source):
    image = Image.open(source).convert('RGBA')
    # KiCad high-quality PNGs have a translucent floor shadow beyond the board.
    # The solid outer mask corresponds to the Edge.Cuts bounds in the Gerbers.
    bounds = image.getchannel('A').point(lambda a: 255 if a >= 128 else 0).getbbox()
    return image.crop(bounds)

def render(source, dest, face, tmp):
    bare = tmp / (source.stem+'-bare.kicad_pcb')
    if not bare.exists():
        subprocess.run([KICAD_PY,'-c',STRIP,source,bare],check=True)
    png = tmp / (source.stem+'-'+face+'.png')
    subprocess.run([CLI,'pcb','render','--side',face,'-w','1500','-h','1220','--quality','high',
                    '--background','transparent','-o',png,bare],check=True,capture_output=True)
    registered_image(png).save(dest, quality=94,method=4)

def front_ink(package, bounds, target):
    with zipfile.ZipFile(package) as z:
        name = next(n for n in z.namelist() if n.endswith('F_Silkscreen.gto'))
        gerber = GerberFile.from_string(z.read(name).decode())
    x0,y0,x1,y1 = bounds
    svg = str(gerber.to_svg(force_bounds=((x0,-y1),(x1,-y0)),fg='white',bg='black'))
    result = subprocess.run(['rsvg-convert','-w',str(round((x1-x0)*10)),'-h',str(round((y1-y0)*10))],
                            input=svg.encode(),capture_output=True,check=True)
    Image.open(io.BytesIO(result.stdout)).convert('L').save(target,lossless=True)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--r3-cache',type=Path)
    args=parser.parse_args()
    OUTPUT.mkdir(parents=True,exist_ok=True)
    textures=ROOT/'build/silkscreen-textures'
    catalog=json.loads((textures/'manifest.json').read_text())
    with tempfile.TemporaryDirectory() as folder:
        tmp=Path(folder)
        for size in ('flan36','flan42','flan46','flan54'):
            is36=size=='flan36'
            info=catalog if is36 else catalog['variants'][size]
            packages=OPTIONS['editions'][0]['packages'] if is36 else OPTIONS['editions'][0]['variants'][size]
            for side in ('left','right'):
                key=size+'-'+side
                source=ROOT/'hardware'/('revI' if is36 else size)/(key+'.kicad_pcb')
                for face in ('top','bottom'):
                    render(source,OUTPUT/(key+'-'+face+'.webp'),face,tmp)
                front_ink(ROOT/packages[side], info['bounds'][side], OUTPUT/(key+'-top-ink.webp'))
                for edition in OPTIONS['editions']:
                    eid=edition['id']
                    src=(textures if is36 else textures/size)/(eid+'-'+side+'.png')
                    ImageOps.mirror(Image.open(src).convert('L')).save(OUTPUT/(key+'-'+eid+'-ink.webp'),lossless=True)
                    if is36 and eid!='base' and args.r3_cache:
                        src=args.r3_cache/(eid+'-'+side+'-3d.png')
                        registered_image(src).save(OUTPUT/(key+'-'+eid+'-photo.webp'),quality=94,method=4)
                print(key,flush=True)

if __name__=='__main__':
    main()
