// SPDX-License-Identifier: GPL-3.0-or-later
// The home page's live model: the viewer scene's own parts, welded, simplified within a stated error in mm,
// quantized and meshopt-encoded. One common pack (keycaps, switches, frames, electronics) and one pack per
// size (its cases and PCB). Also writes the home page itself to docs/index.html.
// Run from viewer/build.mjs, or alone: node viewer/home-build.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {MeshoptSimplifier,MeshoptEncoder} from 'meshoptimizer';

const here=path.dirname(fileURLToPath(import.meta.url)),root=path.dirname(here);
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const SIZES=['flan36','flan42','flan46','flan54'],STYLES=['rim','solid','terrace','level'],BATTERY='adafruit-1570';
// Simplification error per part family, in mm: visible faces keep their silhouette at hero scale.
const ERROR={case:.03,pcb:.04,frame:.015,cap:.03,switch:.05,socket:.06,electronics:.06,lead:.1};
// Not shown on the home page: underside fasteners, magnets and diodes.
const SKIP=/Washer|screw|magnet|Foot|diodes|E-Switch/i;

const b64=s=>Buffer.from(s,'base64');
const f32=s=>{const b=b64(s);return new Float32Array(b.buffer,b.byteOffset,b.byteLength/4);};
const u32=s=>{const b=b64(s);return new Uint32Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));};
// Binary STL in CAD axes -> viewer axes (x, z, -y), as viewer/app.js stlGeometry() does.
function stl(bytes){
  const n=bytes.readUInt32LE(80);if(bytes.length!==84+50*n)throw Error('Expected a binary STL.');
  const p=new Float32Array(n*9);
  for(let t=0;t<n;t++)for(let v=0;v<3;v++){const o=84+50*t+12+12*v,i=t*9+v*3;p[i]=bytes.readFloatLE(o);p[i+1]=bytes.readFloatLE(o+8);p[i+2]=-bytes.readFloatLE(o+4);}
  return {positions:p,indices:Uint32Array.from({length:n*3},(_,i)=>i),groups:null};
}
// Weld equal positions, simplify each material group (borders locked so groups still meet), then
// renumber vertices in first-use order.
// Unused duplicates would mark their twins as seams that never collapse, so compact before simplifying.
function compact(positions,indices){
  const order=new Map(),index=new Uint32Array(indices.length);
  for(let i=0;i<indices.length;i++){if(!order.has(indices[i]))order.set(indices[i],order.size);index[i]=order.get(indices[i]);}
  const pos=new Float32Array(order.size*3);for(const [old,n] of order)pos.set(positions.subarray(old*3,old*3+3),n*3);
  return [pos,index];
}
function simplify({positions:raw,indices:source,groups},error){
  const remap=MeshoptSimplifier.generatePositionRemap(raw,3),[positions,welded]=compact(raw,source.map(i=>remap[i])),indices=source;
  const ranges=groups?.length?groups.map(g=>[g.start,g.count,g.materialIndex]):[[0,welded.length,0]];
  const out=[],kept=[];let start=0;
  for(const [s,count,material] of ranges){
    const part=welded.slice(s,s+count);
    const [result]=MeshoptSimplifier.simplify(part,positions,3,0,error,['ErrorAbsolute',...(ranges.length>1?['LockBorder']:[])]);
    // never let a small part vanish
    const use=result.length>=3?result:part;
    out.push(use);kept.push([start,use.length,material]);start+=use.length;
  }
  const all=new Uint32Array(start);let o=0;for(const a of out){all.set(a,o);o+=a.length;}
  const [pos,index]=compact(positions,all);
  return {positions:pos,indices:index,groups:kept,source:indices.length/3};
}
// uint16 positions over the mesh's box (under 0.002 mm per step at keyboard size), meshopt codecs.
function encode(mesh,blob){
  const {positions,indices,groups}=mesh,n=positions.length/3,min=[0,1,2].map(a=>Infinity),max=[0,1,2].map(()=>-Infinity);
  for(let i=0;i<n;i++)for(let a=0;a<3;a++){const v=positions[i*3+a];if(v<min[a])min[a]=v;if(v>max[a])max[a]=v;}
  const q=new Uint16Array(n*4);
  for(let i=0;i<n;i++)for(let a=0;a<3;a++){const e=max[a]-min[a];q[i*4+a]=e?Math.round((positions[i*3+a]-min[a])/e*65535):0;}
  const vb=MeshoptEncoder.encodeVertexBufferLevel(new Uint8Array(q.buffer),n,8,2,0);
  const size=n<65536?2:4,idx=size===2?Uint16Array.from(indices):indices;
  const ib=MeshoptEncoder.encodeIndexBuffer(new Uint8Array(idx.buffer,idx.byteOffset,idx.byteLength),indices.length,size);
  return {b:[...min,...max],v:n,i:indices.length,s:size,vb:blob(vb),ib:blob(ib),g:groups.length>1?groups:undefined};
}
function container(header,parts){
  const json=Buffer.from(JSON.stringify(header)),length=Buffer.alloc(4);length.writeUInt32LE(json.length);
  return Buffer.concat([length,json,...parts]);
}
// Reuse a published pack with the same content: gzip bytes differ between zlib versions.
function publish(dir,prefix,raw){
  for(const f of fs.readdirSync(dir).filter(f=>f.startsWith(prefix+'-')&&f.endsWith('.bin'))){
    const bytes=fs.readFileSync(path.join(dir,f));
    if(bytes.readUInt32LE(bytes.length-4)===raw.length%2**32&&gunzipSync(bytes).equals(raw))return f;
  }
  const bytes=gzipSync(raw,{level:9}),name=`${prefix}-${crypto.createHash('sha256').update(bytes).digest('hex').slice(0,16)}.bin`;
  fs.writeFileSync(path.join(dir,name),bytes);return name;
}
function pack(){const parts=[];let offset=0;return {parts,blob(bytes){const at=[offset,bytes.length];parts.push(Buffer.from(bytes));offset+=bytes.length;return at;}};}

