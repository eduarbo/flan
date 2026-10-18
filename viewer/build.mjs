// SPDX-License-Identifier: GPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {Script} from 'node:vm';
import {build} from 'esbuild';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.dirname(here);
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const scene=JSON.parse(fs.readFileSync(path.join(root,'build/viewer-scene.json'),'utf8'));
for(const item of scene.sources)if(hash(item.path)!==item.sha256)throw Error(`Stale input: ${item.path}`);
const bundle=await build({entryPoints:[path.join(here,'app.js')],bundle:true,write:false,minify:true,
  format:'iife',target:['es2020'],legalComments:'inline'});
const license=fs.readFileSync(path.join(here,'node_modules/three/LICENSE'),'utf8');
fs.writeFileSync(path.join(root,'LICENSES/Three-MIT.txt'),license);
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const licenses=[['LICENSE','Flan36 · GPL-3.0'],['LICENSES/CC-BY-SA-4.0.txt','Keycap meshes · CC-BY-SA-4.0'],['LICENSES/Three-MIT.txt','Three.js · MIT'],['LICENSES/fflate-MIT.txt','fflate · MIT'],['components/sources/KiSwitch-MIT.txt','KiSwitch · MIT']].map(([p,label])=>`<details class="option-group"><summary>${label}</summary><pre>${escape(fs.readFileSync(path.join(root,p),'utf8'))}</pre></details>`).join('');
const credits=`<dl class="credit-list">
<div><dt>Original keyboard &amp; CAD</dt><dd>Designed by Eduardo Ruiz. Piantor by beekeeb was an inspiration for the number of keys. Flan36 is not affiliated with beekeeb.</dd></div>
<div><dt>KLP Lamé keycaps</dt><dd>braindefender · CC-BY-SA-4.0. Original meshes, placed and colored. <a href="https://github.com/braindefender/KLP-Lame-Keycaps/tree/4a67a824232d3054c61599ea047c56a340faaba2">Pinned source ↗</a></dd></div>
<div><dt>Component models</dt><dd>KiSwitch Choc v1 · MIT. KiCad library models · CC-BY-SA-4.0 with library exception. <a href="https://github.com/eduarbo/flan/blob/main/components/README.md">Per-file sources &amp; changes ↗</a></dd></div>
<div><dt>Viewer libraries</dt><dd>Three.js 0.180.0 and fflate · MIT.</dd></div>
</dl><p><a href="https://github.com/eduarbo/flan/blob/main/ATTRIBUTION.md">All source notices and reference-file provenance ↗</a></p><h3>Full license texts</h3>`;
const template=fs.readFileSync(path.join(here,'template.html'),'utf8');
// Share byte-identical meshes without changing any vertex, normal or triangle.
const geometryAliases={},unique={},seen=new Map();
for(const [id,geometry] of Object.entries(scene.geometries)){
 const digest=crypto.createHash('sha256').update(JSON.stringify(geometry)).digest('hex');
 if(seen.has(digest))geometryAliases[id]=seen.get(digest);else{unique[id]=geometry;seen.set(digest,id);}
}
// Reuse a published asset with the same content: gzip bytes differ between zlib versions.
function deferred(prefix,value){
 const raw=Buffer.from(JSON.stringify(value)),dir=path.join(root,'docs/assets');fs.mkdirSync(dir,{recursive:true});
 for(const f of fs.readdirSync(dir).filter(f=>f.startsWith(prefix+'-')).sort()){
  const bytes=fs.readFileSync(path.join(dir,f));
  if(bytes.readUInt32LE(bytes.length-4)===raw.length%2**32&&gunzipSync(bytes).equals(raw))return bytes;
 }
 return gzipSync(raw,{level:9});
}
const printBytes=deferred('printing',scene.printing);
const printHash=crypto.createHash('sha256').update(printBytes).digest('hex');
const assetPath=`docs/assets/printing-${printHash}.bin`;fs.writeFileSync(path.join(root,assetPath),printBytes);
const silkBytes=deferred('silkscreen',scene.silkscreen.textures);
const silkHash=crypto.createHash('sha256').update(silkBytes).digest('hex');
const silkPath=`docs/assets/silkscreen-${silkHash}.bin`;fs.writeFileSync(path.join(root,silkPath),silkBytes);
// Only this build's deferred assets are published; earlier ones stay in Git history.
for(const f of fs.readdirSync(path.join(root,'docs/assets')))
 if(/^(printing|silkscreen)-[0-9a-f]{64}\.bin$/.test(f)&&!assetPath.endsWith(f)&&!silkPath.endsWith(f))fs.rmSync(path.join(root,'docs/assets',f));
