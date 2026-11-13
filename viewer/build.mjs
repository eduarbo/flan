// SPDX-License-Identifier: GPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {Script} from 'node:vm';
import {build} from 'esbuild';
import {zipSync} from 'three/addons/libs/fflate.module.js';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';
import {DEFAULT as homeLook} from './home/options.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.dirname(here);
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const scene=JSON.parse(fs.readFileSync(path.join(root,'build/viewer-scene.json'),'utf8'));
for(const item of scene.sources)if(hash(item.path)!==item.sha256)throw Error(`Stale input: ${item.path}`);
// Lightweight print metadata uses the same registry as the downloadable kit.
const printMeta=assets=>Object.fromEntries(Object.entries(assets).map(([id,a])=>[id,{id:a.id,path:a.path}]));
const printInventory=Object.fromEntries(Object.entries(scene.variants).map(([id,v])=>[id,{
 assets:printMeta({...scene.printing.assets,...v.printing}),supports:scene.printing.supports,fasteners:v.fasteners
}]));
// Package assets stay on this origin and are pinned to this viewer's bytes.
const packagePaths=new Set(['LICENSE','LICENSES/CC-BY-SA-4.0.txt',...scene.catalog.variants.map(v=>v.path),...['coupon-magnet-base','coupon-magnet-frame','coupon-m2-thread'].map(n=>'mechanical/revI/'+n+'.stl')]);
for(const edition of scene.silkscreen.editions){for(const file of Object.values(edition.packages))packagePaths.add(file);for(const pair of Object.values(edition.variants||{}))for(const file of Object.values(pair))packagePaths.add(file);}
for(const variant of Object.keys(scene.variants))for(const side of ['left','right','right-no-display'])packagePaths.add('firmware/uf2/'+variant+'-'+side+'.uf2');
const packageAssets={},packageDirectory=path.join(root,'docs/explore/assets/build');fs.mkdirSync(packageDirectory,{recursive:true});
for(const source of packagePaths){const bytes=fs.readFileSync(path.join(root,source)),digest=hash(source),filename=digest+path.extname(source);fs.writeFileSync(path.join(packageDirectory,filename),bytes);packageAssets[source]={url:'./assets/build/'+filename,sha256:digest,bytes:bytes.length};}
const bundle=await build({entryPoints:[path.join(here,'app.js')],bundle:true,write:false,minify:true,
  define:{__FLAN_PRINT_INVENTORY__:JSON.stringify(printInventory),__FLAN_BUILD_ASSETS__:JSON.stringify(packageAssets)},format:'iife',target:['es2020'],legalComments:'inline'});
