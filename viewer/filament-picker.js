// SPDX-License-Identifier: GPL-3.0-or-later
import {filamentReel,filamentLabel,flatSwatch} from './filament-identity.js';
import {language} from './i18n.js';
import {rankedSwatches,swatchSources,hueFamily} from './filament-swatches.js';
const say=(en,es)=>language()==='es'?es:en;
const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
export function chooseFilament(color,onSelect,selected){
 const dialog=document.createElement('dialog');dialog.className='filament-picker';dialog.setAttribute('aria-labelledby','spool-picker-title');
 const heading=el('div');heading.className='dialog-heading';
 const title=el('h2',say('Choose a filament','Elegir filamento'));title.className='title';title.id='spool-picker-title';title.tabIndex=-1;
 const close=el('button',say('Close','Cerrar'));close.onclick=()=>dialog.close();heading.append(title,close);
 const body=el('div');body.className='dialog-body';const filters=el('div');filters.className='spool-filters';
 const search=el('input');search.type='search';search.placeholder=say('Search color or brand','Buscar color o marca');search.setAttribute('aria-label',search.placeholder);
 const series=el('select');series.setAttribute('aria-label',say('Filament range','Línea de filamento'));
 series.add(new Option(say('All brands and finishes','Todas las marcas y acabados'),''));
 for(const range of Object.keys(swatchSources))series.add(new Option(range,range));
 const family=el('select');family.setAttribute('aria-label',say('Color family','Familia de color'));
 family.add(new Option(say('All color families','Todas las familias de color'),''));
 const names={neutral:['Neutrals','Neutros'],brown:['Browns','Cafés'],red:['Reds','Rojos'],orange:['Oranges','Naranjas'],yellow:['Yellows','Amarillos'],green:['Greens','Verdes'],teal:['Teals','Turquesas'],blue:['Blues','Azules'],purple:['Purples','Morados'],pink:['Pinks','Rosas']};
 for(const [id,labels] of Object.entries(names))family.add(new Option(say(...labels),id));
 filters.append(search,series,family);
 const target=el('p');target.className='target-swatch';const sample=el('i');sample.style.backgroundColor=color;
 target.append(sample,el('span',say('Design color','Color del diseño')),el('code',color.toUpperCase()));const results=el('div');const sorted=rankedSwatches(color);
 const sources=el('div');sources.className='filament-sources';
 sources.append(el('span',say('Manufacturer swatches','Muestras del fabricante')));
 for(const [label,url] of Object.entries(swatchSources)){
  const a=el('a',label);a.href=url;a.target='_blank';a.rel='noopener';sources.append(a);
 }
 function render(){
  results.replaceChildren();
  const words=search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const list=sorted.filter(s=>{
   const keywords=(s.id+' '+s.brand+' '+s.line+' '+s.hex).toLowerCase();
   return (!series.value||s.series===series.value)&&(!family.value||hueFamily(s)===family.value)&&words.every(word=>keywords.includes(word));
  });
  for(const [label,rows] of [[say('Closest colors','Tonos más cercanos'),list.slice(0,5)],[say('More colors','Más colores'),list.slice(5)]]){
   if(!rows.length)continue;results.append(el('h3',label));const grid=el('div');grid.className='spool-grid';
   for(const spool of rows){
    const b=el('button');b.type='button';b.dataset.spool=spool.id;
    const active=selected?.id===spool.id,label=filamentLabel(spool,active?'selected':undefined);
    if(selected)b.setAttribute('aria-pressed',String(active));
    const reference=el('small');reference.className='filament-reference';
    reference.append(flatSwatch(spool.hex),el('code',spool.hex));label.append(reference);
    b.append(filamentReel(spool),label);
    b.onclick=()=>{dialog.close();onSelect(spool);};grid.append(b);
   }
   results.append(grid);
  }
  if(!list.length)results.append(el('p',say('No matching color. Try another name or range.','Sin resultados. Prueba otro nombre o línea.')));
 }
 search.oninput=series.onchange=family.onchange=render;body.append(target,filters,results,sources);dialog.append(heading,body);document.body.append(dialog);
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});render();dialog.showModal();(matchMedia('(pointer: coarse)').matches?title:search).focus({preventScroll:true});
}
