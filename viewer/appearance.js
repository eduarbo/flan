// SPDX-License-Identifier: GPL-3.0-or-later
import {chooseFilament} from './filament-picker.js';
import {bindSpool,closestSwatch,colorFields,mapThemeToSpools,spoolFor} from './filament-swatches.js';
import {enhanceColorInput} from './color-input.js';
import themes from '../design/themes.json';
import {copy} from './config.js';
import {paletteColor} from './keycap-colors.js';
import {framePalette,finishes} from './finishes.js';
import {t,tOr,onLanguage} from './i18n.js';
export {savedKey} from './storage.js';
export function applyTheme(config,theme,sides){const c=copy(config);for(const side of sides){Object.assign(c.cases[side],{base_color:theme.base,plate_color:c.cases[side].style==='level'?theme.frame.body:theme.plate,match_frame:true});c.frames[side].color=theme.frame.body;c.frames[side].accents=Object.fromEntries(['detail','accent','secondary'].map(k=>[k,theme.frame[k]]));for(const [ref,key] of Object.entries(c.keycaps[side])){const row=Number(ref[1]),col=Number(ref[2]);key.color=paletteColor(theme.keycaps,{row,col});}}return c;}
export function setColor(config,sides,part,role,color){const c=copy(config);for(const side of sides){const cs=c.cases[side],f=c.frames[side];if(part==='case')cs[role]=color;else if(role==='body')f.color=color;else f.accents[role]=color;if(cs.match_frame){if(part==='case'&&(role==='base_color'||(cs.style==='level'&&role==='plate_color')))f.color=cs.base_color=color;if(part==='frame'&&role==='body')cs.base_color=color;if(cs.style==='level')cs.plate_color=f.color;}}return c;}
export function createAppearance({$,get,apply,targets,preview,frameFinish,material,resize,catalog,geometryFor}){
 let themeSide='both';const sides=()=>themeSide==='both'?['left','right']:[themeSide];
 // A theme is a swatch, as on the home page: the case on top, the plate below, the frame's accent as a dot.
 for(const t of themes.themes){const b=document.createElement('button');b.type='button';b.dataset.theme=t.id;b.title=t.name;b.setAttribute('aria-pressed','false');b.setAttribute('aria-label',t.name);b.style.cssText=`--a:${t.base};--b:${t.plate};--c:${t.frame.accent}`;const name=document.createElement('span');name.textContent=t.name;b.append(name);b.onclick=()=>apply(applyTheme(get(),t,sides()));$('themes-grid').append(b);}
 for(const b of $('theme-target').children)b.onclick=()=>{themeSide=b.dataset.side;sync();};
 const inputs=[];
 // label: a dictionary key; a frame's own palette names its roles in sync()
 function colorInput(container,label,part,role,target){const row=document.createElement('div');row.className='color-field';const text=document.createElement('span');text.textContent=t(label);const value=document.createElement('small'),input=document.createElement('input');input.type='color';input.id=`${part}-${role}`;input.setAttribute('aria-label',t(label));input.oninput=()=>apply(setColor(get(),targets(target),part,role,input.value));row.append(text,value,input);$(container).append(row);inputs.push({input,value,part,role,target,text,label,hex:enhanceColorInput(input,()=>t(label),spool=>apply(bindSpool(setColor(get(),targets(target),part,role,spool.hex.toLowerCase()),targets(target),spool)))});value.hidden=true;}
 colorInput('case-colors','color.base','case','base_color','case');colorInput('case-colors','color.plate','case','plate_color','case');
 for(const role of ['detail','accent','secondary'])colorInput('theme-palette','role.'+role,'frame',role,'frame');
 for(const kind of ['case','frame'])$(`${kind}-link-colors`).onchange=e=>{const c=copy(get());for(const side of targets(kind)){c.cases[side].match_frame=e.target.checked;if(e.target.checked){c.frames[side].color=c.cases[side].base_color;if(c.cases[side].style==='level')c.cases[side].plate_color=c.cases[side].base_color;}}apply(c);};
 $('save-print-theme').onclick=()=>{
  const c=get(),palette={schema:'flan-filament-theme-1',sides:{}};
  for(const side of ['left','right']){
   const cs=c.cases[side],f=c.frames[side];
   palette.sides[side]={base:cs.base_color,plate:cs.plate_color,linked:cs.match_frame,frame:f.color,accents:f.accents,
    keys:Object.fromEntries(Object.entries(c.keycaps[side]).map(([id,k])=>[id,k.color])),filaments:c.filaments?.[side]||{}};
  }
  const url=URL.createObjectURL(new Blob([JSON.stringify(palette,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='Flan-theme.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
 };
 $('open-print-theme').onclick=()=>$('print-theme-file').click();
 $('print-theme-file').onchange=async e=>{
  try{
   const file=e.target.files[0];if(!file)return;if(file.size>64000)throw Error();
   const theme=JSON.parse(await file.text());
   if(theme.schema!=='flan-filament-theme-1')throw Error();
   const next=copy(get());
   for(const side of sides()){
    const palette=theme.sides[side],cs=next.cases[side];
    if(typeof palette.linked!=='boolean'||!['base','plate','frame'].every(k=>/^#[0-9a-f]{6}$/i.test(palette[k]))||
     !['detail','accent','secondary'].every(k=>/^#[0-9a-f]{6}$/i.test(palette.accents[k])))throw Error();
    Object.assign(cs,{base_color:palette.base,plate_color:cs.style==='level'&&palette.linked?palette.frame:palette.plate,match_frame:palette.linked});
    Object.assign(next.frames[side],{color:palette.frame,accents:palette.accents});
    for(const [id,key] of Object.entries(next.keycaps[side])){if(!/^#[0-9a-f]{6}$/i.test(palette.keys[id]))throw Error();key.color=palette.keys[id];}
    next.filaments??={};next.filaments[side]=palette.filaments||{};
   }
   apply(next);$('theme-file-status').textContent=t('spool.loaded');
  }catch{$('theme-file-status').textContent=t('spool.invalid');}finally{e.target.value='';}
 };
 $('theme-filaments').ontoggle=()=>{if($('theme-filaments').open)renderSpools(get());};
 $('match-theme-spools').onclick=()=>apply(mapThemeToSpools(get(),sides(),(hex,side)=>spoolFor(get(),side,hex)||closestSwatch(hex)));
 function renderSpools(c){
  const rows=new Map();
  for(const side of sides())for(const [obj,field,role] of colorFields(c,side)){
   const hex=obj[field].toLowerCase(),chosen=spoolFor(c,side,hex),key=hex+'|'+(chosen?.id||'');
   if(!rows.has(key))rows.set(key,{hex,chosen,roles:new Set(),sides:new Set()});
   rows.get(key).roles.add(role);rows.get(key).sides.add(side);
  }
  $('theme-spool-list').replaceChildren(...[...rows.values()].map(row=>{
   const spool=row.chosen||closestSwatch(row.hex),button=document.createElement('button');button.type='button';button.className='theme-spool';button.dataset.themeColor=row.hex;button.dataset.spool=row.chosen?.id||'';
   const chip=document.createElement('i');chip.style.background=row.hex;const label=document.createElement('span');
   label.textContent=[...row.roles].map(r=>t('spool.role.'+r)).join(' / ');
   const sub=document.createElement('small'),name=document.createElement('span');
   name.textContent=spool.name;sub.append((row.chosen?'':'≈ ')+spool.series+' · ',name);label.append(sub);
   const arrow=document.createElement('span');arrow.textContent='›';button.append(chip,label,arrow);
   button.onclick=()=>chooseFilament(row.hex,s=>{
    apply(mapThemeToSpools(get(),[...row.sides],hex=>hex===row.hex?s:null));
    const replacement=[...$('theme-spool-list').children].find(b=>b.dataset.themeColor===s.hex.toLowerCase()&&b.dataset.spool===s.id);
    replacement?.focus({preventScroll:true});
   });
   return button;
  }));
 }
 function sync(){
  const c=get();if($('theme-filaments').open)renderSpools(c);for(const b of $('theme-target').children)b.setAttribute('aria-pressed',String(themeSide===b.dataset.side));
  let selected=null;for(const t of themes.themes){const same=sides().every(side=>{const cs=c.cases[side],f=c.frames[side];return cs.base_color.toLowerCase()===t.base&&cs.plate_color.toLowerCase()===(cs.style==='level'?t.frame.body:t.plate)&&f.color.toLowerCase()===t.frame.body&&['detail','accent','secondary'].every(k=>f.accents[k].toLowerCase()===t.frame[k])&&catalog.layout[side].every(k=>c.keycaps[side][k.ref].color.toLowerCase()===paletteColor(t.keycaps,k));});$ ('themes-grid').querySelector(`[data-theme="${t.id}"]`).setAttribute('aria-pressed',String(same));if(same)selected=t.name;}
  $('theme-current').textContent=selected||t('themes.custom');
  for(const x of inputs){const values=targets(x.target).map(side=>x.part==='case'?c.cases[side][x.role]:c.frames[side].accents[x.role]);x.input.value=values[0];x.value.textContent=new Set(values.map(v=>v.toLowerCase())).size===1?values[0]:t('mixed');if(x.part==='frame'){const styles=targets('frame').map(side=>c.frames[side].style),labels=styles.map(s=>finishes.styles[s]?.labels[x.role]);x.text.textContent=labels.every(v=>v&&v===labels[0])?tOr('palette.'+labels[0],labels[0]):t(x.label);x.input.disabled=styles.every(s=>!finishes.styles[s]);}x.hex.sync(values);}
  for(const kind of ['case','frame']){const values=targets(kind).map(side=>c.cases[side].match_frame),input=$(`${kind}-link-colors`);input.checked=values.every(Boolean);input.indeterminate=values.some(Boolean)&&!input.checked;}
  $('theme-preview-note').textContent=themeSide==='both'?t('themes.note'):t('themes.noteHalf',{side:t('half.'+themeSide)});
 }
 onLanguage(()=>{for(const x of inputs){x.input.setAttribute('aria-label',t(x.label));if(x.part==='case')x.text.textContent=t(x.label);}sync();});
 return {sync};
}