const license=fs.readFileSync(path.join(here,'node_modules/three/LICENSE'),'utf8');
fs.writeFileSync(path.join(root,'LICENSES/Three-MIT.txt'),license);
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const licenses=[['LICENSE','Flan36 · GPL-3.0'],['LICENSES/CC-BY-SA-4.0.txt','Keycap meshes · CC-BY-SA-4.0','credits.meshes'],['LICENSES/Three-MIT.txt','Three.js · MIT'],['LICENSES/fflate-MIT.txt','fflate · MIT'],['LICENSES/meshoptimizer-MIT.txt','meshoptimizer · MIT'],['components/sources/KiSwitch-MIT.txt','KiSwitch · MIT']].map(([p,label,key])=>`<details class="option-group"><summary${key?` data-t="${key}"`:''}>${label}</summary><pre>${escape(fs.readFileSync(path.join(root,p),'utf8'))}</pre></details>`).join('');
const credits=`<dl class="credit-list">
<div><dt data-t="credits.keyboard">Original keyboard &amp; CAD</dt><dd data-t="credits.keyboardText">Designed by Eduardo Ruiz. Inspired by Piantor by beekeeb, whose 36 key positions and angles it keeps (GPL-3.0); the PCBs, case outline, cases, frames and firmware are original. Flan36 is not affiliated with beekeeb.</dd></div>
<div><dt data-t="credits.klp">KLP Lamé keycaps</dt><dd data-t="credits.keycaps">braindefender · CC-BY-SA-4.0. Original meshes, placed and colored. <a href="https://github.com/braindefender/KLP-Lame-Keycaps/tree/4a67a824232d3054c61599ea047c56a340faaba2" data-t="credits.pinned">Pinned source ↗</a></dd></div>
<div><dt data-t="credits.components">Component models</dt><dd data-t="credits.componentsText">KiSwitch Choc v1 · MIT. KiCad library models · CC-BY-SA-4.0 with library exception. <a href="https://github.com/eduarbo/flan/blob/main/components/README.md" data-t="credits.changes">Per-file sources &amp; changes ↗</a></dd></div>
<div><dt data-t="credits.libraries">Viewer libraries</dt><dd data-t="credits.librariesText">Three.js 0.180.0, fflate and meshoptimizer 1.2.0 · MIT.</dd></div>
</dl><p><a href="https://github.com/eduarbo/flan/blob/main/ATTRIBUTION.md" data-t="credits.notices">All source notices and reference-file provenance ↗</a></p><h3 data-t="credits.texts">Full license texts</h3>`;
const template=fs.readFileSync(path.join(here,'template.html'),'utf8');
// Share byte-identical meshes without changing any vertex, normal or triangle.
const geometryAliases={},unique={},seen=new Map();
for(const [id,geometry] of Object.entries(scene.geometries)){
 const digest=crypto.createHash('sha256').update(JSON.stringify(geometry)).digest('hex');
 if(seen.has(digest))geometryAliases[id]=seen.get(digest);else{unique[id]=geometry;seen.set(digest,id);}
}
// Reuse a published asset with the same content: gzip bytes differ between zlib versions.
function deferred(prefix,value){
 const raw=Buffer.from(JSON.stringify(value)),dir=path.join(root,'docs/explore/assets');fs.mkdirSync(dir,{recursive:true});
 for(const f of fs.readdirSync(dir).filter(f=>f.startsWith(prefix+'-')).sort()){
  const bytes=fs.readFileSync(path.join(dir,f));
  if(bytes.readUInt32LE(bytes.length-4)===raw.length%2**32&&gunzipSync(bytes).equals(raw))return bytes;
 }
 return gzipSync(raw,{level:9});
}
const printBytes=deferred('printing',scene.printing);
const printHash=crypto.createHash('sha256').update(printBytes).digest('hex');
const assetPath=`docs/explore/assets/printing-${printHash}.bin`;fs.writeFileSync(path.join(root,assetPath),printBytes);
const silkBytes=deferred('silkscreen',scene.silkscreen.textures);
const silkHash=crypto.createHash('sha256').update(silkBytes).digest('hex');
const silkPath=`docs/explore/assets/silkscreen-${silkHash}.bin`;fs.writeFileSync(path.join(root,silkPath),silkBytes);
// the edition cards' pictures, fetched when the PCB panel is first seen
const thumbBytes=deferred('silkthumbs',scene.silkscreen.thumbnails),thumbHash=crypto.createHash('sha256').update(thumbBytes).digest('hex');
const thumbPath=`docs/explore/assets/silkthumbs-${thumbHash}.bin`;fs.writeFileSync(path.join(root,thumbPath),thumbBytes);
// Each built Flan variant's case and PCB meshes and printable case STLs, loaded when chosen.
const variantAssets={};
function variantContainer(v){
 const blobs=[],index=new Map(),parts=[];let offset=0;
 const add=b64=>{const bytes=Buffer.from(b64,'base64'),key=crypto.createHash('sha256').update(bytes).digest('hex');
  if(!index.has(key)){index.set(key,blobs.length);blobs.push([offset,bytes.length]);parts.push(bytes);offset+=bytes.length;}return index.get(key);};
 const printing=Object.fromEntries(Object.entries(v.printing).map(([name,{stl,...a}])=>[name,{...a,blob:add(stl)}]));
 const meshes=Object.fromEntries(Object.entries(v.meshes).map(([path,stl])=>[path,add(stl)]));
 const header=Buffer.from(JSON.stringify({schema:'flan-variant-1',printing,meshes,silkscreen:v.silkscreen,blobs})),length=Buffer.alloc(4);length.writeUInt32LE(header.length);
 return Buffer.concat([length,header,...parts]);
}
// Reuse a published container with the same content, as deferred() does for the print kit.
function deferredBinary(prefix,raw){
 const dir=path.join(root,'docs/explore/assets');
 for(const f of fs.readdirSync(dir).filter(f=>f.startsWith(prefix+'-')).sort()){
  const bytes=fs.readFileSync(path.join(dir,f));
  if(bytes.readUInt32LE(bytes.length-4)===raw.length%2**32&&gunzipSync(bytes).equals(raw))return bytes;
 }
 return gzipSync(raw,{level:9});
}
for(const [id,v] of Object.entries(scene.variants||{}))if(v.printing){
 const bytes=deferredBinary('variant-'+id,variantContainer(v));
 const hash=crypto.createHash('sha256').update(bytes).digest('hex'),file=`docs/explore/assets/variant-${id}-${hash}.bin`;
 fs.writeFileSync(path.join(root,file),bytes);variantAssets[id]={bytes,hash,file};
}
// Optional screw profiles: their plates and frames as exact STL bytes, fetched when a design chooses one.
const fastenerAssets={};
function fastenerContainer(profile){
 const blobs=[],index=new Map(),parts=[];let offset=0;
 const add=b64=>{const bytes=Buffer.from(b64,'base64'),key=crypto.createHash('sha256').update(bytes).digest('hex');
  if(!index.has(key)){index.set(key,blobs.length);blobs.push([offset,bytes.length]);parts.push(bytes);offset+=bytes.length;}return index.get(key);};
 const printing=Object.fromEntries(Object.entries(profile.printing).map(([name,{stl,material_parts,...a}])=>
  [name,{...a,blob:add(stl),...(material_parts?{material_parts:material_parts.map(({stl,...m})=>({...m,blob:add(stl)}))}:{})}]));
 const header=Buffer.from(JSON.stringify({schema:'flan-fasteners-1',printing,meshes:{},blobs})),length=Buffer.alloc(4);length.writeUInt32LE(header.length);
 return Buffer.concat([length,header,...parts]);
}
for(const [id,profile] of Object.entries(scene.fasteners?.profiles||{})){
 const bytes=deferredBinary('fasteners-'+id,fastenerContainer(profile));
 const digest=crypto.createHash('sha256').update(bytes).digest('hex'),file=`docs/explore/assets/fasteners-${id}-${digest}.bin`;
 fs.writeFileSync(path.join(root,file),bytes);fastenerAssets[id]={bytes,hash:digest,file};
}
const fasteners=scene.fasteners&&{...scene.fasteners,profiles:Object.fromEntries(Object.entries(scene.fasteners.profiles).map(([id,{printing,...rest}])=>
 [id,{...rest,asset:{url:`./assets/fasteners-${id}-${fastenerAssets[id].hash}.bin`,sha256:fastenerAssets[id].hash}}]))};
