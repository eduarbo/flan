// SPDX-License-Identifier: GPL-3.0-or-later
import {planPlates} from './plate-layout.js';
import {projectEntries,projectObject,projectSetup} from './project-objects.js';
import {language,t} from './i18n.js';

const families={'Bases':'bases','Switch plates':'switch','Display frames':'frames','Internal parts':'internals','Keycaps':'caps','Case parts':'case','Case + keycaps':'mixed'};
function element(tag,cls,text){
 const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;
}
function sample(color){
 const el=element('i','pp-sample');el.style.backgroundColor=color;el.setAttribute('aria-hidden','true');return el;
}
function partLabel(obj){
 if(obj.family==='Keycaps')return obj.part.label;
 const side=t('side.'+obj.part.side);
 const name=obj.name.replace(/^(left|right)-/,'');
 const type=name.startsWith('case-')?(name.endsWith('-base')?'base':'plate'):name.startsWith('frame-')?'frame':name.startsWith('washer-')?'washer':name;
 return t('pp.part.'+type)+(type==='washer'?' H'+name.split('-').at(-1):'')+' · '+side;
}
function sprite(shape,colors){
 const bitmap=document.createElement('canvas');bitmap.width=shape.width;bitmap.height=shape.height;
 const ctx=bitmap.getContext('2d'),image=ctx.createImageData(shape.width,shape.height),pixels=atob(shape.pixels);
 const rgb=colors.map(hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)));
 for(let i=0;i<pixels.length;i++){
  const texel=pixels.charCodeAt(i)-1;if(texel<0)continue;
  const color=rgb[Math.floor(texel/48)],light=.53+.49*(texel%48)/46;
  for(let c=0;c<3;c++)image.data[4*i+c]=color[c]*light;
  image.data[4*i+3]=255;
 }
 ctx.putImageData(image,0,0);return bitmap;
}

function drawBed(canvas,plate,bed,spools,images,selected){
 const ctx=canvas.getContext('2d'),scale=canvas.width/bed;
 ctx.setTransform(scale,0,0,scale,0,0);ctx.fillStyle='#e8e8df';ctx.fillRect(0,0,bed,bed);
 for(let mm=10;mm<bed;mm+=10){
  ctx.lineWidth=mm%50===0?.5:.24;ctx.strokeStyle=mm%50===0?'#b4b7aa':'#c7cabe';ctx.beginPath();
  ctx.moveTo(mm,0);ctx.lineTo(mm,bed);ctx.moveTo(0,bed-mm);ctx.lineTo(bed,bed-mm);ctx.stroke();
 }
 ctx.translate(0,bed);ctx.scale(1,-1);
 if(plate.sequence==='by layer'&&plate.slots.size>1){
  ctx.save();ctx.fillStyle='rgba(88,98,88,.12)';ctx.strokeStyle='#68715f';ctx.lineWidth=.65;ctx.setLineDash([2,1.6]);
  ctx.fillRect(bed-78,bed-78,78,78);ctx.strokeRect(bed-78,bed-78,78,78);ctx.restore();
 }
 function draw({object,x,y,turned}){
  const [w,h]=object.size;ctx.save();ctx.translate(x+(turned?h:0),y);if(turned)ctx.rotate(Math.PI/2);
  if(object.members)object.members.forEach(draw);
  else{
   if(selected&&selected!==object)ctx.globalAlpha=.2;
   if(!images.has(object))images.set(object,sprite(object.shape,object.materialSlots.map(slot=>spools[slot].color)));
   ctx.translate(0,h);ctx.scale(1,-1);ctx.shadowColor='rgba(28,30,23,.45)';ctx.shadowBlur=1.25;ctx.drawImage(images.get(object),0,0,w,h);
  }
  ctx.restore();
 }
 plate.items.forEach(draw);
}

