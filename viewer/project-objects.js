// SPDX-License-Identifier: GPL-3.0-or-later
import {setupOf,spoolById,spoolFor} from './filament-swatches.js';
import {printPlacement} from './print-pose.js';

export function projectSetup(config){
 return {...setupOf(config),...(config.print_setup?.split_keycaps?{split_keycaps:true}:{})};
}
// Separate jobs by part type so the case can be printed without the keycaps.
function plateFamily(id){
 if(id.endsWith('-base'))return 'Bases';
 if(id.endsWith('-plate'))return 'Switch plates';
 if(id.includes('-frame-'))return 'Display frames';
 return 'Internal parts';
}
export function projectEntries(parts,groups){
 return [...parts.map(part=>({part,count:1,family:plateFamily(part.id)})),...groups.map(group=>({
  count:group.count,family:'Keycaps',part:{id:group.label+' '+group.color,label:group.label,variant:group.variant,spool:group.spool,colors:{body:group.color}}
 }))];
}

// Preview and export resolve slots in the same order from the same mesh bounds.
export function projectObject({part,count,family},materials,spools,config){
 const placement=printPlacement(part.id,materials),pose=placement.transform(),heights=new Map();
 const materialSlots=materials.map(m=>{
  const color=(part.colors[m.role]||part.colors.body).toUpperCase();
  const spool=spoolById(part.spool)||spoolFor(config,part.side,color),key=spool?.id||color;
  let slot=spools.findIndex(s=>s.key===key);
  if(slot<0){slot=spools.length;spools.push({key,color,series:spool?.series,name:spool?.name,label:spool?spool.series+' · '+spool.name:color});}
  let z=pose[11];
  for(let axis=0;axis<3;axis++){
   const f=pose[axis*3+2];z+=f*((f<0?m.minimum:m.maximum)[axis]+placement.shift[axis]);
  }
  heights.set(slot,Math.max(z,heights.get(slot)||0));return slot;
 });
 return {name:part.id,family,part,count,size:placement.size,slots:[...heights.keys()],heights,placement,materialSlots};
}