// Size thumbnails: the home page's own renders (viewer/thumbs, from design/proposals/explorer-r1/assets via
// magick snes-size-<id>.png -resize 192x -quality 84 size-<id>.webp), inline for the CSP.
const thumb=id=>{const f=path.join(here,'thumbs',`size-${id}.webp`);return fs.existsSync(f)?'data:image/webp;base64,'+fs.readFileSync(f).toString('base64'):undefined;};
const variants=Object.fromEntries(Object.entries(scene.variants||{}).map(([id,{printing,meshes,silkscreen,drawing,...rest}])=>
 [id,{...(variantAssets[id]?{...rest,asset:{url:`./assets/variant-${id}-${variantAssets[id].hash}.bin`,sha256:variantAssets[id].hash}}:rest),...(thumb(id)?{thumb:thumb(id)}:{drawing})}]));   // a size card shows its render; the outline drawing is its fallback
// The KLP Lamé keycaps the complete print kit carries: every variant the three presets use, unchanged upstream
// STLs, one deferred file each so a kit fetches only its own. The offline copy lists them instead (size limit).
const keycapIds=[...new Set(Object.values(scene.presets).flatMap(p=>Object.values(p.keycaps).flatMap(keys=>Object.values(keys).map(k=>k.variant))))].sort();
const keycapAssets={},keycapFiles=[];
for(const id of keycapIds){
 const v=scene.catalog.variants.find(v=>v.id===id),raw=fs.readFileSync(path.join(root,v.path));if(hash(v.path)!==v.sha256)throw Error(`Stale keycap: ${v.path}`);
 const bytes=deferredBinary('keycap-'+id,raw),digest=crypto.createHash('sha256').update(bytes).digest('hex'),file=`docs/explore/assets/keycap-${id}-${digest}.bin`;
 fs.writeFileSync(path.join(root,file),bytes);keycapFiles.push(file);keycapAssets[id]={url:`./assets/keycap-${id}-${digest}.bin`,sha256:digest,path:v.path,source_sha256:v.sha256};
}
// Only this build's deferred assets are published; earlier ones stay in Git history.
const current=new Set([assetPath,silkPath,thumbPath,...Object.values(variantAssets).map(a=>a.file),...Object.values(fastenerAssets).map(a=>a.file),...keycapFiles].map(p=>path.basename(p)));
for(const f of fs.readdirSync(path.join(root,'docs/explore/assets')))
 if(/^(printing|silkscreen|silkthumbs|variant-[a-z0-9]+|fasteners-[a-z0-9-]+|keycap-[a-z0-9_]+)-[0-9a-f]{64}\.bin$/.test(f)&&!current.has(f))fs.rmSync(path.join(root,'docs/explore/assets',f));