const packedScene={...scene,geometries:unique,geometryAliases,printing:{url:`./assets/printing-${printHash}.bin`,sha256:printHash},
  silkscreen:{...scene.silkscreen,textures:{url:`./assets/silkscreen-${silkHash}.bin`,sha256:silkHash}}};
const packed=gzipSync(Buffer.from(JSON.stringify(packedScene)),{level:9}).toString('base64');
function page(offline){return template.replace('/*__STYLE__*/',()=>fs.readFileSync(path.join(here,'style.css'),'utf8'))
 .replace('<!--__LICENSES__-->',()=>credits+licenses)
 .replace('/*__DATA__*/',()=>packed)
 .replace('/*__PRINT__*/',()=>offline?printBytes.toString('base64'):'')
 .replace('/*__SILK__*/',()=>offline?silkBytes.toString('base64'):'')
 .replace('/*__APP__*/',()=>bundle.outputFiles[0].text.replaceAll('</script','<\\/script'))
 .replaceAll('\r\n','\n');}
const html=page(false),offlineHtml=page(true);
new Script([...html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g)].at(-1)[1]);
fs.writeFileSync(path.join(root,'docs/index.html'),html);
fs.writeFileSync(path.join(root,'docs/offline.html'),offlineHtml);
fs.writeFileSync(path.join(root,'docs/.nojekyll'),'');
const sources=[...scene.sources,...['viewer/app.js','viewer/config.js','viewer/storage.js','viewer/history.js','viewer/assets.js','viewer/keycap-colors.js','viewer/color-input.js','design/keycap-themes.json','viewer/appearance.js','viewer/printing.js','design/themes.json','viewer/explorer.js','viewer/previews.js','viewer/finishes.js','design/frame-finishes.json','viewer/style.css','viewer/template.html','viewer/build.mjs','viewer/package-lock.json'].map(p=>({path:p,sha256:hash(p)}))];
const receipt={revision:scene.revision,units:'mm',objects:scene.parts.length,unique_meshes:Object.keys(scene.geometries).length,
  keycaps:scene.parts.filter(p=>p.group==='keycaps').length,geometry_changed:false,
  sources,viewer_sha256:hash('docs/index.html'),measurements:scene.measurements,
  offline:'docs/offline.html embeds geometry, scripts, styles, deferred print files, silkscreen textures and licenses. docs/index.html fetches the hashed print payload on export and the silkscreen textures when an edition is shown.',
  offline_sha256:hash('docs/offline.html'),printing:{path:assetPath,sha256:printHash,bytes:printBytes.length},silkscreen:{path:silkPath,sha256:silkHash,bytes:silkBytes.length,editions:scene.silkscreen.editions.map(e=>e.id)},geometry_aliases:Object.keys(geometryAliases).length,online_bytes:Buffer.byteLength(html),offline_bytes:Buffer.byteLength(offlineHtml),
  limitations:scene.limits};
fs.writeFileSync(path.join(root,`validation/rev${scene.revision}-viewer.json`),JSON.stringify(receipt,null,2)+'\n');
console.log(`Online viewer: ${(Buffer.byteLength(html)/1048576).toFixed(2)} MiB; ${scene.parts.length} objects.`);
