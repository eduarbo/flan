// SPDX-License-Identifier: GPL-3.0-or-later
import {t} from './i18n.js';
export function decodeBytes(text){
 if(Uint8Array.fromBase64)return Uint8Array.fromBase64(text);
 const binary=atob(text),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes;
}
export async function unpack(bytes){return JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text());}
// A variant container: gzip of [u32 header length][header JSON][blobs]; blobs hold raw STL bytes.
export async function unpackVariant(bytes){
 const data=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
 const n=new DataView(data.buffer).getUint32(0,true),header=JSON.parse(new TextDecoder().decode(data.subarray(4,4+n))),base=4+n;
 const blob=i=>data.subarray(base+header.blobs[i][0],base+header.blobs[i][0]+header.blobs[i][1]);
 for(const asset of Object.values(header.printing))asset.stl=blob(asset.blob);
 header.meshes=Object.fromEntries(Object.entries(header.meshes).map(([path,i])=>[path,blob(i)]));
 return header;
}
// kind names the payload in its messages: print files or silkscreen textures
export function printLoader(descriptor,embedded,decode=unpack,kind='print'){
 let pending;
 return ()=>pending??=(async()=>{
  let bytes;
  if(embedded.textContent.trim())bytes=decodeBytes(embedded.textContent);
  else{const response=await fetch(descriptor.url);if(!response.ok)throw Error(t('load.'+kind));bytes=new Uint8Array(await response.arrayBuffer());}
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
  if(digest!==descriptor.sha256)throw Error(t(`load.${kind}.mismatch`));
  return decode(bytes);
 })().catch(error=>{pending=null;throw error;});
}