// The scene's meshes, one compact file per option: the page fetches what a design shows and the rest when
// it is chosen. Positions and triangles are stored exactly (meshopt vertex and index-sequence codecs, which
// are lossless); normals are stored as 16-bit octahedral vectors, under 0.01 degrees from the scene's own.
// Meshes the viewer never looks up (the per-material sources of merged parts) are not published.
await MeshoptEncoder.ready;await MeshoptDecoder.ready;
const canonical=id=>geometryAliases[id]||id,users=new Map();
const use=(tag,id)=>{id=canonical(id);if(!unique[id])return;if(!users.has(id))users.set(id,new Set());users.get(id).add(tag);};
// what a design chooses, as viewer/app.js applies it: cases, keycaps, frames, batteries with their leads, the PCB
const chosen=p=>['base','plate','keycaps','battery'].includes(p.group)||Number.isInteger(p.battery_lead_index)||p.name.includes('Electronics cover')||p.part_id===`${p.side}-pcb`;
for(const p of scene.parts)if(p.geometry&&!chosen(p)){if(!unique[canonical(p.geometry)])throw Error('Part without geometry: '+p.name);use('core',p.geometry);}
for(const side of ['left','right']){
 for(const style of Object.keys(scene.catalog.case_styles))for(const group of ['base','plate'])use('case-'+style,`mechanical/revI/${side}-case-${style}-${group}.stl`);
 for(const style of Object.keys(scene.catalog.frame_styles))use('frame-'+style,`mechanical/revI/${side}-frame-${style}.stl`);
 for(const id of Object.keys(scene.catalog.battery_profiles)){use('battery-'+id,`mechanical/revI/${side}-battery-${id}.stl`);for(const wire of scene.batteryLeadProfiles[`${side}-${id}`])use('battery-'+id,wire.geometry);}
 use('pcb',`mechanical/revI/${side}-pcb.stl`);
}
for(const v of scene.catalog.variants)use('cap-'+v.id,v.path);
// a mesh two options share (a tray, a plate) gets a file of its own, so neither option fetches the other's
const chunks=new Map(),geometryIndex={};
for(const [id,tags] of users){const name=tags.has('core')?'core':[...tags].sort().join('--');if(!chunks.has(name))chunks.set(name,[]);chunks.get(name).push(id);geometryIndex[id]=name;}
const bytesOf=(text,Type)=>{const b=Buffer.from(text,'base64');return new Type(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));};
function geometryContainer(ids){
 const parts=[],meshes={};let offset=0,worst=0;
 const blob=bytes=>{const at=[offset,bytes.length];parts.push(Buffer.from(bytes));offset+=bytes.length;return at;};
 for(const id of ids.sort()){
  const g=unique[id],positions=bytesOf(g.positions,Uint8Array),normals=bytesOf(g.normals,Float32Array),indices=bytesOf(g.indices,Uint32Array),n=positions.length/12;
  if(normals.length!==n*3||indices.length%3)throw Error('Unexpected mesh layout: '+id);
  // WebGL 2 reads index 65535 of a 16-bit buffer as a primitive restart
  const size=n<65535?2:4,index=size===2?Uint16Array.from(indices):indices,indexBytes=new Uint8Array(index.buffer,index.byteOffset,index.byteLength);
  const p=MeshoptEncoder.encodeVertexBufferLevel(positions,n,12,2,1);
  const four=new Float32Array(n*4);for(let i=0;i<n;i++){four[i*4]=normals[i*3];four[i*4+1]=normals[i*3+1];four[i*4+2]=normals[i*3+2];}
  const nb=MeshoptEncoder.encodeVertexBufferLevel(MeshoptEncoder.encodeFilterOct(four,n,8,16),n,8,2,1);
  const x=MeshoptEncoder.encodeIndexSequence(indexBytes,indices.length,size);
  // read each stream back: positions and indices byte for byte, normals within a hundredth of a degree
  const back=new Uint8Array(positions.length);MeshoptDecoder.decodeVertexBuffer(back,n,12,p);if(!Buffer.from(back).equals(Buffer.from(positions)))throw Error('Positions changed: '+id);
  const backIndex=new Uint8Array(indexBytes.length);MeshoptDecoder.decodeIndexSequence(backIndex,indices.length,size,x);if(!Buffer.from(backIndex).equals(Buffer.from(indexBytes)))throw Error('Triangles changed: '+id);
  const oct=new Int16Array(n*4);MeshoptDecoder.decodeVertexBuffer(new Uint8Array(oct.buffer),n,8,nb,'OCTAHEDRAL');
  for(let i=0;i<n;i++){const a=[oct[i*4],oct[i*4+1],oct[i*4+2]],b=[normals[i*3],normals[i*3+1],normals[i*3+2]],la=Math.hypot(...a),lb=Math.hypot(...b);
   if(!la||!lb)throw Error('Zero normal: '+id);worst=Math.max(worst,Math.acos(Math.min(1,(a[0]*b[0]+a[1]*b[1]+a[2]*b[2])/la/lb))*180/Math.PI);}
  meshes[id]={v:n,i:indices.length,s:size,p:blob(p),n:blob(nb),x:blob(x),...(g.groups?{g:g.groups.map(q=>[q.start,q.count,q.materialIndex])}:{})};
 }
 if(worst>.01)throw Error('Normals drifted '+worst+' degrees.');
 const header=Buffer.from(JSON.stringify({schema:'flan-geometry-1',meshes})),length=Buffer.alloc(4);length.writeUInt32LE(header.length);
 return {raw:Buffer.concat([length,header,...parts]),worst};
}
const geometryAssets={};let normalError=0;
for(const [name,ids] of [...chunks].sort(([a],[b])=>a<b?-1:1)){
 const {raw,worst}=geometryContainer(ids),bytes=deferredBinary('geometry-'+name,raw),digest=crypto.createHash('sha256').update(bytes).digest('hex'),file=`docs/explore/assets/geometry-${name}-${digest}.bin`;
 fs.writeFileSync(path.join(root,file),bytes);geometryAssets[name]={bytes,hash:digest,file,meshes:ids.length};normalError=Math.max(normalError,worst);
}
for(const f of fs.readdirSync(path.join(root,'docs/explore/assets')))
 if(/^geometry-[a-z0-9_-]+-[0-9a-f]{64}\.bin$/.test(f)&&!Object.values(geometryAssets).some(a=>path.basename(a.file)===f))fs.rmSync(path.join(root,'docs/explore/assets',f));
