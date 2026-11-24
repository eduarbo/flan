// SPDX-License-Identifier: GPL-3.0-or-later
// Bake workbench images from the same registered meshes, materials and preview lights as the explorer.
import * as THREE from 'three';
import {createPreviewRenderer} from './previews.js';
import {createPartIllustrations} from './part-illustrations.js';
import boards from '../design/solder-boards.json';

export async function render({parts,shapes}){
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
 renderer.setClearColor(0,0);renderer.localClippingEnabled=true;
 const cache=new Map();
 function geometryFor(id){
  if(cache.has(id))return cache.get(id);
  const source=shapes[id],geo=new THREE.BufferGeometry();
  const bytes=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0)).buffer;
  for(const [key,field] of [['position','positions'],['normal','normals']])geo.setAttribute(key,new THREE.BufferAttribute(new Float32Array(bytes(source[field])),3));
  geo.setIndex(new THREE.BufferAttribute(new Uint32Array(bytes(source.indices)),1));
  for(const group of source.groups||[])geo.addGroup(group.start,group.count,group.materialIndex);
  geo.computeBoundingBox();cache.set(id,geo);return geo;
 }
 const material=color=>new THREE.MeshStandardMaterial({color,roughness:.8});
 const preview=createPreviewRenderer(renderer,geometryFor);
 const original=createPartIllustrations({preview,parts,material});
 const images={},shots={};
 async function bitmap(src){const img=new Image();img.src=src;await img.decode();return img;}
 for(const id of ['diode','socket','switch','reset','power','jack','301230','adafruit-1570','strip','pins','nano','cable','tape','feet','m6','m4','m6-common','m4-common']){
  const img=await bitmap(original[id]),canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;
  canvas.getContext('2d').drawImage(img,0,0);images[id]=canvas.toDataURL('image/webp',.92);
 }
 function primitive(g,color,position){return {geometry:g,material:material(color),position};}
 const box=(x,y,z,c,p)=>primitive(new THREE.BoxGeometry(x,y,z),c,p);
 const cyl=(r,h,c,p)=>primitive(new THREE.CylinderGeometry(r,r,h,24),c,p);
 const metal='#aab4bd',coal='#293538',brass='#b8934a';
 const card=(id,entries,dir)=>{preview.image(entries,dir,{width:300,height:195});images[id]=renderer.domElement.toDataURL('image/webp',.94);};
 const toolArm=angle=>new THREE.BoxGeometry(1.2,1.5,29).rotateY(angle);
 card('tweezers',[primitive(toolArm(.10),metal,[-1.45,0,0]),primitive(toolArm(-.10),metal,[1.45,0,0])]);
 card('meter',[box(11,3,17,'#ddad3a',[0,0,0]),box(8,.2,4,'#cbd7ce',[0,1.6,-4]),cyl(2,1,coal,[0,1.7,2]),
  ...[-1,1].flatMap(k=>[box(1,1,9,k===1?'#ac392e':coal,[k*8,0,1]),box(.4,.4,4,metal,[k*8,0,-5])])]);
 card('loupe',[primitive(new THREE.TorusGeometry(5,.8,12,40).rotateX(Math.PI/2),coal,[0,0,0]),box(1.6,1,8,coal,[0,0,9])]);
 card('iron',[cyl(1.8,11,'#347581',[0,5,0]),cyl(.75,8,metal,[0,-4.5,0]),primitive(new THREE.ConeGeometry(.75,3,20).rotateZ(Math.PI),metal,[0,-10,0])],[.3,.5,1]);
 card('solder',[...Array.from({length:6},(_,i)=>primitive(new THREE.TorusGeometry(4,.45,10,32).rotateX(Math.PI/2),metal,[0,i*.65,0])),cyl(4.9,.6,coal,[0,-.4,0]),cyl(4.9,.6,coal,[0,3.8,0])]);
 card('plug',[box(5,2.8,4.6,'#e7e3d3',[0,0,0]),box(3.5,.8,2,'#dedbcc',[0,1.5,.4]),...[-1,1].map(k=>box(.7,.7,7,k===1?'#b64b41':coal,[k,0,5]))]);
 card('driver',[cyl(1.5,9,'#5c625e',[0,4,0]),primitive(new THREE.CylinderGeometry(.6,.6,8,6),metal,[0,-4,0])],[.6,.6,1]);
 function model(p,groups){
  const src=geometryFor(p.geometry);
  let geo=src;
  if(groups){geo=src.clone();geo.clearGroups();for(const g of src.groups)if(groups.includes(g.materialIndex))geo.addGroup(g.start,g.count,g.materialIndex);}
  return {geometry:geo,material:p.materials?p.materials.map(material):material(p.color),position:[...p.position],rotation:p.angle_deg};
 }
 const width=440,height=264,frames=11;
 for(const side of ['left','right']){
  const get=id=>parts.find(p=>p.part_id===side+'-'+id);
  const display=get('display'),module=model(display,[0,1,2,3]),header=model(display,[4,5]);
  const sockets=model(get('display-socket')),support=model(get('mcu-riser')),sled=model(get('display-sled'));
  support.material=material('#b98a5b');sled.material=material('#b98a5b');
  if(side==='left'){
   for(const [id,mesh] of Object.entries({view:module,header,'view-socket':sockets,riser:support,sled,locator:model(get('cradle')),cage:model(get('battery-retainer')),spacer:model(get('washer-1'))}))card(id,[mesh],id==='header'?[1,.4,1]:undefined);
  }
  const boardOrigin=get('pcb').position;
  const pads=boards.flan36[side].parts.U1.map(([x,z])=>[x+boardOrigin[0],z+boardOrigin[2]]);
  const xCenter=(Math.min(...pads.map(p=>p[0]))+Math.max(...pads.map(p=>p[0])))/2;
  const zCenter=31.5;
  // The local cutaway retains the actual routed PCB and its drilled U1/J2 pads.
  const pcb=model(get('pcb'));pcb.material=material('#547769');
  pcb.material.clippingPlanes=[new THREE.Plane(new THREE.Vector3(1,0,0),-(xCenter-11)),
   new THREE.Plane(new THREE.Vector3(-1,0,0),xCenter+11),new THREE.Plane(new THREE.Vector3(0,0,1),-(zCenter-21)),
   new THREE.Plane(new THREE.Vector3(0,0,-1),zCenter+23)];
  const rows=model(get('mcu-sockets'));
  const contacts=pads.flatMap(([x,z])=>[primitive(new THREE.TorusGeometry(.50,.12,8,18).rotateX(Math.PI/2),brass,[x,7.84,z]),cyl(.23,2.8,metal,[x,4.5,z])]);
  const pins=pads.map(([x,z])=>cyl(.254,6.35,metal,[x,6.65,z]));
  const stacks={U1:[[pcb,0],[support,3],[rows,5],...contacts.map(e=>[e,5]),[model(get('mcu')),13],...pins.map(e=>[e,21])],
   J2:[[pcb,0],[sled,3],[sockets,4],[header,11],[module,19]]};
  const keyParts=parts.filter(p=>p.side===side&&p.name.endsWith(' K01'));
  const socket=keyParts.find(p=>p.name.includes('Hot-swap')),keyBoard=model(get('pcb')),kx=socket.position[0],kz=socket.position[2];
  keyBoard.material=material('#547769');
  keyBoard.material.clippingPlanes=[new THREE.Plane(new THREE.Vector3(1,0,0),9-kx),new THREE.Plane(new THREE.Vector3(-1,0,0),kx+11),
   new THREE.Plane(new THREE.Vector3(0,0,1),10-kz),new THREE.Plane(new THREE.Vector3(0,0,-1),kz+10)];
  stacks.K=[[keyBoard,0],[model(socket),-6],...keyParts.filter(p=>p.group==='switches').map(p=>[model(p),8])];
  for(const [id,stack] of Object.entries(stacks)){
   const crop=340,canvas=document.createElement('canvas');canvas.width=crop*frames;canvas.height=height;const ctx=canvas.getContext('2d');
   const frameBox=id==='K'?new THREE.Box3(new THREE.Vector3(kx-9,-4,kz-10),new THREE.Vector3(kx+11,19,kz+10)):new THREE.Box3(new THREE.Vector3(xCenter-11,2,zCenter-21),new THREE.Vector3(xCenter+11,32,zCenter+23));
   for(let frame=0;frame<frames;frame++){
    const remaining=(start,end)=>1-Math.max(0,Math.min(1,(frame-start)/(end-start)));
    // Seat the sockets first. On J2 the header and display then mate as a pair.
    const lift=rise=>id==='K'?rise*(rise<0?remaining(0,4):remaining(5,10)):id==='U1'?rise*(rise<=5?remaining(0,3):rise===13?remaining(3,7):remaining(7,10))
     :rise<=4?rise*remaining(0,3):11*remaining(6,10)+(rise-11)*remaining(3,6);
    const entries=stack.map(([part,rise])=>({...part,position:[part.position[0],part.position[1]+lift(rise),part.position[2]]}));
    preview.image(entries,[1,.54,id==='U1'?-1.0:1.15],{width,height,bounds:frameBox});
    ctx.drawImage(renderer.domElement,(width-crop)/2,0,crop,height,frame*crop,0,crop,height);
   }
   shots[side+'-'+id.toLowerCase()]=canvas.toDataURL('image/webp',.92);
  }
 }
 renderer.dispose();return {...images,...shots};
}
