// SPDX-License-Identifier: GPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import {printPlacement} from './print-pose.js';

// Each texel stores a material index and a lighting level. Recoloring never
// changes the geometry, including holes and registered frame inlays.
function projectShape(id,sources){
 const triangles=sources.map(source=>{
  const bytes=source.bytes,count=bytes.readUInt32LE(80),minimum=[Infinity,Infinity,Infinity],maximum=minimum.map(()=>-Infinity);
  if(!count||bytes.length!==84+count*50)throw Error('Invalid plate mesh: '+id);
  const vertices=new Float32Array(count*9);
  for(let i=0;i<count;i++)for(let j=0;j<9;j++){
   const v=bytes.readFloatLE(96+50*i+4*j),a=j%3;vertices[9*i+j]=v;minimum[a]=Math.min(minimum[a],v);maximum[a]=Math.max(maximum[a],v);
  }
  return {role:source.role,minimum,maximum,vertices};
 });
 const placement=printPlacement(id,triangles),pose=placement.transform(),[w,h]=placement.size;
 const scale=Math.min(3,300/Math.max(w,h)),width=Math.max(1,Math.ceil(w*scale)),height=Math.max(1,Math.ceil(h*scale));
 const pixels=new Uint8Array(width*height),depth=new Float32Array(pixels.length).fill(-Infinity);
 for(const [slot,mesh] of triangles.entries()){
  const points=mesh.vertices;
  for(let i=0;i<points.length;i+=9){
   const p=[];
   for(let j=i;j<i+9;j+=3){
    const x=points[j]+placement.shift[0],y=points[j+1]+placement.shift[1],z=points[j+2]+placement.shift[2];
    p.push([(x*pose[0]+y*pose[3]+z*pose[6]+pose[9])*width/w,(x*pose[1]+y*pose[4]+z*pose[7]+pose[10])*height/h,x*pose[2]+y*pose[5]+z*pose[8]+pose[11]]);
   }
   const [a,b,c]=p,dx=b[0]-a[0],dy=b[1]-a[1],ex=c[0]-a[0],ey=c[1]-a[1],det=dx*ey-dy*ex;
   if(det<=1e-7)continue;
   const nx=(dy*(c[2]-a[2])-(b[2]-a[2])*ey)*scale,ny=((b[2]-a[2])*ex-dx*(c[2]-a[2]))*scale;
   const light=(.85*det-.28*nx+.4*ny)/Math.hypot(nx,ny,det);
   const value=1+slot*48+Math.round(24+22*Math.max(-1,Math.min(1,light)));
   const x0=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),x1=Math.min(width,Math.ceil(Math.max(a[0],b[0],c[0])));
   const y0=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),y1=Math.min(height,Math.ceil(Math.max(a[1],b[1],c[1])));
   for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
    const rx=x+.5-a[0],ry=y+.5-a[1],u=(rx*ey-ry*ex)/det,v=(dx*ry-dy*rx)/det;
    if(u<0||v<0||u+v>1)continue;
    const z=a[2]+u*(b[2]-a[2])+v*(c[2]-a[2]),k=(height-1-y)*width+x;
    if(z>=depth[k]){depth[k]=z;pixels[k]=value;}
   }
  }
 }
 return {width,height,pixels:Buffer.from(pixels).toString('base64'),materials:triangles.map(({role,minimum,maximum})=>({role,minimum,maximum}))};
}

export function buildPlateShapes(scene,root){
 const shapes={},screws={};
 function register(asset){
  const key=asset.print_path||asset.path;
  if(!shapes[key])shapes[key]=projectShape(asset.id,[{role:'body',bytes:Buffer.from(asset.stl,'base64')}]);
  if(asset.material_parts?.length&&!shapes['art/'+key])shapes['art/'+key]=projectShape(asset.id,asset.material_parts.map(v=>({role:v.role,bytes:Buffer.from(v.stl,'base64')})));
 }
 for(const assets of [scene.printing.assets,...Object.values(scene.variants).map(v=>v.printing||{})])Object.values(assets).forEach(register);
 for(const [profile,record] of Object.entries(scene.fasteners?.profiles||{})){
  screws[profile]={};
  for(const [id,asset] of Object.entries(record.printing||{})){
   register(asset);screws[profile][id]={id,path:asset.print_path||asset.path,material_parts:asset.material_parts?.map(v=>({role:v.role}))};
  }
 }
 for(const cap of scene.catalog.variants)shapes[cap.id]=projectShape(cap.id,[{role:'body',bytes:fs.readFileSync(path.join(root,cap.path))}]);
 return {shapes,screws};
}