const {geometries:_meshes,...sceneRest}=scene;
const packedScene={...sceneRest,geometry:{index:geometryIndex,chunks:Object.fromEntries(Object.entries(geometryAssets).map(([name,a])=>[name,{url:`./assets/geometry-${name}-${a.hash}.bin`,sha256:a.hash,bytes:a.bytes.length}]))},
  geometryAliases:Object.fromEntries(Object.entries(geometryAliases).filter(([,id])=>geometryIndex[id])),printing:{url:`./assets/printing-${printHash}.bin`,sha256:printHash},
  silkscreen:{...scene.silkscreen,textures:{url:`./assets/silkscreen-${silkHash}.bin`,sha256:silkHash},thumbnails:{url:`./assets/silkthumbs-${thumbHash}.bin`,sha256:thumbHash}},variants,keycapAssets,...(fasteners?{fasteners}:{})};
// Online, the page fetches the scene's description as its own hashed file, then the meshes its design shows:
// the page stays small and text-only. The offline copy carries all of them inline.
const sceneBytes=deferred('scene',packedScene),sceneHash=crypto.createHash('sha256').update(sceneBytes).digest('hex');
const scenePath=`docs/explore/assets/scene-${sceneHash}.bin`;fs.writeFileSync(path.join(root,scenePath),sceneBytes);
for(const f of fs.readdirSync(path.join(root,'docs/explore/assets')))if(/^scene-[0-9a-f]{64}\.bin$/.test(f)&&f!==path.basename(scenePath))fs.rmSync(path.join(root,'docs/explore/assets',f));
// While a link to the home page's look loads its meshes, the explorer shows a picture of that look: its own
// frame, captured by viewer/explore-still.cjs at a desktop and a phone size. A picture made from other meshes,
// colours or lighting is left out until it is captured again.
const stillLook={size:homeLook.size,theme:homeLook.theme,case:homeLook.case,keys:homeLook.keys,frame:homeLook.frame.left===homeLook.frame.right?homeLook.frame.left:`${homeLook.frame.left},${homeLook.frame.right}`};
const stillPrint=crypto.createHash('sha256').update(JSON.stringify([stillLook,Object.entries(geometryAssets).map(([name,a])=>[name,a.hash]),['design/themes.json','design/frame-finishes.json','viewer/studio.js'].map(hash)])).digest('hex');
let still=null;const stillFiles=[];
try{
 if(JSON.parse(fs.readFileSync(path.join(here,'stills/stills.json'),'utf8')).fingerprint===stillPrint){
  still={look:stillLook};
  for(const shape of ['wide','tall']){const bytes=fs.readFileSync(path.join(here,'stills',shape+'.webp')),name=`still-${shape}-${crypto.createHash('sha256').update(bytes).digest('hex').slice(0,16)}.webp`;
   fs.writeFileSync(path.join(root,'docs/explore/assets',name),bytes);stillFiles.push(name);still[shape]='./assets/'+name;}
 }
}catch{still=null;}
for(const f of fs.readdirSync(path.join(root,'docs/explore/assets')))if(/^still-(wide|tall)-[0-9a-f]{16}\.webp$/.test(f)&&!(still&&stillFiles.includes(f)))fs.rmSync(path.join(root,'docs/explore/assets',f));
if(!still)console.warn('No current picture of the opening look: run viewer/explore-still.cjs, then build again.');
// the colour mark, inline: the viewer's CSP loads no external images. Its outline follows the page's theme.
const mark=fs.readFileSync(path.join(root,'docs/branding/flan/flan-mark-color.svg'),'utf8').replace(/<\?xml[^>]*>|<title>[^<]*<\/title>|<style>[^<]*<\/style>/g,'')
  .replace(/<svg[^>]*viewBox="([^"]+)"[^>]*>/,'<svg class="mark" viewBox="$1" aria-hidden="true">').trim();
