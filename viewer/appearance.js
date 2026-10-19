// SPDX-License-Identifier: GPL-3.0-or-later
import {enhanceColorInput} from './color-input.js';
import themes from '../design/themes.json';
import {copy} from './config.js';
import {paletteColor} from './keycap-colors.js';
import {framePalette,finishes} from './finishes.js';
export {savedKey} from './storage.js';
export function applyTheme(config,theme,sides){const c=copy(config);for(const side of sides){Object.assign(c.cases[side],{base_color:theme.base,plate_color:c.cases[side].style==='level'?theme.frame.body:theme.plate,match_frame:true});c.frames[side].color=theme.frame.body;c.frames[side].accents=Object.fromEntries(['detail','accent','secondary'].map(k=>[k,theme.frame[k]]));for(const [ref,key] of Object.entries(c.keycaps[side])){const row=Number(ref[1]),col=Number(ref[2]);key.color=paletteColor(theme.keycaps,{row,col});}}return c;}
export function setColor(config,sides,part,role,color){const c=copy(config);for(const side of sides){const cs=c.cases[side],f=c.frames[side];if(part==='case')cs[role]=color;else if(role==='body')f.color=color;else f.accents[role]=color;if(cs.match_frame){if(part==='case'&&(role==='base_color'||(cs.style==='level'&&role==='plate_color')))f.color=cs.base_color=color;if(part==='frame'&&role==='body')cs.base_color=color;if(cs.style==='level')cs.plate_color=f.color;}}return c;}
export function createAppearance({$,get,apply,targets,preview,frameFinish,material,resize,catalog,geometryFor}){
 let themeSide='both';const sides=()=>themeSide==='both'?['left','right']:[themeSide];
 // A theme is a swatch, as on the home page: the case on top, the plate below, the frame's accent as a dot.
 for(const t of themes.themes){const b=document.createElement('button');b.type='button';b.dataset.theme=t.id;b.title=t.name;b.setAttribute('aria-pressed','false');b.setAttribute('aria-label',t.name);b.style.cssText=`--a:${t.base};--b:${t.plate};--c:${t.frame.accent}`;const name=document.createElement('span');name.textContent=t.name;b.append(name);b.onclick=()=>apply(applyTheme(get(),t,sides()));$('themes-grid').append(b);}
 for(const b of $('theme-target').children)b.onclick=()=>{themeSide=b.dataset.side;sync();};
 const inputs=[];
 function colorInput(container,label,part,role,target){const row=document.createElement('div');row.className='color-field';const text=document.createElement('span');text.textContent=label;const value=document.createElement('small'),input=document.createElement('input');input.type='color';input.id=`${part}-${role}`;input.setAttribute('aria-label',label);input.oninput=()=>apply(setColor(get(),targets(target),part,role,input.value));row.append(text,value,input);$(container).append(row);inputs.push({input,value,part,role,target,text,hex:enhanceColorInput(input)});value.hidden=true;}
 colorInput('case-colors','Base / color rim','case','base_color','case');colorInput('case-colors','Upper shell / key plate','case','plate_color','case');
 for(const role of ['detail','accent','secondary'])colorInput('theme-palette',role[0].toUpperCase()+role.slice(1),'frame',role,'frame');
 for(const kind of ['case','frame'])$(`${kind}-link-colors`).onchange=e=>{const c=copy(get());for(const side of targets(kind)){c.cases[side].match_frame=e.target.checked;if(e.target.checked){c.frames[side].color=c.cases[side].base_color;if(c.cases[side].style==='level')c.cases[side].plate_color=c.cases[side].base_color;}}apply(c);};
 function sync(){
  const c=get();for(const b of $('theme-target').children)b.setAttribute('aria-pressed',String(themeSide===b.dataset.side));
  let selected=null;for(const t of themes.themes){const same=sides().every(side=>{const cs=c.cases[side],f=c.frames[side];return cs.base_color.toLowerCase()===t.base&&cs.plate_color.toLowerCase()===(cs.style==='level'?t.frame.body:t.plate)&&f.color.toLowerCase()===t.frame.body&&['detail','accent','secondary'].every(k=>f.accents[k].toLowerCase()===t.frame[k])&&catalog.layout[side].every(k=>c.keycaps[side][k.ref].color.toLowerCase()===paletteColor(t.keycaps,k));});$ ('themes-grid').querySelector(`[data-theme="${t.id}"]`).setAttribute('aria-pressed',String(same));if(same)selected=t.name;}
  $('theme-current').textContent=selected||'Custom / mixed';
  for(const x of inputs){const values=targets(x.target).map(side=>x.part==='case'?c.cases[side][x.role]:c.frames[side].accents[x.role]);x.input.value=values[0];x.value.textContent=new Set(values.map(v=>v.toLowerCase())).size===1?values[0]:'Mixed';if(x.part==='frame'){const styles=targets('frame').map(side=>c.frames[side].style),labels=styles.map(s=>finishes.styles[s]?.labels[x.role]);x.text.textContent=labels.every(v=>v&&v===labels[0])?labels[0]:x.role[0].toUpperCase()+x.role.slice(1);x.input.disabled=styles.every(s=>!finishes.styles[s]);}x.hex.sync(values);}
  for(const kind of ['case','frame']){const values=targets(kind).map(side=>c.cases[side].match_frame),input=$(`${kind}-link-colors`);input.checked=values.every(Boolean);input.indeterminate=values.some(Boolean)&&!input.checked;}
  $('theme-preview-note').textContent=`Themes change colors only${themeSide==='both'?'':`, on the ${themeSide} half`}. Case, keycap and frame colors fine-tune in their own sections.`;
 }
 return {sync};
}
