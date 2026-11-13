// SPDX-License-Identifier: GPL-3.0-or-later
import {zipSync,strToU8} from 'three/addons/libs/fflate.module.js';
import {pcbEdition,pcbMask,fastenersOf} from './config.js';
export const sha256=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
// Shared geometry loads may finish caching; cancelling must release this export immediately.
export function buildWait(work,signal){
 if(!signal)return work;
 return new Promise((resolve,reject)=>{
  const abort=()=>reject(signal.reason||new DOMException('Cancelled','AbortError'));
  const finish=fn=>value=>{signal.removeEventListener('abort',abort);fn(value);};
  signal.addEventListener('abort',abort,{once:true});
  work.then(finish(resolve),finish(reject));if(signal.aborted)abort();
 });
}
export async function buildFile(path,assets,signal){
 const asset=assets[path];if(!asset)throw Error('File unavailable: '+path);
 signal?.throwIfAborted();
 const controller=new AbortController(),abort=()=>controller.abort(),timer=setTimeout(abort,60000);
 signal?.addEventListener('abort',abort,{once:true});
 try{
  const response=await fetch(asset.url,{signal:controller.signal});if(!response.ok)throw Error('Download failed: '+path);
  const bytes=new Uint8Array(await response.arrayBuffer());signal?.throwIfAborted();
  if(bytes.length!==asset.bytes||await sha256(bytes)!==asset.sha256)throw Error('File mismatch: '+path);
  signal?.throwIfAborted();return bytes;
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
export async function completeBuild({configuration,assets,editions,print,guide,csv,catalog,signal,progress=()=>{}}){
 const config=structuredClone(configuration),variant=config.variant,files={},sources={},pcbs=[];
 const add=(name,bytes,source)=>{files[name]=typeof bytes==='string'?strToU8(bytes):bytes;if(source)sources[name]=source;};
 const requests=[];
 for(const side of ['left','right']){
  const edition=pcbEdition(config,side),spec=editions.find(e=>e.id===edition),source=(variant==='flan36'?spec.packages:spec.variants[variant])[side],file='PCB/'+source.split('/').pop();
  requests.push([file,source]);pcbs.push({side,edition,mask:pcbMask(config,side),file});
  requests.push(['Firmware/'+variant+'-'+side+'.uf2','firmware/uf2/'+variant+'-'+side+'.uf2']);
 }
 requests.push(['Firmware/optional/'+variant+'-right-no-display.uf2','firmware/uf2/'+variant+'-right-no-display.uf2']);
 for(const name of ['coupon-magnet-base','coupon-magnet-frame','coupon-m2-thread'])requests.push(['Fit-samples/'+name+'.stl','mechanical/revI/'+name+'.stl']);
 for(const path of ['LICENSE','LICENSES/CC-BY-SA-4.0.txt'])requests.push(['Licenses/'+path.split('/').pop(),path]);
 let done=0;progress('files',0,requests.length);
 // Bounded parallel downloads, each bound to the published source hash.
 for(let i=0;i<requests.length;i+=3)await Promise.all(requests.slice(i,i+3).map(async([name,source])=>{add(name,await buildFile(source,assets,signal),source);progress('files',++done,requests.length);}));
 signal?.throwIfAborted();progress('print');
 const kit=await print(config,{signal,progress:(i,n)=>progress('print',i,n)});
 if(kit.manifest.half!=='both'||kit.manifest.scope!=='complete'||kit.manifest.keycaps?.missing.length)throw Error('The complete print kit is missing parts.');
 add('Print-kit.zip',kit.bytes);
 // Include one physical sample of each selected cap shape alongside the coupons.
 const capIds=[...new Set(kit.manifest.keycaps.groups.map(g=>g.variant))];
 for(const id of capIds){const source=catalog.variants.find(v=>v.id===id).path;add('Fit-samples/'+source.split('/').pop(),await buildFile(source,assets,signal),source);}
 add('Shopping.csv',csv);add('Guide.html',await guide);add('Configuration.json',JSON.stringify(config,null,2)+'\n');
 add('PCB/ORDER.txt',pcbs.map(p=>p.side.toUpperCase()+': '+p.file.split('/').pop()+'\nEdition: '+p.edition+'\nSolder mask / Color: '+p.mask).join('\n\n')+'\n\n2 layers / capas; FR4; 1.6 mm; 1 oz; lead-free HASL / HASL sin plomo.\nNo assembly or stencil / Sin ensamblaje ni estencil.\nUpload as separate jobs / Subir como trabajos separados.\nOne left + one right per keyboard / Una izquierda + una derecha por teclado.\nColor is selected in the quote / El color se elige al cotizar.\n');
 add('READ-ME.txt','FLAN / COMPLETE BUILD / BUILD COMPLETO\n\nOpen Guide.html / Abre Guide.html\nShopping.csv: quantities and supplier links / cantidades y proveedores.\nPCB/: upload each ZIP separately; choose its color from ORDER.txt.\nPCB/: sube cada ZIP por separado; elige su color segun ORDER.txt.\nFirmware/: use the left and right UF2 for this size. The optional folder is only for a deliberately omitted right display.\nFirmware/: usa los UF2 izquierdo y derecho de este tamano. La carpeta optional solo aplica si omites la pantalla derecha.\nPrint-kit.zip: both halves, all selected parts and keycaps, STL + 3MF and placement plan.\nPrint-kit.zip: ambas mitades, piezas y keycaps elegidas, STL + 3MF y plan de colocacion.\nFit-samples/: print and check fit before the full kit / imprime y prueba antes del kit completo.\nConfiguration.json: reopen your design / vuelve a abrir tu diseno.\nmanifest.json: SHA-256 for every file / SHA-256 de cada archivo.\n\nDigital prototype. No printer profile or G-code. Physical fit and electrical operation require validation.\nPrototipo digital. Sin perfil de impresora ni G-code. Verifica ajuste fisico y funcionamiento electrico.\n\nFlan: Eduardo Ruiz, GPL-3.0-or-later. KLP Lame keycaps: braindefender, CC-BY-SA-4.0.\nhttps://flankbd.com/\n');
 signal?.throwIfAborted();progress('zip');
 const entries=await Promise.all(Object.entries(files).map(async([path,bytes])=>({path,bytes:bytes.length,sha256:await sha256(bytes),...(sources[path]?{source:sources[path]}:{})})));
 add('manifest.json',JSON.stringify({schema:'flan-build-1',variant,revision:config.revision,fasteners:fastenersOf(config),configuration:config,pcbs,files:entries},null,2)+'\n');
 signal?.throwIfAborted();
 return {bytes:zipSync(files,{level:6}),entries};
}