export function createPlatePreview({$,getConfig,selection,loadShapes,entriesFor,setSplit}){
 const root=$('print-plate-plan'),host=$('plate-content'),status=$('plate-status');
 let visible=false,index=0,current='',revision=0,plan=null;
 const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible)sync();},{rootMargin:'120px'});
 observer.observe(root);
 for(const button of $('plate-policy').querySelectorAll('button'))button.onclick=()=>setSplit(button.dataset.split==='true');
 $('plate-retry').onclick=()=>{current='';sync();};
 function render(focus=false){
  const {plates,spools,setup}=plan,p=plates[index],seq=t(p.sequence==='by object'?'print.sequential':'print.layers');
  const nav=element('div','pp-nav');nav.setAttribute('role','group');nav.setAttribute('aria-label',t('pp.choose'));
  plates.forEach((plate,i)=>{
   const b=element('button','',t('pp.plate',{n:i+1}));b.type='button';b.setAttribute('aria-pressed',String(i===index));b.dataset.plate=String(i+1);b.setAttribute('aria-label',t('pp.plate',{n:i+1})+' · '+t('print.family.'+families[plate.family]));
   b.onclick=()=>{index=i;render(true);};nav.append(b);
  });
  const card=element('div','pp-card'),caption=element('div','pp-caption');
  const identity=element('div');
  const facts=element('p','pp-facts',t('print.objects',{n:p.parts.length})+' · '+t(p.slots.size===1?'pp.oneSpool':'pp.spools',{n:p.slots.size}));
  identity.append(element('h4','',t('print.family.'+families[p.family])),facts);
  caption.append(identity,element('span','pp-seq',seq));
  const figure=element('div','pp-figure'),canvas=element('canvas');canvas.width=canvas.height=640;
  canvas.setAttribute('role','img');canvas.setAttribute('aria-label',t('pp.alt',{plate:index+1,bed:setup.bed,n:p.parts.length,seq}));const images=new Map();drawBed(canvas,p,setup.bed,spools,images);
  figure.append(canvas);
  const body=element('div','pp-body');
  const reason=p.slots.size===1?'mono':p.sequence==='by object'?'groups':'tower';
  const frameDown=p.parts.some(part=>part.family==='Display frames'&&part.slots.length>1);
  const note=element('p','pp-reason',t('pp.'+reason)+(frameDown?' '+t('pp.frameDown'):''));
  const palette=element('ul','pp-palette');
  for(const slot of p.slots){
   const spool=spools[slot],li=element('li'),words=element('span'),name=spool.label.split(' · ');
   words.append(element('strong','',name.at(-1)));if(name.length>1)words.append(element('small','',name[0]));
   li.append(sample(spool.color),words);palette.append(li);
  }
  const detail=element('details','pp-parts'),summary=element('summary','',t('pp.parts')),list=element('ul');
  let selected=null;
  const counts=new Map();for(const part of p.parts)counts.set(part,(counts.get(part)||0)+1);
  detail.open=counts.size<=6;
  for(const [obj,count] of counts){
   const row=element('li'),marks=element('span','pp-part-colors');
   for(const id of obj.slots){const swatch=sample(spools[id].color);swatch.title=spools[id].label;marks.append(swatch);}
   const button=element('button','pp-part');button.type='button';button.setAttribute('aria-pressed','false');
   button.setAttribute('aria-label',partLabel(obj)+' ×'+count+' · '+obj.slots.map(s=>spools[s].label).join(', '));
   button.append(marks,element('span','',partLabel(obj)),element('small','','×'+count));row.append(button);list.append(row);
   button.onclick=()=>{
    selected=selected===obj?null:obj;
    for(const other of list.querySelectorAll('button'))other.setAttribute('aria-pressed',String(!!selected&&other===button));
    drawBed(canvas,p,setup.bed,spools,images,selected);
   };
  }
  detail.append(summary,list);body.append(note,palette,detail);card.append(caption,figure,body);host.replaceChildren(nav,card);
  host.hidden=false;status.hidden=true;
  if(focus){const b=nav.children[index];b.focus({preventScroll:true});nav.scrollLeft=Math.max(0,b.offsetLeft-(nav.clientWidth-b.offsetWidth)/2);}
 }
 async function sync(){
  const c=getConfig(),{scope,half}=selection(),setup=projectSetup(c);
  const key=JSON.stringify([c.variant,c.cases,c.frames,c.filaments,c.part_filaments,c.keycaps,c.fasteners,setup,half,scope,language()]);
  if(current===key)return;
  const ticket=++revision;plan=null;host.hidden=true;status.hidden=false;status.textContent=t('pp.loading');$('plate-retry').hidden=true;
  $('quick-contents').textContent=t('kit.'+scope)+' · '+t(half==='both'?'seg.both':'side.'+half);
  $('plate-bed').textContent=[setup.printer,setup.bed+' × '+setup.bed+' mm'].filter(Boolean).join(' · ');
  $('plate-policy').hidden=scope==='shells'||setup.mode==='manual';
  const policies=[...$('plate-policy').querySelectorAll('button')];
  for(const b of policies){
   b.disabled=false;
   b.setAttribute('aria-pressed',String((b.dataset.split==='true')===Boolean(setup.split_keycaps)));
   b.textContent=t(b.dataset.split==='true'?'pp.separate':'pp.auto');
  }
  if(!visible&&!$('quick-print').open){current='';return;}
  current=key;
  try{
   const atlas=await loadShapes();if(ticket!==revision)return;
   const {parts,groups}=entriesFor(c,half,scope,atlas),spools=[];
   const objects=projectEntries(parts,groups).map(entry=>{
    const p=entry.part,shape=atlas.shapes[p.variant||(p.material_parts?.length?'art/':'')+(p.print_path||p.path)];
    const obj=projectObject(entry,shape.materials,spools,c);obj.shape=shape;return obj;
   });
   const {plates}=planPlates(objects,setup);
   if(!$('plate-policy').hidden)for(const b of policies){
    const split=b.dataset.split==='true';
    try{
     const count=split===Boolean(setup.split_keycaps)?plates.length:planPlates(objects,{...setup,split_keycaps:split}).plates.length;
     b.append(element('small','pp-count',t(count===1?'pp.onePlate':'pp.count',{n:count})));
     b.disabled=false;
    }catch{b.disabled=true;}
   }
   index=Math.min(index,plates.length-1);plan={plates,spools,setup};render();
  }catch(e){
   if(ticket!==revision)return;
   host.hidden=true;status.hidden=false;status.textContent=t(e.code==='plate-limit'?'pp.limit':e.code==='part-fit'?'pp.fit':'pp.failed');$('plate-retry').hidden=Boolean(e.code==='plate-limit'||e.code==='part-fit');
  }
 }
 return {sync};
}
