// SPDX-License-Identifier: GPL-3.0-or-later
import {spoolById} from './filament-swatches.js';
import {ownedRecipe} from './owned-themes.js';

const prefix='flan.pinned-theme.v1/';
export const recipeId=recipe=>'spools:'+recipe.roles.map(spool=>spool.id).join('|');

export function themeFromId(id){
 if(typeof id!=='string'||!id.startsWith('spools:')||id.length>500)return null;
 const spools=id.slice(7).split('|').map(spoolById);
 if(spools.length!==3||spools.some(spool=>!spool||spool.material!==spools[0]?.material))return null;
 if(new Set(spools.map(spool=>spool.hex)).size!==new Set(spools.map(spool=>spool.id)).size)return null;
 const recipe=ownedRecipe(...spools);
 recipe.id=id;
 recipe.name=recipe.material+' · '+[...new Set(spools.map(spool=>spool.name))].join(' / ');
 return recipe;
}

// A separate key per pin keeps simultaneous edits to different themes independent.
export function themePins(onChange){
 let entries=new Map();
 function read(){
  const rows=[];
  try{
   for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);if(!key?.startsWith(prefix))continue;
    const recipe=themeFromId(key.slice(prefix.length));
    if(recipe)rows.push([Number(localStorage.getItem(key))||0,recipe]);
   }
  }catch{return;}
  rows.sort(([ta,a],[tb,b])=>tb-ta||a.id.localeCompare(b.id));
  entries=new Map(rows.map(([,recipe])=>[recipe.id,recipe]));
 }
 read();
 window.addEventListener('storage',event=>{
  if(event.key!==null&&!event.key.startsWith(prefix))return;
  read();onChange();
 });
 return {
  all:()=>[...entries.values()],
  has:id=>entries.has(id),
  toggle(recipe){
   const id=recipeId(recipe),key=prefix+id;
   try{
    if(localStorage.getItem(key)!==null)localStorage.removeItem(key);
    else localStorage.setItem(key,String(Date.now()));
   }catch{return false;}
   read();onChange();return true;
  }
 };
}

export function recipeChip(recipe,apply){
 const button=document.createElement('button'),swatch=document.createElement('i'),label=document.createElement('span');
 button.type='button';button.title=recipe.name;
 swatch.setAttribute('aria-hidden','true');swatch.style.cssText='--a:'+recipe.keycaps.base+';--b:'+recipe.base+';--c:'+recipe.frame.accent;
 label.textContent=recipe.name;button.append(swatch,label);button.onclick=()=>apply(recipe);
 return button;
}

export function pinnedStrip(section,grid,apply){
 let list='';
 return (recipes,active)=>{
  const ids=JSON.stringify(recipes.map(theme=>theme.id));
  if(ids!==list){
   list=ids;
   grid.replaceChildren(...recipes.map(recipe=>{
    const button=recipeChip(recipe,apply);button.dataset.pinnedTheme=recipe.id;
    return button;
   }));
  }
  section.hidden=!recipes.length;
  for(const button of grid.children)button.setAttribute('aria-pressed',String(button.dataset.pinnedTheme===active));
 };
}
