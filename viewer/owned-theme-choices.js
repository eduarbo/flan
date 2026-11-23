// SPDX-License-Identifier: GPL-3.0-or-later
import {ownedThemes} from './owned-themes.js';
import {spoolById} from './filament-swatches.js';
import {themePins,recipeId,pinnedStrip} from './pinned-themes.js';
import {t} from './i18n.js';

export function ownedThemeChoices({$,apply,scope,currentRecipe,preview,onChange}){
 const section=$('owned-themes'),grid=$('owned-theme-grid'),previous=$('owned-previous'),next=$('owned-next'),detail=$('owned-theme-detail');
 let page=0,inventory='',cards=[],visible=false,frame=0,inventorySpools=[],ownedIds=new Set();
 const pins=themePins(onChange),renderPins=pinnedStrip($('pinned-themes'),$('pinned-theme-grid'),apply);
 const pin=$('pin-theme'),remove=$('unpin-theme');
 function togglePin(){
  const recipe=currentRecipe();if(!recipe)return;
  const ok=pins.toggle(recipe);
  $('pin-status').textContent=ok?'':t('pins.failed');
  if(ok&&document.activeElement===document.body)(section.hidden?$('my-spools'):pin).focus({preventScroll:true});
 }
 pin.onclick=remove.onclick=togglePin;
 function describe(recipe){
  const [base,keys,accent]=recipe.roles;
  return [t('spool.role.base')+' · '+base.name,t('spool.role.keycaps')+' · '+keys.name,t('spool.role.accent')+' · '+accent.name].join(' / ');
 }
 function draw(){
  frame=0;if(!visible||section.hidden)return;
  const side=scope()==='right'?'right':'left',shape=preview.shape(side);
  if(!shape)return;
  const pending=cards.filter(card=>card.shape!==shape);
  if(!pending.length)return;
  preview.batch(()=>{
   for(const card of pending){
    card.image.src=preview.image(card.recipe,side);
    card.shape=shape;
   }
  });
 }
 function schedule(){if(visible&&!frame)frame=requestAnimationFrame(draw);}
 new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;schedule();}).observe(section);
 function sync(){
  const side=scope(),target=t(side==='both'?'seg.both':'side.'+side);
  const applied=currentRecipe(),id=applied&&recipeId(applied),pinned=pins.has(id);
  const selected=applied&&(pinned||applied.spools.every(spool=>ownedIds.has(spool.id)))?applied:null;
  renderPins(pins.all(),id);
  pin.disabled=!selected;
  pin.setAttribute('aria-pressed',String(pinned));pin.textContent=t(pinned?'pins.on':'pins.pin');
  remove.hidden=!pinned;
  for(const {button,recipe} of cards){
   const active=Boolean(selected&&recipe.roles.every((spool,i)=>spool.id===selected.roles[i].id));
   button.setAttribute('aria-pressed',String(active));
   const label=recipe.material+' · '+recipe.roles[0].name+', '+describe(recipe)+', '+target;
   button.title=label;button.setAttribute('aria-label',label);
  }
  detail.textContent=selected?describe(selected):'';
  schedule();
  return selected?selected.material+' · '+selected.roles[0].name:null;
 }
 function show(){
  cards=ownedThemes(inventorySpools,page).map(recipe=>{
   const button=document.createElement('button'),image=document.createElement('img'),name=document.createElement('span'),material=document.createElement('small');
   button.type='button';button.className='preview-card';button.dataset.recipe=recipe.material;
   image.width=240;image.height=160;image.alt='';
   name.textContent=recipe.roles[0].name;material.textContent=recipe.material;
   button.append(image,name,material);button.onclick=()=>apply(recipe);
   return {button,image,recipe};
  });
  grid.replaceChildren(...cards.map(card=>card.button));
  previous.disabled=page===0;
  return sync();
 }
 previous.onclick=()=>{if(page>0){page--;show();if(previous.disabled)next.focus({preventScroll:true});}};
 next.onclick=()=>{page++;show();};
 return {
  update(owned){
   const ids=JSON.stringify([...owned].sort());
   if(ids!==inventory){
    inventory=ids;ownedIds=owned;inventorySpools=[...owned].map(spoolById);page=0;
    section.hidden=!inventorySpools.length;
    const byMaterial=new Map();
    for(const spool of inventorySpools){
     if(!byMaterial.has(spool.material))byMaterial.set(spool.material,new Set());
     byMaterial.get(spool.material).add(spool.hex);
    }
    $('owned-pages').hidden=![...byMaterial.values()].some(colors=>colors.size>3);
    return show();
   }
   return sync();
  },
  focus(){const button=grid.querySelector('[aria-pressed=true]')||grid.querySelector('button');button?.focus();}
 };
}
