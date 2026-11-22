// A screen-space border leaves the selected filament and face details visible.
// SPDX-License-Identifier: GPL-3.0-or-later
import * as THREE from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';

export function selectionOutline(){
  const scene=new THREE.Scene(),pool=[];
  const white=new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false,side:THREE.DoubleSide});
  const size=new THREE.Vector2(),clearColor=new THREE.Color();
  const mask=new THREE.WebGLRenderTarget(1,1,{depthBuffer:false,generateMipmaps:false});
  const texel={value:new THREE.Vector2()};
  const edges=new FullScreenQuad(new THREE.ShaderMaterial({
    uniforms:{mask:{value:mask.texture},stepUV:texel},transparent:true,depthTest:false,depthWrite:false,
    vertexShader:'varying vec2 coord; void main(){coord=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`
      varying vec2 coord;
      uniform sampler2D mask;
      uniform vec2 stepUV;
      void main(){
        float center=texture2D(mask,coord).r,lo=center,hi=center;
        for(int i=0;i<8;i++){
          float a=float(i)*0.78539816;
          float sampleMask=texture2D(mask,coord+vec2(cos(a),sin(a))*stepUV).r;
          lo=min(lo,sampleMask);hi=max(hi,sampleMask);
        }
        // A light outer stroke and a dark inner stroke read on either a pale or a dark part.
        gl_FragColor=vec4(mix(vec3(1.),vec3(.055,.15,.24),center),hi-lo);
      }`
  }));
  function set(objects){
    scene.clear();
    for(let i=0;i<objects.length;i++){
      const source=objects[i],mesh=pool[i]??=new THREE.Mesh(source.geometry,white);
      source.updateWorldMatrix(true,false);
      mesh.geometry=source.geometry;mesh.matrixAutoUpdate=false;mesh.matrix.copy(source.matrixWorld);
      scene.add(mesh);
    }
  }
  function draw(renderer,camera){
    if(!scene.children.length)return;
    renderer.getDrawingBufferSize(size);
    mask.setSize(size.x,size.y);
    const radius=1.85*renderer.getPixelRatio();
    texel.value.set(radius/size.x,radius/size.y);
    const previous=renderer.getRenderTarget(),alpha=renderer.getClearAlpha(),autoClear=renderer.autoClear;
    renderer.getClearColor(clearColor);
    try{
      renderer.setRenderTarget(mask);renderer.setClearColor(0,0);
      renderer.autoClear=true;renderer.render(scene,camera);
      renderer.setRenderTarget(previous);renderer.autoClear=false;edges.render(renderer);
    }finally{
      renderer.setRenderTarget(previous);renderer.setClearColor(clearColor,alpha);renderer.autoClear=autoClear;
    }
  }
  return {set,draw};
}
