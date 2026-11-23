// SPDX-License-Identifier: GPL-3.0-or-later
import {decorateFilamentDisclosure,filamentReel,filamentLabel,flatSwatch} from './filament-identity.js';
import {ownedRecipe} from './owned-themes.js';
import {createSpoolLibrary} from './spool-library.js';
import {chooseFilament} from './filament-picker.js';
import {assignPartSpool,bindSpool,commonPartSpool,closestSwatch,colorFields,mapThemeToSpools,spoolFor} from './filament-swatches.js';
import {enhanceColorInput} from './color-input.js';
import {printThemes,printableTheme,bindPresetColors,presetSpool} from './preset-filaments.js';
import {copy} from './config.js';
import {paletteColor} from './keycap-colors.js';
import {framePalette,finishes} from './finishes.js';
import {themeName,labelThemeButton} from './home/options.js';
import {t,tOr,onLanguage,language} from './i18n.js';
export {savedKey} from './storage.js';
export function applyTheme(config,source,sides){
 const c=copy(config),theme=source.spools||printThemes.includes(source)?source:printableTheme(source);
 c.filaments??={};
 for(const side of sides){
  const base=c.cases[side],frame=c.frames[side];
  Object.assign(base,{base_color:theme.base,plate_color:base.style==='level'?theme.frame.body:theme.plate,match_frame:true});
  frame.color=theme.frame.body;
  frame.accents=Object.fromEntries(['detail','accent','secondary'].map(role=>[role,theme.frame[role]]));
  for(const [ref,key] of Object.entries(c.keycaps[side])){
   key.color=paletteColor(theme.keycaps,{row:Number(ref[1]),col:Number(ref[2])});
  }
  if(c.part_filaments)delete c.part_filaments[side];
  c.filaments[side]={};
  if(theme.spools){for(const spool of theme.spools)bindSpool(c,[side],spool);}
  else bindPresetColors(c,side,colorFields(c,side).map(([record,field])=>record[field]));
 }
 return c;
}
export function setColor(config,sides,part,role,color){const c=copy(config);for(const side of sides){const cs=c.cases[side],f=c.frames[side];if(part==='case')cs[role]=color;else if(role==='body')f.color=color;else f.accents[role]=color;if(cs.match_frame){if(part==='case'&&(role==='base_color'||(cs.style==='level'&&role==='plate_color')))f.color=cs.base_color=color;if(part==='frame'&&role==='body')cs.base_color=color;if(cs.style==='level')cs.plate_color=f.color;}}return c;}
export function assignThemeParts(config,targets,spool,{respectColorLink=false}={}){
 const next=copy(config);
 for(const side of new Set(targets.map(([side])=>side))){
  const slots=targets.filter(([s])=>s===side).map(([,slot])=>slot);
  const cs=next.cases[side];
  if(respectColorLink&&cs.match_frame){
   const linked=cs.style==='level'?['base','frame','plate']:['base','frame'];
   if(slots.some(slot=>linked.includes(slot)))slots.push(...linked);
  }
  assignPartSpool(next,side,slots,spool);
  const frame=next.frames[side].color.toLowerCase();
  if(cs.base_color.toLowerCase()!==frame||(cs.style==='level'&&cs.plate_color.toLowerCase()!==frame))cs.match_frame=false;
 }
 return next;
}
export function createAppearance({$,get,apply,targets,recipePreview,catalog,printUses,printSelection,catalogLabel}){
 decorateFilamentDisclosure($('theme-filaments'));
 let themeSide='both';const sides=()=>themeSide==='both'?['left','right']:[themeSide];
 // A theme is a swatch, as on the home page: the case on top, the plate below, the frame's accent as a dot.
 for(const t of printThemes){const b=document.createElement('button');b.type='button';b.dataset.theme=t.id;b.setAttribute('aria-pressed','false');b.style.cssText=`--a:${t.base};--b:${t.plate};--c:${t.frame.accent}`;b.append(document.createElement('span'));labelThemeButton(b,t,language());b.onclick=()=>apply(applyTheme(get(),t,sides()));$('themes-grid').append(b);}
 function matchesTheme(theme){
  return sides().every(side=>{
   const c=get(),cs=c.cases[side],f=c.frames[side];
   return cs.base_color.toLowerCase()===theme.base&&cs.plate_color.toLowerCase()===(cs.style==='level'?theme.frame.body:theme.plate)
    &&f.color.toLowerCase()===theme.frame.body&&['detail','accent','secondary'].every(role=>f.accents[role].toLowerCase()===theme.frame[role])
    &&catalog.layout[side].every(key=>c.keycaps[side][key.ref].color.toLowerCase()===paletteColor(theme.keycaps,key))
    &&colorFields(c,side).every(([record,field,,slot])=>{
     const hex=record[field],assigned=spoolFor(c,side,hex,slot);
     if(!theme.roles)return !assigned||assigned===presetSpool(hex);
     return assigned&&theme.spools.includes(assigned);
    });
  });
 }
 function currentRecipe(){
  const c=get(),side=sides()[0],frame=c.frames[side];
  const roles=[['base',c.cases[side].base_color],['detail',frame.accents.detail],['accent',frame.accents.accent]].map(([slot,color])=>spoolFor(c,side,color,slot));
  if(!roles.every(spool=>spool&&spool.material===roles[0].material))return null;
  const recipe=ownedRecipe(...roles);
  return matchesTheme(recipe)?recipe:null;
 }
 const library=createSpoolLibrary({$,onInventoryChange:sync,choices:{apply:theme=>apply(applyTheme(get(),theme,sides())),scope:()=>themeSide,currentRecipe,onChange:sync,preview:recipePreview},getCurrentUses:()=>printUses(get()),getThemeUses:theme=>printUses(applyTheme(get(),theme,sides())),
  selectionLabel:()=>{const {scope,half}=printSelection();return [t('kit.'+scope),t('print.'+(get().print_setup?.mode||'ams')),t(half==='both'?'seg.both':'side.'+half)].join(' · ');}});
 for(const b of $('theme-target').children)b.onclick=()=>{themeSide=b.dataset.side;sync();};
 const inputs=[];
 // label: a dictionary key; a frame's own palette names its roles in sync()
 function colorInput(container,label,part,role,target){
  const row=document.createElement('div'),text=document.createElement('span'),value=document.createElement('small'),input=document.createElement('input');
  row.className='color-field';text.textContent=t(label);value.hidden=true;
  input.type='color';input.id=`${part}-${role}`;input.setAttribute('aria-label',t(label));
  input.oninput=()=>apply(setColor(get(),targets(target),part,role,input.value));
  row.append(text,value,input);$(container).append(row);
  const hex=enhanceColorInput(input,()=>t(label),spool=>{
   apply(assignThemeParts(get(),partTargets(),spool,{respectColorLink:true}));
  },color=>commonPartSpool(get(),partTargets(),color));
  function partTargets(){return targets(target).map(side=>[side,part==='case'?role.replace('_color',''):role]);}
  inputs.push({input,value,part,role,target,text,label,hex});
 }
 colorInput('case-colors','color.base','case','base_color','case');colorInput('case-colors','color.plate','case','plate_color','case');
 for(const role of ['detail','accent','secondary'])colorInput('theme-palette','role.'+role,'frame',role,'frame');
 for(const kind of ['case','frame'])$(`${kind}-link-colors`).onchange=e=>{const c=copy(get());for(const side of targets(kind)){c.cases[side].match_frame=e.target.checked;if(e.target.checked){c.frames[side].color=c.cases[side].base_color;if(c.cases[side].style==='level')c.cases[side].plate_color=c.cases[side].base_color;}}apply(c);};
 $('save-print-theme').onclick=()=>{
  const c=get(),palette={schema:'flan-filament-theme-1',sides:{}};
  for(const side of ['left','right']){
   const cs=c.cases[side],f=c.frames[side];
   palette.sides[side]={base:cs.base_color,plate:cs.plate_color,linked:cs.match_frame,frame:f.color,accents:f.accents,
    keys:Object.fromEntries(Object.entries(c.keycaps[side]).map(([id,k])=>[id,k.color])),filaments:c.filaments?.[side]||{},...(c.part_filaments?.[side]?{part_filaments:c.part_filaments[side]}:{})};
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
    if(next.part_filaments)delete next.part_filaments[side];
    if(palette.part_filaments){next.part_filaments??={};next.part_filaments[side]=palette.part_filaments;}
   }
   apply(next);$('theme-file-status').textContent=t('spool.loaded');
  }catch{$('theme-file-status').textContent=t('spool.invalid');}finally{e.target.value='';}
 };
 $('theme-filaments').ontoggle=()=>{if($('theme-filaments').open)renderSpools(get());};
 let spoolView='parts';
 for(const button of $('spool-view').children)button.onclick=()=>{spoolView=button.dataset.view;renderSpools(get());};
 $('match-theme-spools').onclick=()=>apply(mapThemeToSpools(get(),sides(),(hex,side,slot)=>spoolFor(get(),side,hex,slot)||closestSwatch(hex)));
 function renderSpools(c){
  const rows=new Map(),halves=sides(),byPart=spoolView==='parts';
  for(const view of $('spool-view').children)view.setAttribute('aria-pressed',String(view.dataset.view===spoolView));
  for(const side of halves)for(const [obj,field,role,slot] of colorFields(c,side)){
   const hex=obj[field].toLowerCase(),chosen=spoolFor(c,side,hex,slot);
   const key=[byPart?role:'',hex,chosen?.id||''].join('|');
   if(!rows.has(key))rows.set(key,{hex,chosen,roles:new Set(),members:[],sides:new Set()});
   const row=rows.get(key);row.roles.add(role);row.members.push([side,slot]);row.sides.add(side);
  }
  const needsMatch=[...rows.values()].some(row=>!row.chosen);
  $('match-theme-spools').hidden=!needsMatch;
  const hint=$('theme-filaments').querySelector('.micro');
  hint.dataset.t=byPart?'spool.partHint':needsMatch?'spool.themeHint':'spool.bulkHint';hint.textContent=t(hint.dataset.t);
  $('theme-spool-list').replaceChildren(...[...rows.values()].map(row=>{
   const spool=row.chosen||closestSwatch(row.hex),button=document.createElement('button');
   button.type='button';button.className='theme-spool';button.dataset.themeColor=row.hex;button.dataset.spool=row.chosen?.id||'';
   const [side,slot]=row.members[0];button.dataset.part=slot;button.dataset.half=side;
   const label=filamentLabel(spool,row.chosen?'selected':'suggested'),roles=document.createElement('span');
   const names=[...row.roles].map(r=>byPart&&r==='keycaps'?t('spool.matchingKeys'):t('spool.role.'+r));
   if(row.sides.size===1)names.push(t('side.'+side));
   const subject=names.join(' / ');
   roles.className=byPart?'filament-part-name':'filament-reference';roles.append(flatSwatch(row.hex),subject);
   if(byPart)label.prepend(roles);else label.append(roles);
   const arrow=document.createElement('span');arrow.className='spool-arrow';arrow.setAttribute('aria-hidden','true');arrow.textContent='›';
   button.append(filamentReel(spool),label,arrow);
   button.onclick=()=>chooseFilament(row.hex,s=>{
    apply(assignThemeParts(get(),row.members,s));
    const choices=[...$('theme-spool-list').children].filter(b=>b.dataset.themeColor===s.hex.toLowerCase()&&b.dataset.spool===s.id);
    (choices.find(b=>b.dataset.part===slot&&b.dataset.half===side)||choices[0])?.focus({preventScroll:true});
   },row.chosen,subject);
   return button;
  }));
 }
 function sync(){
  const c=get();if($('theme-filaments').open)renderSpools(c);for(const b of $('theme-target').children)b.setAttribute('aria-pressed',String(themeSide===b.dataset.side));
  let selected=null;for(const t of printThemes){const same=matchesTheme(t);$ ('themes-grid').querySelector(`[data-theme="${t.id}"]`).setAttribute('aria-pressed',String(same));if(same)selected=themeName(t,language());}
  const {half,scope}=printSelection();selected=library.sync(c,[themeSide,half,scope].join('/'))||selected;
  $('theme-current').textContent=selected||t('themes.custom');
  $('mobile-print-design').textContent=[catalogLabel(c.variant),themeSide==='both'?(selected||t('themes.custom')):null].filter(Boolean).join(' · ');
  for(const x of inputs){const values=targets(x.target).map(side=>x.part==='case'?c.cases[side][x.role]:c.frames[side].accents[x.role]);x.input.value=values[0];x.value.textContent=new Set(values.map(v=>v.toLowerCase())).size===1?values[0]:t('mixed');if(x.part==='frame'){const styles=targets('frame').map(side=>c.frames[side].style),labels=styles.map(s=>finishes.styles[s]?.labels[x.role]);x.text.textContent=labels.every(v=>v&&v===labels[0])?tOr('palette.'+labels[0],labels[0]):t(x.label);x.input.disabled=styles.every(s=>!finishes.styles[s]);}x.hex.sync(values);}
  for(const kind of ['case','frame']){const values=targets(kind).map(side=>c.cases[side].match_frame),input=$(`${kind}-link-colors`);input.checked=values.every(Boolean);input.indeterminate=values.some(Boolean)&&!input.checked;}
  $('theme-preview-note').textContent=themeSide==='both'?t('themes.note'):t('themes.noteHalf',{side:t('half.'+themeSide)});
 }
 onLanguage(()=>{
  for(const theme of printThemes)labelThemeButton($('themes-grid').querySelector(`[data-theme="${theme.id}"]`),theme,language());
  for(const x of inputs){x.input.setAttribute('aria-label',t(x.label));if(x.part==='case')x.text.textContent=t(x.label);}sync();});
 return {sync};
}
