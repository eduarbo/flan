// SPDX-License-Identifier: GPL-3.0-or-later
import stock from '../design/preset-filaments.json' with {type:'json'};
import designs from '../design/themes.json' with {type:'json'};
import keycaps from '../design/keycap-themes.json' with {type:'json'};
import {rankedSwatchDistances,bindSpool,assignPartSpool,colorFields} from './filament-swatches.js';

import {contrastRatio} from './home/tokens.js';

export const presetStock=stock;
const available=new Set(Object.entries(stock.available).flatMap(([series,names])=>names.map(name=>series+'/'+name)));
const rankings=new Map();
function availableByDistance(color){
 const hex=color.toLowerCase();
 if(!rankings.has(hex))rankings.set(hex,rankedSwatchDistances(hex).filter(({spool})=>available.has(spool.id)));
 return rankings.get(hex);
}
export const presetSpool=color=>availableByDistance(color)[0].spool;
const hexOf=choice=>choice.spool.hex.toLowerCase();

function capColors(palette){
 return palette?[palette.base,...(palette.colors||[]),...palette.thumbs].filter(Boolean):[];
}

// Minimize the summed squared OKLab distance, keeping authored colors distinct within each part.
function paletteResolver(frame,palette){
 const frameColors=Object.values(frame||{}),groups=[frameColors,capColors(palette)].map(group=>new Set(group.map(c=>c.toLowerCase())));
 const body=frame?.body.toLowerCase(),bodyHex=body&&hexOf(availableByDistance(body)[0]);
 const colors=[...new Set(groups.flatMap(group=>[...group]))];
 const choices=colors.map(color=>{
  const neighbors=new Set(groups.filter(group=>group.has(color)).flatMap(group=>[...group]));neighbors.delete(color);
  const candidates=[],seen=new Set();
  for(const match of availableByDistance(color)){
   const hex=hexOf(match);
   if(seen.has(hex)||(groups[0].has(color)&&color!==body&&contrastRatio(hex,bodyHex)<1.5))continue;
   seen.add(hex);candidates.push({hex,cost:match.d});
   // At most one distinct color can be occupied by each neighbor.
   if(color===body||candidates.length>neighbors.size)break;
  }
  return {color,neighbors,candidates};
 });
 const assigned=new Map();let best,minimum=Infinity;
 function choose(index,cost){
  if(cost>=minimum)return;
  if(index===choices.length){best=new Map(assigned);minimum=cost;return;}
  const {color,neighbors,candidates}=choices[index];
  const used=new Set([...neighbors].map(neighbor=>assigned.get(neighbor)));
  for(const candidate of candidates){
   if(used.has(candidate.hex))continue;
   assigned.set(color,candidate.hex);choose(index+1,cost+candidate.cost);assigned.delete(color);
  }
 }
 choose(0,0);
 return color=>best.get(color.toLowerCase())??hexOf(availableByDistance(color)[0]);
}
function mapFrame(colors,resolve){
 return Object.fromEntries(Object.entries(colors).map(([role,color])=>[role,resolve(color)]));
}
export function printFrameColors(colors){return mapFrame(colors,paletteResolver(colors));}
function mapCaps(palette,resolve){
 const result={...palette,thumbs:palette.thumbs.map(resolve)};
 if(palette.base)result.base=resolve(palette.base);
 if(palette.colors)result.colors=palette.colors.map(resolve);
 return result;
}
export function printableCaps(palette){return mapCaps(palette,paletteResolver(null,palette));}
export function printableTheme(theme){
 const resolve=paletteResolver(theme.frame,theme.keycaps);
 return {...theme,base:resolve(theme.base),plate:resolve(theme.plate),frame:mapFrame(theme.frame,resolve),keycaps:mapCaps(theme.keycaps,resolve)};
}
export const printThemes=designs.themes.map(printableTheme);
export const printCapPalettes=keycaps.palettes.map(palette=>printableCaps(palette));
export function bindPresetColors(config,side,colors){
 for(const color of new Set(colors))bindSpool(config,[side],presetSpool(color));
}

export function bindPresetParts(config,side,slots){
 const selected=new Set(slots),groups=new Map();
 for(const [record,key,,slot] of colorFields(config,side)){
  if(!selected.has(slot))continue;
  const spool=presetSpool(record[key]);
  if(!groups.has(spool))groups.set(spool,[]);groups.get(spool).push(slot);
 }
 for(const [spool,parts] of groups)assignPartSpool(config,side,parts,spool);
}
