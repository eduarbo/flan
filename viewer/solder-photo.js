// SPDX-License-Identifier: GPL-3.0-or-later
import pcb from '../design/pcb-options.json' with {type:'json'};

const photos=new Map();
const rgb=hex=>hex.slice(1).match(/../g).map(v=>parseInt(v,16));
const clamp=x=>Math.max(0,Math.min(1,x));

async function source(name){
 const image=new Image();
 image.src=globalThis.flanSolderAssets?.[name]||new URL('./assets/solder/'+name+'.webp',document.baseURI).href;
 await image.decode();
 return image;
}

// Keep the KiCad lighting, copper and plated contacts. Change only the solder mask
// and use the same manufacturer's Gerber ink texture that the explorer renders.
async function compose(size,side,back,edition,mask){
 const stem=size+'-'+side+'-',face=back?'bottom':'top';
 const baked=back&&size==='flan36'&&edition!=='base'&&mask==='green';
 const [board,ink]=await Promise.all([source(stem+(baked?edition+'-photo':face)),
  baked?null:source(stem+(back?edition:'top')+'-ink')]);
 const canvas=document.createElement('canvas');canvas.width=board.width;canvas.height=board.height;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 ctx.drawImage(board,0,0);
 if(ink){
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),data=pixels.data;
  ctx.drawImage(ink,0,0,canvas.width,canvas.height);
  const coverage=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  const spec=pcb.masks.find(m=>m.id===mask);
  const paint=rgb(spec.mask),print=rgb(spec.silk);
  for(let i=0;i<data.length;i+=4){
   if(!data[i+3])continue;
   const [r,g,b]=[data[i],data[i+1],data[i+2]];
   const laminate=mask==='green'?0:clamp((g-b-2)/15)*clamp((g-r+8)/20);
   const relief=(g-68)*.73+(r-33)*.27;
   const inkAlpha=coverage[i]/255;
   for(let c=0;c<3;c++){
    const coat=paint[c]+(mask==='white'?-relief*.55:relief);
    const color=data[i+c]*(1-laminate)+coat*laminate;
    data[i+c]=color*(1-inkAlpha)+print[c]*inkAlpha;
   }
  }
  ctx.putImageData(pixels,0,0);
 }
 return canvas.toDataURL('image/webp',.95);
}

export function solderPhoto(size,side,back,options={}){
 const saved=globalThis.flanSolderBuild;
 if(saved?.size===size)return Promise.resolve(saved.shots[side][back?'bottom':'top']);
 const edition=pcb.editions.find(e=>e.id===options.edition)?.id||pcb.default_edition;
 const mask=pcb.masks.find(m=>m.id===options.mask)?.id||pcb.default_mask;
 const key=[size,side,back?edition:'top',mask].join('/');
 if(!photos.has(key)){
  if(photos.size>=6)photos.delete(photos.keys().next().value);
  const shot=compose(size,side,back,edition,mask);
  photos.set(key,shot);shot.catch(()=>{if(photos.get(key)===shot)photos.delete(key);});
 }
 return photos.get(key);
}
