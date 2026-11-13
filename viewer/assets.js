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
 for(const asset of Object.values(header.printing)){asset.stl=blob(asset.blob);for(const part of asset.material_parts||[])part.stl=blob(part.blob);}
 header.meshes=Object.fromEntries(Object.entries(header.meshes).map(([path,i])=>[path,blob(i)]));
 return header;
}
// A hashed file's bytes, checked against its hash. arrived(n) is told of each piece as it lands.
// kind names the payload in its messages: the scene, its meshes, print files or silkscreen textures
export async function verifiedBytes(descriptor,embedded,kind,arrived){
 let bytes;
 if(embedded)bytes=decodeBytes(embedded);
 else{
  const failed=()=>Error(t('load.'+kind));   // a network failure reads like a missing file
  const response=await fetch(descriptor.url).catch(()=>null);if(!response?.ok)throw failed();
  if(arrived&&response.body){
   const reader=response.body.getReader(),pieces=[];let length=0;
   for(;;){const {done,value}=await reader.read().catch(()=>{throw failed();});if(done)break;pieces.push(value);length+=value.length;arrived(value.length);}
   bytes=new Uint8Array(length);let at=0;for(const piece of pieces){bytes.set(piece,at);at+=piece.length;}
  }else bytes=new Uint8Array(await response.arrayBuffer().catch(()=>{throw failed();}));
 }
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
 if(digest!==descriptor.sha256)throw Error(t(`load.${kind}.mismatch`));
 return bytes;
}
export async function gunzip(bytes){return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());}
export function printLoader(descriptor,embedded,decode=unpack,kind='print'){
 let pending;
 return ()=>pending??=verifiedBytes(descriptor,embedded.textContent.trim(),kind).then(decode).catch(error=>{pending=null;throw error;});
}
