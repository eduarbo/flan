"""Render the two transparent layers of the catalog reel with Blender in background mode.

blender -b --python-exit-code 1 -P tools/render_filament_reel.py  (requires cwebp)
The winding mask takes the catalog color. The overlay supplies the flanges, light
and shadows. Both files are shared by every color and embedded in the offline guide.
"""
# SPDX-License-Identifier: GPL-3.0-or-later
from math import cos, sin, pi, radians
from pathlib import Path
from subprocess import run
from tempfile import NamedTemporaryFile
import bpy
import numpy as np
from mathutils import Vector

out = Path(__file__).resolve().parents[1] / 'viewer' / 'thumbs'
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.cycles.seed = 12
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 3
scene.render.film_transparent = True
scene.render.resolution_x = scene.render.resolution_y = 160
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = 'Standard'
scene.world = bpy.data.worlds.new('Studio')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.65, .65, .65, 1)

def material(name, color):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = .54
    return mat

frame = material('Graphite flanges', (.17, .18, .19))
filament = material('Wound filament', (1, 1, 1))

def circle(radius, reverse=False):
    sign = -1 if reverse else 1
    return [(radius*cos(sign*t*2*pi/120), radius*sin(sign*t*2*pi/120)) for t in range(120)]

def solid(name, paths, z, thickness, bevel, mat):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '2D'
    curve.fill_mode = 'BOTH'
    curve.extrude = thickness/2
    curve.bevel_depth = bevel
    curve.bevel_resolution = 3
    for path in paths:
        loop = curve.splines.new('POLY')
        loop.points.add(len(path)-1)
        for point, (x,y) in zip(loop.points, path):
            point.co = (x,y,0,1)
        loop.use_cyclic_u = True
    obj = bpy.data.objects.new(name, curve)
    scene.collection.objects.link(obj)
    obj.location.z = z
    curve.materials.append(mat)

holes = [circle(1), circle(.205, True)]
for i in range(5):
    angle = i*2*pi/5
    # Rounded arc windows leave a solid hub and five spokes.
    path = []
    for j in range(64):
        t = j*2*pi/64
        theta = angle + .465*cos(t)
        radius = .608 + .252*sin(t)
        path.append((radius*cos(theta),radius*sin(theta)))
    holes.append(path)
for z in (-.445,.445):
    solid('Flange', holes, z, .044, .012, frame)
solid('Hub', [circle(.312),circle(.205,True)], 0, .862, .004, frame)
solid('Winding', [circle(.887),circle(.225,True)], 0, .823, .004, filament)
for i in range(23):
    bpy.ops.mesh.primitive_torus_add(major_segments=112,minor_segments=10,location=(0,0,-.39+i*.0355),major_radius=.884,minor_radius=.016)
    ring=bpy.context.object
    ring.data.materials.append(filament)
    for face in ring.data.polygons:
        face.use_smooth=True
for i in range(10):
    bpy.ops.mesh.primitive_torus_add(major_segments=112,minor_segments=8,location=(0,0,.408),major_radius=.30+i*.060,minor_radius=.008)
    bpy.context.object.data.materials.append(filament)

def point(obj, target=(0,0,0)):
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()

for xyz, energy, size in [((-3,-4,6),235,5),((3,2,4),155,4)]:
    light=bpy.data.lights.new('Softbox','AREA')
    light.energy,light.shape,light.size=energy,'DISK',size
    obj=bpy.data.objects.new('Softbox',light)
    scene.collection.objects.link(obj)
    obj.location=xyz
    point(obj)

cam=bpy.data.cameras.new('Reel camera')
obj=bpy.data.objects.new('Reel camera',cam)
scene.collection.objects.link(obj)
obj.location=(4,-6,4.4)
point(obj)
obj.rotation_euler.rotate_axis('Z',radians(-20))
cam.type='ORTHO'
cam.ortho_scale=2.40
scene.camera=obj

def render(value, roughness):
    shader=filament.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value=(value,value,value,1)
    shader.inputs['Roughness'].default_value=roughness
    with NamedTemporaryFile(suffix='.png') as tmp:
        scene.render.filepath=tmp.name
        bpy.ops.render.render(write_still=True)
        img=bpy.data.images.load(tmp.name,check_existing=False)
        img.colorspace_settings.name='Non-Color'
        data=np.empty(len(img.pixels),dtype='float32')
        img.pixels.foreach_get(data)
        bpy.data.images.remove(img)
    return data.reshape((160,160,4))

def save(name, pixels):
    image=bpy.data.images.new(name,160,len(pixels),alpha=True)
    image.colorspace_settings.name='Non-Color'
    image.pixels.foreach_set(np.clip(pixels,0,1).ravel())
    with NamedTemporaryFile(suffix='.png') as tmp:
        image.filepath_raw = tmp.name
        image.file_format = 'PNG'
        image.save()
        options = ['-lossless'] if 'mask' in name else ['-q','90','-alpha_q','100']
        run(['cwebp','-quiet',*options,tmp.name,'-o',str(out / name)],check=True)

def layers(roughness):
    black, white = render(0,roughness), render(1,roughness)
    alpha = black[:,:,3:4]
    weight = alpha*np.clip((white[:,:,:3]-black[:,:,:3]).mean(axis=2,keepdims=True),0,1)
    overlay = alpha-weight
    mask = weight/np.maximum(1-overlay,.00001)
    return (np.concatenate([np.ones_like(black[:,:,:3]),mask],axis=2),
            np.concatenate([alpha*black[:,:,:3]/np.maximum(overlay,.00001),overlay],axis=2))

# Blender pixel arrays start at the bottom; the Basic reel is the top frame in CSS.
matte_mask, matte_light = layers(.82)
basic_mask, basic_light = layers(.30)
save('filament-reel-mask.webp',np.concatenate([matte_mask,basic_mask]))
save('filament-reel-light.webp',np.concatenate([matte_light,basic_light]))
