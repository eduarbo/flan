// SPDX-License-Identifier: GPL-3.0-or-later
import {solderPhoto} from './solder-photo.js';

// Capture the chosen build once. A saved guide needs only its four actual PCB faces.
export async function portableSolder(size,language,state,appearance){
 const shots=Object.fromEntries(await Promise.all(['left','right'].map(async side=>{
  const [top,bottom]=await Promise.all([false,true].map(back=>solderPhoto(size,side,back,appearance[side])));
  return [side,{top,bottom}];
 })));
 const query=new URLSearchParams({size,lang:language,...state});
 for(const side of ['left','right']){
  for(const [field,suffix] of [['edition','Edition'],['mask','Mask']]){
   const value=appearance[side]?.[field];if(value)query.set(side+suffix,value);
  }
 }
 const engine=globalThis.flanSolderApp||document.querySelector('script[data-solder-app]').textContent;
 const data=JSON.stringify({size,shots,query:String(query)}).replaceAll('<','\\u003c');
 const scripts='<script>globalThis.flanSolderBuild='+data+';</script><script data-solder-app>'+engine.replaceAll('</script','<\\/script')+'</script>';
 const html='<!doctype html><html lang="'+language+'"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Flan · Solder / Soldar</title><main id="guide"></main>'+scripts+'</html>';
 return {html,scripts};
}
