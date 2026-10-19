// SPDX-License-Identifier: GPL-3.0-or-later
import {enhanceColorInput} from './color-input.js';
import library from '../design/keycap-themes.json';
import {copy} from './config.js';
import {createStore} from './storage.js';
import {t,onLanguage} from './i18n.js';
const sides=['left','right'],paletteStorageSlot='flan36.keycap-palettes.v1';
export const defaultCapColor=key=>key.row===3?'#45967b':'#e9dfc6';
export function paletteColor(palette,key){
 if(key.row===3)return palette.thumbs[key.col];
 if(palette.pattern==='rows')return palette.colors[key.row];
 return palette.base;
}
export function colorTargets(catalog,selection){
 const selected=selection.side==='both'?sides:[selection.side];
 return selected.flatMap(side=>catalog.layout[side].filter(k=>selection.mode==='all'||selection.mode==='row'&&k.row===selection.row||selection.mode==='column'&&k.row!==3&&k.col===selection.column||selection.mode==='key'&&side===selection.keySide&&k.ref===selection.key).map(k=>[side,k]));
}
export function paintKeys(config,targets,color){const c=copy(config);for(const [side,key] of targets)c.keycaps[side][key.ref].color=color;return c;}
export function applyCapPalette(config,catalog,palette,targets=sides){const c=copy(config);for(const side of targets)for(const key of catalog.layout[side])c.keycaps[side][key.ref].color=paletteColor(palette,key);return c;}
export function validatePaletteFile(value,catalog){
 if(value?.schema!=='flan36-keycap-palettes-1'||!Array.isArray(value.palettes)||value.palettes.length>24)throw Error(t('keys.badFile'));
 for(const p of value.palettes){
  if(!p||typeof p!=='object'||typeof p.name!=='string'||!p.name.trim()||p.name.length>40||!p.colors||Object.keys(p.colors).sort().join()!=='left,right')throw Error(t('keys.badName'));
  for(const side of sides){const colors=p.colors[side];if(!colors||typeof colors!=='object'||Object.keys(colors).sort().join()!==catalog.layout[side].map(k=>k.ref).sort().join()||Object.values(colors).some(c=>typeof c!=='string'||!/^#[0-9a-f]{6}$/i.test(c)))throw Error(t('keys.badColors'));}
 }
 return copy(value.palettes);
}
export function createKeycapColors({$,catalog,get,apply,message,storageNotice=message}){
 const colorHex=enhanceColorInput($('cap-color'),()=>t('keys.colorLabel'));
 let selection={side:'both',mode:'all',row:0,column:1,keySide:'left',key:'K01'},custom=[],initialWarning='';
 const paletteStore=createStore({key:paletteStorageSlot,validate:v=>{validatePaletteFile(v,catalog);return v;},notify:storageNotice});
 try{const saved=paletteStore.initialRaw;if(saved)custom=validatePaletteFile(JSON.parse(saved),catalog);}catch{initialWarning=t('keys.unreadable');}
 const buttons=[];
 function remember(){paletteStore.save({schema:'flan36-keycap-palettes-1',palettes:custom});return false;}
 const activeSides=()=>selection.side==='both'?sides:[selection.side];
 const resolved=()=>colorTargets(catalog,selection);
 function selectKey(side,k){if(selection.mode==='row')selection.row=k.row;else if(selection.mode==='column'&&k.row!==3)selection.column=k.col;else{selection.mode='key';selection.side=side;selection.keySide=side;selection.key=k.ref;}sync();}
 for(const side of sides){
  const group=document.createElement('div');group.className='cap-map';group.setAttribute('role','group');group.dataset.side=side;
  const label=document.createElement('span');label.className='cap-map-label';group.append(label);
  for(const k of catalog.layout[side]){const b=document.createElement('button');b.type='button';b.className='cap-key';b.dataset.capSide=side;b.dataset.capKey=k.ref;b.style.gridColumn=String(k.row===3?(side==='left'?k.col+3:3-k.col):(side==='left'?k.col:6-k.col));b.style.gridRow=String(k.row+2);b.textContent=k.ref.slice(1);b.onclick=()=>selectKey(side,k);buttons.push({b,side,k});group.append(b);}
  $('cap-map').append(group);
 }
 function labelMaps(){
  for(const group of $('cap-map').children){const side=t('half.'+group.dataset.side);group.setAttribute('aria-label',t('keys.group',{side}));group.querySelector('.cap-map-label').textContent=side;}
  for(const {b,side,k} of buttons){const vars={side:t('half.'+side),ref:k.ref};b.title=t('keys.keyTitle',vars);b.setAttribute('aria-label',t('keys.keyLabel',vars));}
 }
 labelMaps();
 function chip(name,colors,click){const b=document.createElement('button');b.type='button';b.className='cap-palette';b.onclick=click;const sw=document.createElement('span');sw.className='cap-palette-colors';for(const color of colors){const dot=document.createElement('i');dot.style.background=color;sw.append(dot);}const text=document.createElement('span');text.textContent=name;b.append(sw,text);return b;}
 for(const palette of library.palettes){const colors=[...new Set(catalog.layout.left.map(k=>paletteColor(palette,k)))];const b=chip(palette.name,colors,()=>apply(applyCapPalette(get(),catalog,palette,activeSides())));b.dataset.capPalette=palette.id;$('cap-palettes').append(b);}
 function renderCustom(){
  $('custom-cap-palettes').replaceChildren();
  for(const [index,palette] of custom.entries()){
   const row=document.createElement('div');row.className='custom-palette';const colors=[...new Set(Object.values(palette.colors.left))].slice(0,5);
   const b=chip(palette.name,colors,()=>{const c=copy(get());for(const side of activeSides())for(const k of catalog.layout[side])c.keycaps[side][k.ref].color=palette.colors[side][k.ref];apply(c);});b.dataset.customCapPalette=String(index);
   const remove=document.createElement('button');remove.type='button';remove.className='remove-palette';remove.textContent='×';remove.setAttribute('aria-label',t('keys.delete',{name:palette.name}));remove.onclick=()=>{custom.splice(index,1);remember();renderCustom();};row.append(b,remove);$('custom-cap-palettes').append(row);
  }
  $('cap-library-empty').hidden=custom.length>0;
 }
 for(const b of $('cap-side').children)b.onclick=()=>{selection.side=b.dataset.side;if(selection.mode==='key'){if(selection.side==='both')selection.mode='all';else selection.keySide=selection.side;}sync();};
 for(const b of $('cap-mode').querySelectorAll('[data-value]'))b.onclick=()=>{selection.mode=b.dataset.value;if(selection.mode==='key')selection.side=selection.keySide;sync();};
 for(const b of $('cap-row').querySelectorAll('[data-value]'))b.onclick=()=>{selection.row=Number(b.dataset.value);sync();};for(const b of $('cap-column').querySelectorAll('[data-value]'))b.onclick=()=>{selection.column=Number(b.dataset.value);sync();};
 let pending=0;const paint=()=>{pending=0;apply(paintKeys(get(),resolved(),$('cap-color').value));};
 $('cap-color').oninput=()=>{if(!pending)pending=requestAnimationFrame(paint);};$('cap-color').onchange=()=>{if(pending)cancelAnimationFrame(pending);paint();};
 $('save-cap-palette').onclick=()=>{if(custom.length>=24){message(t('keys.full'),true);return;}const name=$('cap-palette-name').value.trim()||t('keys.default',{n:custom.length+1});const c=get();custom.push({name:name.slice(0,40),colors:Object.fromEntries(sides.map(side=>[side,Object.fromEntries(catalog.layout[side].map(k=>[k.ref,c.keycaps[side][k.ref].color]))]))});const saved=remember();renderCustom();$('cap-palette-name').value='';if(saved)message(t('keys.saved'));};
 $('export-cap-palettes').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({schema:'flan36-keycap-palettes-1',palettes:custom},null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='Flan36-keycap-palettes.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 $('import-cap-palettes').onclick=()=>$('cap-palette-file').click();
 $('cap-palette-file').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>100000)throw Error(t('keys.big'));const imported=validatePaletteFile(JSON.parse(await file.text()),catalog);if(custom.length+imported.length>24)throw Error(t('keys.over'));custom.push(...imported);const saved=remember();renderCustom();if(saved)message(t('keys.imported'));}catch(error){message(error.message,true);}finally{e.target.value='';}};
 function sync(){
  const c=get(),targets=resolved(),ids=new Set(targets.map(([s,k])=>s+':'+k.ref));
  for(const {b,side,k} of buttons){const color=c.keycaps[side][k.ref].color||defaultCapColor(k);b.style.setProperty('--cap-color',color);const value=parseInt(color.slice(1),16),l=((value>>16)*.2126+(value>>8&255)*.7152+(value&255)*.0722);b.style.color=l>140?'#23332e':'#fff';b.setAttribute('aria-pressed',String(ids.has(side+':'+k.ref)));}
  for(const b of $('cap-side').children)b.setAttribute('aria-pressed',String(b.dataset.side===selection.side));
  for(const [id,value] of [['cap-mode',selection.mode],['cap-row',selection.row],['cap-column',selection.column]])for(const b of $(id).querySelectorAll('[data-value]'))b.setAttribute('aria-pressed',String(b.dataset.value===String(value)));$('cap-row-label').hidden=selection.mode!=='row';$('cap-column-label').hidden=selection.mode!=='column';
  const colors=targets.map(([s,k])=>c.keycaps[s][k.ref].color||defaultCapColor(k));$('cap-color').value=colors[0]||'#e9dfc6';colorHex.sync(colors);const count=t(targets.length===1?'keys.count.one':'keys.count',{n:targets.length});$('cap-selection').textContent=selection.side==='both'?t('keys.both',{count}):t('keys.half',{count,side:t('half.'+selection.side)});
 }
 renderCustom();sync();onLanguage(()=>{labelMaps();renderCustom();sync();});
 return {sync,initialWarning,idle:()=>paletteStore.idle(),cancelPending(){if(pending)cancelAnimationFrame(pending);pending=0;},focus(side,ref){if(ref){selection={...selection,side,mode:'key',keySide:side,key:ref};sync();}}};
}
