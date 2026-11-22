// SPDX-License-Identifier: GPL-3.0-or-later
import {finishes} from './finishes.js';
export const decode=s=>s instanceof Uint8Array?s:Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export const xml=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
function stlMesh(encoded){
 const bytes=decode(encoded);if(bytes.length<84)throw Error('Expected a binary STL.');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),n=view.getUint32(80,true);
 if(!n||bytes.length!==84+50*n)throw Error('Expected a nonempty binary STL.');
 const vertexIds=new Map(),points=[],triangles=[],minimum=[Infinity,Infinity,Infinity],maximum=[-Infinity,-Infinity,-Infinity];
 for(let t=0;t<n;t++){
  const ids=[];
  for(let j=0;j<3;j++){
   const p=[0,1,2].map(a=>view.getFloat32(84+t*50+12+j*12+a*4,true));
   if(!p.every(Number.isFinite))throw Error('Invalid STL coordinate.');
   p.forEach((v,a)=>{minimum[a]=Math.min(minimum[a],v);maximum[a]=Math.max(maximum[a],v);});
   const key=p.join(',');if(!vertexIds.has(key)){vertexIds.set(key,points.length);points.push(p);}ids.push(vertexIds.get(key));
  }
  triangles.push(ids);
 }
 return {points,triangles,minimum,maximum};
}
export function readMaterials(part){
 if(part.style&&finishes.styles[part.style]&&!part.material_parts?.length)throw Error('Native flush materials unavailable: '+part.id);
 const inputs=part.material_parts?.length?part.material_parts:[{role:'body',path:part.print_path||part.path,sha256:part.sha256,stl:part.stl}];
 const seen=new Set(),materials=inputs.map((source,i)=>{
  const roleIndex=finishes.roles.indexOf(source.role);
  if(roleIndex<0||seen.has(source.role))throw Error('Invalid native material role: '+source.role);
  seen.add(source.role);return {...source,path:source.print_path||source.path,object_id:i+2,roleIndex,...stlMesh(source.stl)};
 });
 if(!seen.has('body'))throw Error('Frame body material unavailable.');
 return materials;
}
export function meshObject(p,shift,id,name,colorIndex){
  const vertices=p.points.map(v=>`<vertex x="${v[0]+shift[0]}" y="${v[1]+shift[1]}" z="${v[2]+shift[2]}"/>`).join('');
  const faces=p.triangles.map(a=>`<triangle v1="${a[0]}" v2="${a[1]}" v3="${a[2]}"/>`).join('');
  return `<object id="${id}" type="model" name="${xml(name)}" pid="1" pindex="${colorIndex}"><mesh><vertices>${vertices}</vertices><triangles>${faces}</triangles></mesh></object>`;
}

export {printPlacement} from './print-pose.js';