// the home page's typefaces (latin subsets, about 140 KB): online, the home's own files, already cached from it;
// the offline copy carries them inline
const fonts=offline=>[['Fraunces','Fraunces-latin.woff2','300 500'],['Inter','Inter-latin.woff2','400 600'],['JetBrains Mono','JetBrainsMono-latin.woff2','400 500']]
  .map(([family,file,weight])=>`@font-face{font-family:"${family}";src:url(${offline?'data:font/woff2;base64,'+fs.readFileSync(path.join(here,'home/fonts',file)).toString('base64'):'../assets/fonts/'+file}) format("woff2");font-weight:${weight};font-display:swap}`).join('');
function page(offline){return template.replace('/*__FONTS__*/',()=>fonts(offline)).replace('/*__STYLE__*/',()=>fs.readFileSync(path.join(here,'style.css'),'utf8'))
 .replace('<!--__MARK__-->',()=>mark)
 .replaceAll('__OG_VERSION__',()=>hash('viewer/home/home-og.png').slice(0,12))   // sharing services cache the image by address
 .replace('<!--__LICENSES__-->',()=>credits+licenses)
 .replace('/*__DATA__*/',()=>offline?sceneBytes.toString('base64'):JSON.stringify({url:`./assets/scene-${sceneHash}.bin`,sha256:sceneHash}))
 .replace('/*__PRINT__*/',()=>offline?printBytes.toString('base64'):'')
 .replace('/*__SILK__*/',()=>offline?silkBytes.toString('base64'):'')
 .replace('/*__SILKTHUMBS__*/',()=>offline?thumbBytes.toString('base64'):'')
 .replace('/*__STILL__*/',()=>JSON.stringify(offline?null:still))
 .replace('/*__GEOMETRY__*/',()=>JSON.stringify(offline?Object.fromEntries(Object.entries(geometryAssets).map(([name,a])=>[name,a.bytes.toString('base64')])):{}))
 .replace('/*__VARIANTS__*/',()=>JSON.stringify(offline?Object.fromEntries([...Object.entries(variantAssets).map(([id,a])=>[id,a.bytes.toString('base64')]),...Object.entries(fastenerAssets).map(([id,a])=>['fasteners:'+id,a.bytes.toString('base64')])]):{}))
 .replace('href="../" id="nav-home"',()=>offline?'href="https://flankbd.com/" id="nav-home"':'href="../" id="nav-home"')
 .replace('/*__APP__*/',()=>bundle.outputFiles[0].text.replaceAll('</script','<\\/script'))
 .replaceAll('\r\n','\n');}
