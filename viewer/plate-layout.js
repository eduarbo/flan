// SPDX-License-Identifier: GPL-3.0-or-later
import {printerFor} from './printer-presets.js';

const layerGap=6,edge=8,front=32;
const byArea=(a,b)=>b.size[0]*b.size[1]-a.size[0]*a.size[1];
const covers=(a,b)=>a.x<=b.x&&a.y<=b.y&&a.r>=b.r&&a.t>=b.t;

// Subtract a used rectangle from every maximal free rectangle. The remainders
// can overlap each other, but none can overlap anything already placed.
function subtract(free,box){
 const next=[];
 for(const a of free){
  if(a.r<=box.x||box.r<=a.x||a.t<=box.y||box.t<=a.y){next.push(a);continue;}
  if(a.x<box.x)next.push({...a,r:box.x});
  if(a.r>box.r)next.push({...a,x:box.r});
  if(a.y<box.y)next.push({...a,t:box.y});
  if(a.t>box.t)next.push({...a,y:box.t});
 }
 return next.filter((a,i)=>!next.some((b,j)=>i!==j&&covers(b,a)&&(!covers(a,b)||j<i)));
}

function pack(parts,area,gap,tower,rows=false){
 // Expand the far edges by the gap so the final part only pays the bed margin.
 let free=[{...area,r:area.r+gap,t:area.t+gap}];
 if(tower)free=subtract(free,tower);
 const items=[];
 for(const object of parts){
  const pad=object.name.endsWith('-display-sled')?8:object.family==='Keycaps'&&!object.members?2:0;
  let best=null;
  for(const a of free)for(const turned of [false,true]){
   const w=object.size[turned?1:0]+2*pad+gap,h=object.size[turned?0:1]+2*pad+gap;
   const dx=a.r-a.x-w,dy=a.t-a.y-h;
   if(dx<0||dy<0)continue;
   const score=rows?(a.y+h)*1e6+a.x:Math.min(dx,dy)*1e6+Math.max(dx,dy);
   if(!best||score<best.score)best={x:a.x,y:a.y,r:a.x+w,t:a.y+h,score,turned};
  }
  if(!best)return null;
  items.push({object,x:best.x+pad,y:best.y+pad,turned:best.turned});
  free=subtract(free,best);
 }
 return items;
}

// Estimate recurring changes from the printed height of each filament, including
// the shallow face-down inlays. Object sequence only changes at color boundaries.
function makePlate(parts,context){
 const {area,mode,machine,tower,layerHeight}=context;
 const heights=new Map();
 for(const part of parts)for(const [slot,z] of part.heights)heights.set(slot,Math.max(z,heights.get(slot)||0));
 if(heights.size>(mode==='manual'?1:4))return null;
 const mixed=heights.size>1,sorted=[...parts].sort(byArea);
 let best=null;
 function consider(sequence,gap,changes,keepout){
  const items=pack(sorted,area,gap,keepout);
  if(!items)return;
  if(sequence==='by object')items.sort((a,b)=>a.object.slots[0]-b.object.slots[0]||a.y-b.y||a.x-b.x);
  // A fresh plate costs a bed change, warm-up and first-layer setup. Express
  // that fixed cost in equivalent changes; this is a ranking, not a time quote.
  const score=(context.plateCost||12)+changes+(mode==='object'&&mixed&&sequence==='by layer'?6:0);
  if(!best||score<best.score)best={parts,items,slots:new Set(heights.keys()),sequence,score};
 }
 const z=[...heights.values()];
 const changes=(z.reduce((sum,h)=>sum+h,0)-Math.max(...z))/layerHeight;
 consider('by layer',layerGap,changes,mixed?tower:null);
 if(mixed&&machine&&parts.every(part=>part.slots.length===1&&part.size[2]+1<machine.gantryHeight)){
  consider('by object',machine.headRadius+2,heights.size-1,null);
 }
 return best;
}

function planBatch(parts,context){
 // Try large-first, small-first and color-first orders. Each insertion can change
 // its sequence, including reverting a sequential plate to dense layer printing.
 let winner=null;
 for(const order of [[...parts].sort(byArea),[...parts].sort((a,b)=>byArea(b,a)),[...parts].sort((a,b)=>b.slots.length-a.slots.length||a.slots[0]-b.slots[0]||byArea(a,b))]){
  const plates=[];
  for(const part of order){
   const single=makePlate([part],context);
   if(!single)throw Object.assign(Error('Part exceeds the selected plate or filament capacity: '+part.name),{code:'part-fit'});
   let choice=single,target=plates.length,delta=single.score;
   for(const [i,plate] of plates.entries()){
    const merged=makePlate([...plate.parts,part],context);
    if(merged&&merged.score-plate.score<delta){choice=merged;target=i;delta=merged.score-plate.score;}
   }
   plates[target]=choice;
  }
  const score=plates.reduce((sum,p)=>sum+p.score,0);
  if(!winner||score<winner.score)winner={score,plates};
 }
 return winner.plates;
}

