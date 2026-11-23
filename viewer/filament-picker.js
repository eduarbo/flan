// SPDX-License-Identifier: GPL-3.0-or-later
import {filamentReel,filamentLabel,filamentColorCode,flatSwatch} from './filament-identity.js';
import {language} from './i18n.js';
import {ownedSpools,watchSpools} from './owned-spools.js';
import {rankedSwatches,swatchSources,hueFamily,filamentRanges} from './filament-swatches.js';
const say=(en,es)=>language()==='es'?es:en;
const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
export function filamentFilters(onChange){
 const filters=el('div');filters.className='spool-filters';
 const search=el('input');search.type='search';search.placeholder=say('Color, brand or code','Color, marca o código');search.setAttribute('aria-label',search.placeholder);
 function select(name){
  const label=el('label'),caption=el('span',name),control=el('select');
  label.append(caption,control);filters.append(label);return control;
 }
 filters.append(search);
 const brand=select(say('Brand','Marca')),series=select(say('Filament range','Línea de filamento')),family=select(say('Color family','Familia de color'));
 brand.add(new Option(say('All brands','Todas las marcas'),''));
 for(const value of [...new Set(filamentRanges.map(r=>r.brand))].sort())brand.add(new Option(value,value));
 function ranges(){
  const previous=series.value;
  series.replaceChildren(new Option(say('All ranges','Todas las líneas'),''));
  for(const r of filamentRanges.filter(r=>!brand.value||r.brand===brand.value))series.add(new Option(brand.value?r.line:r.series,r.series));
  if([...series.options].some(o=>o.value===previous))series.value=previous;
 }
 ranges();
 family.add(new Option(say('All families','Todas las familias'),''));
 const names={neutral:['Neutrals','Neutros'],brown:['Browns','Cafés'],red:['Reds','Rojos'],orange:['Oranges','Naranjas'],yellow:['Yellows','Amarillos'],green:['Greens','Verdes'],teal:['Teals','Turquesas'],blue:['Blues','Azules'],purple:['Purples','Morados'],pink:['Pinks','Rosas']};
 for(const [id,labels] of Object.entries(names))family.add(new Option(say(...labels),id));
 const clear=el('button',say('Clear filters','Limpiar filtros'));clear.type='button';clear.className='clear-spool-filters';filters.append(clear);
 const changed=()=>{clear.hidden=!(brand.value||series.value||family.value||search.value);onChange();};
 clear.hidden=true;
 clear.onclick=()=>{brand.value='';ranges();series.value='';family.value='';search.value='';words=[];changed();search.focus();};
 brand.onchange=()=>{ranges();changed();};
 let words=[];
 search.oninput=()=>{words=search.value.trim().toLowerCase().replace(/\((\d{5})\)|#(\d{5})\b/g,'$1$2').split(/\s+/).filter(Boolean);changed();};
 series.onchange=family.onchange=changed;
 function matches(s){
  const code=filamentColorCode(s)||'';
  const keywords=(s.id+' '+s.brand+' '+s.line+' '+s.hex+' '+code).toLowerCase();
  return (!brand.value||s.brand===brand.value)&&(!series.value||s.series===series.value)&&(!family.value||hueFamily(s)===family.value)&&words.every(word=>/^\d{5}$/.test(word)?word===code:keywords.includes(word));
 }
 return {filters,matches,search};
}
export function chooseFilament(color,onSelect,selected){
 const dialog=document.createElement('dialog');dialog.className='filament-picker';dialog.setAttribute('aria-labelledby','spool-picker-title');
 const heading=el('div');heading.className='dialog-heading';
 const title=el('h2',say('Choose a filament','Elegir filamento'));title.className='title';title.id='spool-picker-title';title.tabIndex=-1;
 const close=el('button',say('Close','Cerrar'));close.onclick=()=>dialog.close();heading.append(title,close);
 const body=el('div');body.className='dialog-body';const {filters,matches,search}=filamentFilters(render);
 const target=el('p');target.className='target-swatch';const sample=el('i');sample.style.backgroundColor=color;
 target.append(sample,el('span',say('Design color','Color del diseño')),el('code',color.toUpperCase()));const results=el('div');const sorted=rankedSwatches(color);
 const sources=el('div');sources.className='filament-sources';
 sources.append(el('span',say('Manufacturer swatches','Muestras del fabricante')));
 for(const [label,url] of Object.entries(swatchSources)){
  const a=el('a',label);a.href=url;a.target='_blank';a.rel='noopener';sources.append(a);
 }
 function render(){
  results.replaceChildren();
  const list=sorted.filter(matches),owned=ownedSpools();
  const mine=list.filter(s=>owned.has(s.id)),other=list.filter(s=>!owned.has(s.id));
  for(const [label,rows] of [[say('My spools','Mis bobinas'),mine],[say('Closest colors','Tonos más cercanos'),other.slice(0,5)],[say('More colors','Más colores'),other.slice(5)]]){
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
  if(!list.length)results.append(el('p',say('No matching filament. Try another name or code.','Sin resultados. Prueba otro nombre o código.')));
 }
 body.append(target,filters,results,sources);dialog.append(heading,body);document.body.append(dialog);
 const unwatch=watchSpools(render);dialog.addEventListener('close',()=>{unwatch();dialog.remove();},{once:true});render();dialog.showModal();(matchMedia('(pointer: coarse)').matches?title:search).focus({preventScroll:true});
}
