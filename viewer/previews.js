// SPDX-License-Identifier: GPL-3.0-or-later
import * as THREE from 'three';

// Reuse the main renderer. No extra WebGL contexts or animation loop.
// A ring, and a label when given, at each small part's final position.
function annotate(ctx,marks,camera,width,height,left){
  const r=height/26;
  for(const {at,label} of marks){
    const p=at.clone().project(camera),x=left+(p.x+1)*width/2,y=(1-p.y)*height/2;
    ctx.beginPath();ctx.arc(x,y,r,0,2*Math.PI);
    ctx.lineWidth=r*.5;ctx.strokeStyle='#182625';ctx.stroke();ctx.lineWidth=r*.24;ctx.strokeStyle='#ffcd70';ctx.stroke();
    if(!label)continue;
    ctx.font='650 '+Math.round(r*1.5)+'px system-ui,sans-serif';ctx.textAlign='center';ctx.lineJoin='round';
    ctx.lineWidth=r*.42;ctx.strokeStyle='#172623';ctx.strokeText(label,x,y-r*1.6);ctx.fillStyle='white';ctx.fillText(label,x,y-r*1.6);
  }
}

export function createPreviewRenderer(renderer, geometryFor) {
  const plainScene=new THREE.Scene();   // transparent: thumbnails sit on the page's own colour
  plainScene.add(new THREE.HemisphereLight('#ffffff','#8d9c88',2));
  for(const [p,intensity] of [[[-60,150,80],3],[[100,80,-60],.8]]){
    const light=new THREE.DirectionalLight('#fff',intensity);light.position.fromArray(p);plainScene.add(light);
  }
  const mat=new THREE.MeshStandardMaterial({color:'#7c927f',roughness:.86});
  const camera=new THREE.OrthographicCamera();
  // Pictures are drawn on the main canvas at one device pixel per pixel, between begin() and end(); the caller
  // then gives the canvas its size back and draws the model again.
  let pixelRatio=1;
  function build(entries){
    const group=new THREE.Group();
    for(const e of entries){const mesh=new THREE.Mesh(e.geometry||geometryFor(e.path),e.material||mat);mesh.rotation.y=THREE.MathUtils.degToRad(e.rotation||0);if(e.center){const box=mesh.geometry.boundingBox;mesh.position.copy(box.getCenter(new THREE.Vector3()).negate().applyEuler(mesh.rotation)).add(new THREE.Vector3(...e.center));}if(e.position)mesh.position.fromArray(e.position);group.add(mesh);}
    return group;
  }
  function frame(box,direction,aspect,up){
    const center=box.getCenter(new THREE.Vector3());
    camera.position.copy(center).add(new THREE.Vector3(...direction).normalize().multiplyScalar(300));camera.up.fromArray(up||[0,1,0]);camera.lookAt(center);camera.updateMatrixWorld();
    const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0),above=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1);
    let size=0;for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const v=new THREE.Vector3(x,y,z).sub(center);size=Math.max(size,Math.abs(v.dot(right))/aspect,Math.abs(v.dot(above)));}
    size*=1.08;camera.left=-size*aspect;camera.right=size*aspect;camera.top=size;camera.bottom=-size;camera.near=.1;camera.far=1000;camera.updateProjectionMatrix();
  }
  function image(entries,direction=[.2,2,1],options={}){
    const width=options.width||220,height=options.height||220;
    const scene=options.scene||plainScene;
    renderer.setSize(width,height,false);
    const group=build(entries);
    scene.add(group);frame(options.bounds||new THREE.Box3().setFromObject(group),direction,width/height,options.up);
    const tone=renderer.toneMapping;
    if(!options.scene)renderer.toneMapping=THREE.NoToneMapping;
    try{renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png');}
    finally{renderer.toneMapping=tone;scene.remove(group);}
  }
  // The same parts at successive positions, seen by one fixed camera and laid side by side in a strip.
  // Entries flagged `focus` set the framing; without any, every part does. `mark` rings a part where it ends up.
  // `still` draws the first position only; the others still count for the framing and the marks.
  function sequence(frames,direction,options={}){
    const width=options.width||680,height=options.height||528,last=frames.length-1,drawn=options.still?1:frames.length;
    if(renderer.getContext().isContextLost())throw Error('The 3D view is unavailable.');
    renderer.setSize(width,height,false);
    const groups=frames.map(build),box=new THREE.Box3(),focused=frames[0].some(e=>e.focus);
    for(const group of groups)group.children.forEach((mesh,i)=>{if(!focused||frames[0][i].focus)box.expandByObject(mesh);});
    box.expandByScalar(options.margin||0);
    frame(box,direction,width/height);
    const marks=frames[last].flatMap((e,i)=>e.mark?[{at:new THREE.Box3().setFromObject(groups[last].children[i]).getCenter(new THREE.Vector3()),label:typeof e.mark==='string'?e.mark:''}]:[]);
    const strip=document.createElement('canvas');strip.width=width*drawn;strip.height=height;
    const ctx=strip.getContext('2d'),tone=renderer.toneMapping;
    renderer.toneMapping=THREE.NoToneMapping;
    try{
      groups.slice(0,drawn).forEach((group,i)=>{
        plainScene.add(group);
        try{renderer.render(plainScene,camera);ctx.drawImage(renderer.domElement,0,0,width,height,i*width,0,width,height);}
        finally{plainScene.remove(group);}
        annotate(ctx,marks,camera,width,height,i*width);
      });
    }finally{renderer.toneMapping=tone;}
    const result=drawn>1?{strip:strip.toDataURL('image/webp',.9)}:{still:strip.toDataURL('image/webp',.9)};
    strip.width=0;   // releases the pixels at once
    return result;
  }
  return {image,sequence,begin(){pixelRatio=renderer.getPixelRatio();renderer.setPixelRatio(1);},end(){renderer.setPixelRatio(pixelRatio);}};
}