// Bambu treats a multipart group as one sequential object. Keys on the same
// spool can share that group's layers; only groups need full head clearance.
function groupedKeys(keys,context){
 const {machine,mode,area}=context;
 if(!machine||mode==='manual'||keys.some(key=>key.size[2]+1>=machine.gantryHeight))return null;
 const colors=new Map();
 for(const key of keys){
  const slot=key.slots[0];
  if(!colors.has(slot))colors.set(slot,[]);
  colors.get(slot).push(key);
 }
 if(colors.size<2||colors.size>4)return null;
 const gap=machine.headRadius+2,width=area.r-area.x,height=area.t-area.y;
 const choices=[];
 for(const [slot,unsorted] of colors){
  const parts=unsorted.sort(byArea),z=Math.max(...parts.map(p=>p.size[2])),shapes=[];
  const stride=Math.max(...parts.map(p=>Math.max(p.size[0],p.size[1])))+layerGap+4;
  for(let cols=1;cols<=Math.ceil(width/stride)+1;cols++){
   const items=pack(parts,{x:0,y:0,r:Math.min(width,cols*stride),t:height},layerGap,null,true);
   if(!items)continue;
   const w=Math.max(...items.map(i=>i.x+i.object.size[i.turned?1:0]+2));
   const h=Math.max(...items.map(i=>i.y+i.object.size[i.turned?0:1]+2));
   if(shapes.some(o=>o.size[0]===w&&o.size[1]===h))continue;
   shapes.push({name:'Keycaps',family:'Keycaps',size:[w,h,z],slots:[slot],members:items});
  }
  if(!shapes.length)return null;
  choices.push(shapes.sort((a,b)=>a.size[0]*a.size[1]-b.size[0]*b.size[1]));
 }
 function fit(groups){
  if(groups.length<choices.length){
   for(const shape of choices[groups.length]){
    const result=fit([...groups,shape]);if(result)return result;
   }
   return null;
  }
  return pack([...groups].sort(byArea),area,gap,null);
 }
 const items=fit([]);
 if(!items)return null;
 items.sort((a,b)=>a.object.slots[0]-b.object.slots[0]);
 return {parts:keys,items,slots:new Set(colors.keys()),sequence:'by object',score:12+colors.size-1};
}

export function planPlates(objects,setup){
 const {mode,bed}=setup,machine=printerFor(setup.printer);
 const area={x:edge+(machine?.leftInset||0),y:front,r:bed-edge,t:bed-edge};
 // Keep the prime tower and its brim on the common nozzle area at the rear.
 const tower={x:bed-78,y:bed-78,r:bed,t:bed};
 const layerHeight=parseFloat(machine?.nozzles[setup.nozzle]?.process)||0.2;
 const context={area,mode,machine,tower,layerHeight};
 const hardware=[],caps=[];
 for(const object of objects){
  const batch=object.family==='Keycaps'?caps:hardware;
  for(let i=0;i<object.count;i++)batch.push(object);
 }
 // Keycaps are individually single-color. Compare a sequential layout with
 // single-spool plates so a dense bed never forces recurring changes by layer.
 const singleSpool={...context,mode:'manual'};
 const allowGroups=mode!=='manual'&&!setup.split_keycaps;
 const clustered=allowGroups?groupedKeys(caps,context):null;
 const keyPlates=clustered?[clustered]:planBatch(caps,singleSpool);
 if(allowGroups&&!clustered){
  for(let i=0;i<keyPlates.length;i++)for(let j=i+1;j<keyPlates.length;){
   const joined=groupedKeys([...keyPlates[i].parts,...keyPlates[j].parts],context);
   if(joined){keyPlates[i]=joined;keyPlates.splice(j,1);}else j++;
  }
 }
 let plates=[...planBatch(hardware,context),...keyPlates];
 if(mode==='manual'&&hardware.length&&caps.length){
  const shared=planBatch([...hardware,...caps],context);
  if(shared.length<plates.length)plates=shared;
 }
 // A generic machine can still export many individually colored keys in a
 // single project if separating them would exceed Studio's 36-plate limit.
 if(plates.length>36&&allowGroups){
  const compact={...context,plateCost:10000};
  const fallback=[...planBatch(hardware,compact),...planBatch(caps,compact)];
  if(fallback.length<plates.length)plates=fallback;
 }
 if(plates.length>36)throw Object.assign(Error('Bambu Studio: 36 plates maximum. Export one half or use fewer colors. / Máximo 36 placas. Exporta una mitad o usa menos colores.'),{code:'plate-limit'});
 for(const plate of plates){
  const families=new Set(plate.parts.map(p=>p.family));
  plate.family=families.size===1?[...families][0]:families.has('Keycaps')?'Case + keycaps':'Case parts';
 }
 return {plates,towerX:tower.x+10,towerY:tower.y+10};
}