export async function buildHome({scene=read('build/viewer-scene.json')}={}){
  await MeshoptSimplifier.ready;await MeshoptEncoder.ready;
  const geo=scene.geometries,catalog=scene.catalog,stats={};
  const fromScene=id=>{const g=geo[id];if(!g)throw Error('Geometry unavailable: '+id);return {positions:f32(g.positions),indices:u32(g.indices),groups:g.groups};};
  const add=(target,blob,id,source,error,family)=>{
    const m=simplify(source,error);target[id]=encode(m,blob);
    (stats[family]??={source:0,triangles:0}).source+=m.source;stats[family].triangles+=m.indices.length/3;
  };
  const assets=path.join(root,'docs/assets');fs.mkdirSync(assets,{recursive:true});
  // common: every part of the assembly except the cases and the PCB, with how to colour it
  const common=pack(),meshes={},parts=[];
  const variantById=new Map(catalog.variants.map(v=>[v.id,v]));
  const layout=Object.fromEntries(Object.entries(catalog.layout).map(([side,keys])=>[side,Object.fromEntries(keys.map(k=>[k.ref,{row:k.row,col:k.col,angle:k.angle}]))]));
  const presets={original:'default',normal:'normal-sculpted',saddle:'saddle-sculpted'},caps={};
  const choices=Object.fromEntries(Object.entries(presets).map(([id,file])=>[id,Object.fromEntries(['left','right'].map(side=>
    [side,Object.fromEntries(Object.entries(scene.presets[file].keycaps[side]).map(([ref,c])=>[ref,[c.variant,c.rotation_deg]]))]))]));
  for(const preset of Object.values(choices))for(const keys of Object.values(preset))for(const [variant] of Object.values(keys))
    if(!caps[variant]){const v=variantById.get(variant);add(meshes,common.blob,'cap:'+variant,fromScene(v.path),ERROR.cap,'keycaps');caps[variant]={mesh:'cap:'+variant,seat:v.seating_z_mm};}
  for(const side of ['left','right']){
    for(const style of Object.keys(catalog.frame_styles))add(meshes,common.blob,`${side}-frame-${style}`,fromScene(`mechanical/revI/${side}-frame-${style}.stl`),ERROR.frame,'frames');
    add(meshes,common.blob,`${side}-battery`,fromScene(`mechanical/revI/${side}-battery-${BATTERY}.stl`),ERROR.electronics,'electronics');
  }
  for(const part of scene.parts){
    if(SKIP.test(part.name)||part.group==='fasteners')continue;
    const p={side:part.side,group:part.group,p:part.position,a:part.angle_deg,e:part.explode_mm};
    const ref=part.key_ref||part.name.match(/K\d\d/)?.[0];if(ref)p.r=ref;
    if(part.variants)p.v=part.variants;
    if(part.group==='base'||part.group==='plate')p.kind='case';
    else if(part.part_id===`${part.side}-pcb`)p.kind='pcb';
    else if(part.name.includes('Electronics cover'))p.kind='frame';
    else if(part.group==='keycaps'){p.kind='cap';p.k=part.template_ref||part.key_ref;}
    else if(part.group==='battery'){p.kind='battery';p.c=[part.color];}
    else if(part.primitive?.kind==='screen'){p.kind='screen';p.screen={size:part.primitive.size,text:part.primitive.text,color:part.color};}
    else if(part.primitive)continue;
    else{
      let id=part.geometry,colors=part.materials||[part.color];
      if(Number.isInteger(part.battery_lead_index)){const wire=scene.batteryLeadProfiles[`${part.side}-${BATTERY}`].find(w=>w.index===part.battery_lead_index);id=wire.geometry;colors=[wire.color];}
      const family=part.group==='switches'?'switch':/Hot-swap/.test(part.name)?'socket':Number.isInteger(part.battery_lead_index)?'lead':'electronics';
      if(!meshes[id])add(meshes,common.blob,id,fromScene(id),ERROR[family],{switch:'switches',socket:'sockets',lead:'electronics',electronics:'electronics'}[family]);
      p.kind='fixed';p.mesh=id;p.c=colors;
    }
    parts.push(p);
  }
  const header={schema:'flan-home-1',kind:'common',meshes,parts,caps,presets:choices,layout,masks:scene.silkscreen.masks.map(m=>[m.id,m.mask])};
  const files={common:publish(assets,'home-common',container(header,common.parts))};
  // one pack per size: its four case styles and both PCBs
  for(const size of SIZES){
    const v=scene.variants?.[size],sized=pack(),m={};
    const source=p=>{
      if(size==='flan36')return fromScene(`mechanical/revI/${p}.stl`);
      const printed=Object.values(v.printing).find(a=>a.path===`mechanical/${size}/${p}.stl`),stlB64=printed?.stl||v.meshes[`mechanical/${size}/${p}.stl`];
      if(!stlB64)throw Error(`${size}: ${p} unavailable`);return stl(b64(stlB64));
    };
    for(const side of ['left','right']){
      for(const style of STYLES)for(const group of ['base','plate'])add(m,sized.blob,`${side}-case-${style}-${group}`,source(`${side}-case-${style}-${group}`),ERROR.case,'cases');
      add(m,sized.blob,`${side}-pcb`,source(`${side}-pcb`),ERROR.pcb,'pcbs');
    }
    files[size]=publish(assets,'home-'+size,container({schema:'flan-home-1',kind:'size',id:size,meshes:m},sized.parts));
  }
  // only this build's packs are published; earlier ones stay in Git history
  const current=new Set(Object.values(files));
  for(const f of fs.readdirSync(assets))if(/^home-[a-z0-9]+-[0-9a-f]{16}\.bin$/.test(f)&&!current.has(f))fs.rmSync(path.join(assets,f));
  const bytes=Object.fromEntries(Object.entries(files).map(([k,f])=>[k,fs.statSync(path.join(assets,f)).size]));
  const page=await homePage({scene,files});
  const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
  const sources=['viewer/home-build.mjs','viewer/home/app.js','viewer/home/model.js','viewer/home/tokens.js','viewer/home/style.css','viewer/home/template.html',
    'design/themes.json','design/frame-finishes.json','design/variants.json','viewer/package-lock.json'].map(p=>({path:p,sha256:hash(p)}));
  const receipt={revision:scene.revision,page:{path:'docs/index.html',sha256:hash('docs/index.html'),bytes:page.bytes},
    packs:Object.fromEntries(Object.entries(files).map(([k,f])=>[k,{path:'docs/assets/'+f,sha256:hash('docs/assets/'+f),bytes:bytes[k]}])),
    error_mm:ERROR,triangles:stats,omitted:'Fasteners, magnets, feet, the underside diodes and the reset switch; the battery is the default Adafruit 1570 profile.',
    method:'Equal positions welded; each material group simplified with meshoptimizer 1.2.0 within an absolute error (borders locked between groups); positions quantized to 16 bits over each mesh box; meshopt vertex and index codecs; gzip.',
    scene_sources:scene.sources,sources};
  fs.writeFileSync(path.join(root,`validation/rev${scene.revision}-home.json`),JSON.stringify(receipt,null,2)+'\n');
  return {files,bytes,stats,page};
}
// docs/index.html: the bundle, the rail's data and the fonts and poster it references
async function homePage({scene,files}){
  const dir=path.join(here,'home'),assets=path.join(root,'docs/assets');
  fs.mkdirSync(path.join(assets,'fonts'),{recursive:true});
  for(const f of fs.readdirSync(path.join(dir,'fonts')))fs.copyFileSync(path.join(dir,'fonts',f),path.join(assets,'fonts',f));
  for(const f of ['home-poster.webp','home-og.png'])if(fs.existsSync(path.join(dir,f)))fs.copyFileSync(path.join(dir,f),path.join(assets,f));
  const bundle=await build({entryPoints:[path.join(dir,'app.js')],bundle:true,write:false,minify:true,format:'iife',target:['es2020'],legalComments:'inline'});
  const themes=read('design/themes.json').themes.map(({id,name,base,plate,frame,keycaps,recommended_frame})=>({id,name,base,plate,frame,keycaps,recommended_frame}));
  const family=read('design/variants.json').variants;
  const data={packs:Object.fromEntries(Object.entries(files).map(([k,f])=>[k,'assets/'+f])),themes,
    sizes:SIZES.map(id=>({id,title:family[id].title,grid:family[id].grid_per_half,keys:family[id].keys_total})),
    frames:Object.entries(scene.catalog.frame_styles).map(([id,label])=>({id,label}))};
  const mark=fs.readFileSync(path.join(root,'docs/branding/flan/flan-mark.svg'),'utf8').replace(/<\?xml[^>]*>|<title>[^<]*<\/title>/g,'')
    .replace(/<svg[^>]*viewBox="([^"]+)"[^>]*>/,'<svg class="mark" viewBox="$1" aria-hidden="true" fill="currentColor">').replace(/ fill="#000"/g,'');
  const html=fs.readFileSync(path.join(dir,'template.html'),'utf8')
    .replace('/*__STYLE__*/',()=>fs.readFileSync(path.join(dir,'style.css'),'utf8'))
    .replace('<!--__MARK__-->',()=>mark.trim())
    .replace('/*__DATA__*/',()=>JSON.stringify(data).replaceAll('<','\\u003c'))
    .replace('/*__APP__*/',()=>bundle.outputFiles[0].text.replaceAll('</script','<\\/script'));
  fs.writeFileSync(path.join(root,'docs/index.html'),html);
  return {bytes:Buffer.byteLength(html),script:bundle.outputFiles[0].text.length};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const result=await buildHome();
  console.log(JSON.stringify(result,null,1));
}
