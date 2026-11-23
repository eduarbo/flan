// SPDX-License-Identifier: GPL-3.0-or-later
import {contrastRatio} from './home/tokens.js';

// Spool bindings are indexed by color on each half. Within one recipe, one physical
// spool owns each color. Keep separate polymers in separate proposals.
export function ownedThemes(spools,page=0){
 const materials=new Map(),recipes=[];
 for(const spool of spools){
  if(!materials.has(spool.material))materials.set(spool.material,[]);
  materials.get(spool.material).push(spool);
 }
 for(const [material,group] of materials){
  const colors=[...new Map(group.map(s=>[s.hex,s])).values()].sort((a,b)=>a.lab[0]-b.lab[0]||a.id.localeCompare(b.id));
  const count=colors.length;
  const anchors=count>2?[0,Math.floor(count/2),count-1]:Array.from({length:count},(_,i)=>i);
  for(const start of anchors){
   const base=colors[(start+page)%count];
   const opposites=colors.filter(s=>s!==base).sort((a,b)=>contrastRatio(b.hex,base.hex)-contrastRatio(a.hex,base.hex));
   const keys=opposites[0]||base;
   const accents=opposites.slice(1).sort((a,b)=>Math.min(contrastRatio(b.hex,base.hex),contrastRatio(b.hex,keys.hex))-Math.min(contrastRatio(a.hex,base.hex),contrastRatio(a.hex,keys.hex)));
   const accent=accents.length?accents[page%accents.length]:base;
   const plate=base.hex.toLowerCase(),key=keys.hex.toLowerCase(),spot=accent.hex.toLowerCase();
   recipes.push({material,base:plate,plate,frame:{body:plate,accent:spot,detail:key,secondary:spot},
    keycaps:{base:key,thumbs:[spot,key,spot]},spools:[...new Set([base,keys,accent])],roles:[base,keys,accent]});
  }
 }
 return recipes;
}
