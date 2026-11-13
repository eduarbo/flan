// SPDX-License-Identifier: GPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {Script} from 'node:vm';
import {build} from 'esbuild';
import {zipSync} from 'three/addons/libs/fflate.module.js';

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
const licenses=[['LICENSE','Flan36 · GPL-3.0'],['LICENSES/CC-BY-SA-4.0.txt','Keycap meshes · CC-BY-SA-4.0','credits.meshes'],['LICENSES/Three-MIT.txt','Three.js · MIT'],['LICENSES/fflate-MIT.txt','fflate · MIT'],['components/sources/KiSwitch-MIT.txt','KiSwitch · MIT']].map(([p,label,key])=>`<details class="option-group"><summary${key?` data-t="${key}"`:''}>${label}</summary><pre>${escape(fs.readFileSync(path.join(root,p),'utf8'))}</pre></details>`).join('');
const credits=`<dl class="credit-list">
<div><dt data-t="credits.keyboard">Original keyboard &amp; CAD</dt><dd data-t="credits.keyboardText">Designed by Eduardo Ruiz. Inspired by Piantor by beekeeb, whose 36 key positions and angles it keeps (GPL-3.0); the PCBs, case outline, cases, frames and firmware are original. Flan36 is not affiliated with beekeeb.</dd></div>
<div><dt data-t="credits.klp">KLP Lamé keycaps</dt><dd data-t="credits.keycaps">braindefender · CC-BY-SA-4.0. Original meshes, placed and colored. <a href="https://github.com/braindefender/KLP-Lame-Keycaps/tree/4a67a824232d3054c61599ea047c56a340faaba2" data-t="credits.pinned">Pinned source ↗</a></dd></div>
<div><dt data-t="credits.components">Component models</dt><dd data-t="credits.componentsText">KiSwitch Choc v1 · MIT. KiCad library models · CC-BY-SA-4.0 with library exception. <a href="https://github.com/eduarbo/flan/blob/main/components/README.md" data-t="credits.changes">Per-file sources &amp; changes ↗</a></dd></div>
<div><dt data-t="credits.libraries">Viewer libraries</dt><dd data-t="credits.librariesText">Three.js 0.180.0 and fflate · MIT.</dd></div>
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
const variants=Object.fromEntries(Object.entries(scene.variants||{}).map(([id,{printing,meshes,silkscreen,...rest}])=>
 [id,{...(variantAssets[id]?{...rest,asset:{url:`./assets/variant-${id}-${variantAssets[id].hash}.bin`,sha256:variantAssets[id].hash}}:rest),thumb:thumb(id)}]));
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
const current=new Set([assetPath,silkPath,...Object.values(variantAssets).map(a=>a.file),...Object.values(fastenerAssets).map(a=>a.file),...keycapFiles].map(p=>path.basename(p)));
for(const f of fs.readdirSync(path.join(root,'docs/explore/assets')))
 if(/^(printing|silkscreen|variant-[a-z0-9]+|fasteners-[a-z0-9-]+|keycap-[a-z0-9_]+)-[0-9a-f]{64}\.bin$/.test(f)&&!current.has(f))fs.rmSync(path.join(root,'docs/explore/assets',f));
const packedScene={...scene,geometries:unique,geometryAliases,printing:{url:`./assets/printing-${printHash}.bin`,sha256:printHash},
  silkscreen:{...scene.silkscreen,textures:{url:`./assets/silkscreen-${silkHash}.bin`,sha256:silkHash}},variants,keycapAssets,...(fasteners?{fasteners}:{})};
// Online, the page fetches the scene as its own hashed file, like the other deferred assets: the page stays
// small and text-only. The offline copy still carries it inline.
const sceneBytes=deferred('scene',packedScene),sceneHash=crypto.createHash('sha256').update(sceneBytes).digest('hex');
const scenePath=`docs/explore/assets/scene-${sceneHash}.bin`;fs.writeFileSync(path.join(root,scenePath),sceneBytes);
for(const f of fs.readdirSync(path.join(root,'docs/explore/assets')))if(/^scene-[0-9a-f]{64}\.bin$/.test(f)&&f!==path.basename(scenePath))fs.rmSync(path.join(root,'docs/explore/assets',f));
// the colour mark, inline: the viewer's CSP loads no external images. Its outline follows the page's theme.
const mark=fs.readFileSync(path.join(root,'docs/branding/flan/flan-mark-color.svg'),'utf8').replace(/<\?xml[^>]*>|<title>[^<]*<\/title>|<style>[^<]*<\/style>/g,'')
  .replace(/<svg[^>]*viewBox="([^"]+)"[^>]*>/,'<svg class="mark" viewBox="$1" aria-hidden="true">').trim();
// the home page's typefaces (latin subsets, about 140 KB): online, the home's own files, already cached from it;
// the offline copy carries them inline
const fonts=offline=>[['Fraunces','Fraunces-latin.woff2','300 500'],['Inter','Inter-latin.woff2','400 600'],['JetBrains Mono','JetBrainsMono-latin.woff2','400 500']]
  .map(([family,file,weight])=>`@font-face{font-family:"${family}";src:url(${offline?'data:font/woff2;base64,'+fs.readFileSync(path.join(here,'home/fonts',file)).toString('base64'):'../assets/fonts/'+file}) format("woff2");font-weight:${weight};font-display:swap}`).join('');
function page(offline){return template.replace('/*__FONTS__*/',()=>fonts(offline)).replace('/*__STYLE__*/',()=>fs.readFileSync(path.join(here,'style.css'),'utf8'))
 .replace('<!--__MARK__-->',()=>mark)
 .replace('<!--__LICENSES__-->',()=>credits+licenses)
 .replace('/*__DATA__*/',()=>offline?sceneBytes.toString('base64'):JSON.stringify({url:`./assets/scene-${sceneHash}.bin`,sha256:sceneHash}))
 .replace('/*__PRINT__*/',()=>offline?printBytes.toString('base64'):'')
 .replace('/*__SILK__*/',()=>offline?silkBytes.toString('base64'):'')
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
const sources=[...scene.sources,...['viewer/app.js','viewer/build-guide.js','viewer/design-url.js','viewer/part-illustrations.js','viewer/build-package.js','design/build-parts.json','viewer/i18n.js','viewer/config.js','viewer/storage.js','viewer/history.js','viewer/assets.js','viewer/keycap-colors.js','viewer/color-input.js','design/keycap-themes.json','viewer/appearance.js','viewer/printing.js','design/themes.json','viewer/explorer.js','viewer/previews.js','viewer/finishes.js','design/frame-finishes.json','viewer/style.css','viewer/template.html','viewer/build.mjs','viewer/home/tokens.js','docs/branding/flan/flan-mark-color.svg',...['Fraunces','Inter','JetBrainsMono'].map(f=>`viewer/home/fonts/${f}-latin.woff2`),...['flan36','flan42','flan46','flan54'].map(id=>`viewer/thumbs/size-${id}.webp`),'viewer/package-lock.json'].map(p=>({path:p,sha256:hash(p)}))];
const receipt={revision:scene.revision,units:'mm',objects:scene.parts.length,unique_meshes:Object.keys(scene.geometries).length,
  keycaps:scene.parts.filter(p=>p.group==='keycaps').length,geometry_changed:false,
  sources,viewer_sha256:hash('docs/explore/index.html'),measurements:scene.measurements,
  offline:'docs/explore/offline.zip holds the single-file offline copy, which embeds geometry, scripts, styles, deferred print files, silkscreen textures and licenses; docs/explore/offline.html is that file, built locally and not published. docs/explore/index.html fetches the hashed scene at start, the print payload on export and the silkscreen textures when an edition is shown.',
  scene:{path:scenePath,sha256:sceneHash,bytes:sceneBytes.length},offline_zip:{path:'docs/explore/offline.zip',sha256:crypto.createHash('sha256').update(offlineZip).digest('hex'),bytes:offlineZip.length},
  build_assets:packageAssets,offline_sha256:hash('docs/explore/offline.html'),printing:{path:assetPath,sha256:printHash,bytes:printBytes.length},variants:Object.fromEntries(Object.entries(variantAssets).map(([id,a])=>[id,{path:a.file,sha256:a.hash,bytes:a.bytes.length}])),fasteners:Object.fromEntries(Object.entries(fastenerAssets).map(([id,a])=>[id,{path:a.file,sha256:a.hash,bytes:a.bytes.length}])),silkscreen:{path:silkPath,sha256:silkHash,bytes:silkBytes.length,editions:scene.silkscreen.editions.map(e=>e.id)},geometry_aliases:Object.keys(geometryAliases).length,online_bytes:Buffer.byteLength(html),offline_bytes:Buffer.byteLength(offlineHtml),
  limitations:scene.limits};
fs.writeFileSync(path.join(root,`validation/rev${scene.revision}-viewer.json`),JSON.stringify(receipt,null,2)+'\n');
console.log(`Online viewer: ${(Buffer.byteLength(html)/1048576).toFixed(2)} MiB; ${scene.parts.length} objects.`);
// the home page at the site root, with its own small packs from the same scene
const {buildHome}=await import('./home-build.mjs');
const home=await buildHome({scene});
console.log(`Home: ${(home.page.bytes/1024).toFixed(0)} KiB page; packs ${Object.entries(home.bytes).map(([k,b])=>`${k} ${(b/1024).toFixed(0)} KiB`).join(', ')}.`);