const html=page(false),offlineHtml=page(true);
new Script([...html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g)].at(-1)[1]);
fs.writeFileSync(path.join(root,'docs/explore/index.html'),html);
// The single-file offline copy is built here for the checks and published inside a ZIP: Git keeps one
// compressed binary instead of an 86 MB page of base64 (docs/explore/offline.html is ignored).
fs.writeFileSync(path.join(root,'docs/explore/offline.html'),offlineHtml);
const offlineZip=Buffer.from(zipSync({'Flan36-revI.html':[Buffer.from(offlineHtml),{level:6,mtime:new Date(2026,0,1)}]}));
fs.writeFileSync(path.join(root,'docs/explore/offline.zip'),offlineZip);
fs.writeFileSync(path.join(root,'docs/.nojekyll'),'');
const sources=[...scene.sources,...['viewer/app.js','viewer/build-guide.js','viewer/design-url.js','viewer/part-illustrations.js','viewer/build-package.js','design/build-parts.json','viewer/i18n.js','viewer/config.js','viewer/storage.js','viewer/history.js','viewer/assets.js','viewer/geometry.js','viewer/studio.js','viewer/home/options.js','viewer/keycap-colors.js','viewer/color-input.js','design/keycap-themes.json','viewer/appearance.js','viewer/printing.js','design/themes.json','viewer/explorer.js','viewer/previews.js','viewer/finishes.js','design/frame-finishes.json','viewer/style.css','viewer/template.html','viewer/build.mjs','viewer/home/tokens.js','docs/branding/flan/flan-mark-color.svg',...['Fraunces','Inter','JetBrainsMono'].map(f=>`viewer/home/fonts/${f}-latin.woff2`),...['flan36','flan42','flan46','flan54'].map(id=>`viewer/thumbs/size-${id}.webp`),'viewer/package-lock.json'].map(p=>({path:p,sha256:hash(p)}))];
const receipt={revision:scene.revision,units:'mm',objects:scene.parts.length,unique_meshes:Object.keys(scene.geometries).length,
  keycaps:scene.parts.filter(p=>p.group==='keycaps').length,geometry_changed:false,
  sources,viewer_sha256:hash('docs/explore/index.html'),measurements:scene.measurements,
  offline:'docs/explore/offline.zip holds the single-file offline copy, which embeds geometry, scripts, styles, deferred print files, silkscreen textures and licenses; docs/explore/offline.html is that file, built locally and not published. docs/explore/index.html fetches the hashed scene description and the meshes its design shows at start, other meshes when an option needs them, the print payload on export and the silkscreen textures when an edition is shown.',
  scene:{path:scenePath,sha256:sceneHash,bytes:sceneBytes.length},
  geometry:{method:'One file per option. Positions and triangle indices are stored exactly (meshopt vertex and index-sequence codecs, read back byte for byte at build time); normals as 16-bit octahedral vectors.',
   normal_error_deg:Number(normalError.toFixed(5)),published_meshes:Object.keys(geometryIndex).length,unpublished_meshes:Object.keys(unique).length-Object.keys(geometryIndex).length,
   bytes:Object.values(geometryAssets).reduce((n,a)=>n+a.bytes.length,0),
   chunks:Object.fromEntries(Object.entries(geometryAssets).map(([name,a])=>[name,{path:a.file,sha256:a.hash,bytes:a.bytes.length,meshes:a.meshes}]))},offline_zip:{path:'docs/explore/offline.zip',sha256:crypto.createHash('sha256').update(offlineZip).digest('hex'),bytes:offlineZip.length},
  still:{look:stillLook,fingerprint:stillPrint,published:still?stillFiles.map(f=>'docs/explore/assets/'+f):[]},
  build_assets:packageAssets,offline_sha256:hash('docs/explore/offline.html'),printing:{path:assetPath,sha256:printHash,bytes:printBytes.length},variants:Object.fromEntries(Object.entries(variantAssets).map(([id,a])=>[id,{path:a.file,sha256:a.hash,bytes:a.bytes.length}])),fasteners:Object.fromEntries(Object.entries(fastenerAssets).map(([id,a])=>[id,{path:a.file,sha256:a.hash,bytes:a.bytes.length}])),silkscreen:{path:silkPath,sha256:silkHash,bytes:silkBytes.length,editions:scene.silkscreen.editions.map(e=>e.id)},silk_thumbnails:{path:thumbPath,sha256:thumbHash,bytes:thumbBytes.length},geometry_aliases:Object.keys(geometryAliases).length,online_bytes:Buffer.byteLength(html),offline_bytes:Buffer.byteLength(offlineHtml),
  limitations:scene.limits};
fs.writeFileSync(path.join(root,`validation/rev${scene.revision}-viewer.json`),JSON.stringify(receipt,null,2)+'\n');
console.log(`Online viewer: ${(Buffer.byteLength(html)/1048576).toFixed(2)} MiB; ${scene.parts.length} objects; scene ${(sceneBytes.length/1024).toFixed(0)} KiB; meshes ${(receipt.geometry.bytes/1048576).toFixed(2)} MiB in ${Object.keys(geometryAssets).length} files.`);
// the home page at the site root, with its own small packs from the same scene
const {buildHome}=await import('./home-build.mjs');
const home=await buildHome({scene});
console.log(`Home: ${(home.page.bytes/1024).toFixed(0)} KiB page; packs ${Object.entries(home.bytes).map(([k,b])=>`${k} ${(b/1024).toFixed(0)} KiB`).join(', ')}.`);
