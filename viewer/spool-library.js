// SPDX-License-Identifier: GPL-3.0-or-later
import {filamentFilters} from './filament-picker.js';
import {filamentReel,filamentLabel} from './filament-identity.js';
import {catalogSpools,spoolById} from './filament-swatches.js';
import {printThemes} from './preset-filaments.js';
import {t,language} from './i18n.js';
import {ownedSpools,onlyInTab,toggleSpool,watchSpools} from './owned-spools.js';
import {ownedThemeChoices} from './owned-theme-choices.js';
const say=(en,es)=>language()==='es'?es:en;

const alphabetical=[...catalogSpools].sort((a,b)=>a.name.localeCompare(b.name,'en')||a.series.localeCompare(b.series,'en'));
function element(tag,cls,text){
 const node=document.createElement(tag);if(cls)node.className=cls;if(text)node.textContent=text;return node;
}

export function createSpoolLibrary({$,getThemeUses,getCurrentUses,selectionLabel,choices,onInventoryChange}){
 const owned=ownedSpools(),opener=$('my-spools'),filter=$('printable-filter'),note=$('theme-match-note');
 const themesPanel=ownedThemeChoices({$,...choices});
 let filtered=false,manager=null,context=null,selection='',requirements=null;
 function update(){
  $('library-count').textContent=String(owned.size);
  const first=spoolById(owned.values().next().value);
  $('library-icon').replaceChildren(filamentReel(first||{hex:'var(--accent)',finish:'matte'}));
  if(owned.size&&!requirements)requirements=printThemes.map(theme=>getThemeUses(theme));
  let count=0;
  for(const [i,button] of [...$('themes-grid').children].entries()){
   const ready=Boolean(owned.size)&&requirements[i].every(({chosen})=>chosen&&owned.has(chosen.id));
   if(ready)count++;
   button.hidden=filtered&&!ready;
  }
  filter.setAttribute('aria-pressed',String(filtered));
  filter.textContent=owned.size||filtered?t('library.ready',{n:count}):t('library.filter');
  note.hidden=!filtered;
  if(filtered)note.textContent=(count?t('library.showing',{n:count}):t('library.none'))+' · '+selectionLabel();
  return themesPanel.update(owned);
 }
 function open(trigger){
  const dialog=element('dialog','filament-picker spool-library');dialog.setAttribute('aria-labelledby','library-title');
  const header=element('div','dialog-heading'),title=element('h2','title',t('library.title'));
  title.id='library-title';title.tabIndex=-1;
  const close=element('button','',t('library.done'));close.onclick=()=>dialog.close();header.append(title,close);
  const body=element('div','dialog-body'),intro=element('p','library-intro',t('library.hint'));
  const {filters,matches,search}=filamentFilters(render);
  const views=element('div','library-views'),all=element('button','',t('library.catalog')),mine=element('button');
  const themes=element('button','',t('library.try'));
  let view='all',focusThemes=false;
  for(const [button,name] of [[all,'all'],[mine,'mine']]){
   button.onclick=()=>{view=name;render();};views.append(button);
  }
  themes.onclick=()=>{if(owned.size){focusThemes=true;dialog.close();}else{view='themes';render();}};views.append(themes);
  const status=element('p','micro');status.setAttribute('role','status');const results=element('div');
  const current=new Set(getCurrentUses().map(u=>u.chosen?.id).filter(Boolean));
  function render(keepFocus){
   const focusId=keepFocus===true?document.activeElement?.dataset.ownedSpool:null;
   if(view==='themes'&&owned.size)view='all';
   const mineOnly=view==='mine';
   const list=alphabetical.filter(s=>matches(s)&&(!mineOnly||owned.has(s.id)));
   all.setAttribute('aria-pressed',String(view==='all'));mine.setAttribute('aria-pressed',String(mineOnly));
   mine.textContent=t('library.owned',{n:owned.size});
   themes.setAttribute('aria-pressed',String(view==='themes'));filters.hidden=view==='themes';
   status.textContent=onlyInTab()?t('library.tabOnly'):t('library.total',{n:owned.size});results.replaceChildren();
   if(view==='themes'){
    results.append(element('p','',say('Add a spool to get your first theme.','Agrega una bobina para crear tu primer tema.')));
    const add=element('button','',say('Choose spools','Elegir bobinas'));add.onclick=()=>all.click();results.append(add);
    return;
   }
   const groups=mineOnly?[[null,list]]:[[t('library.forDesign'),list.filter(s=>current.has(s.id))],[t('library.more'),list.filter(s=>!current.has(s.id))]];
   let nextFocus;
   for(const [name,spools] of groups){
    if(!spools.length)continue;
    if(name)results.append(element('h3','',name));
    const grid=element('div','spool-grid');
    for(const spool of spools){
     const button=element('button'),active=owned.has(spool.id);
     button.type='button';button.dataset.ownedSpool=spool.id;button.setAttribute('aria-pressed',String(active));
     const mark=element('span','library-mark',active?'✓':'+');mark.setAttribute('aria-hidden','true');
     button.append(filamentReel(spool),filamentLabel(spool),mark);
     button.onclick=()=>toggleSpool(spool);
     grid.append(button);if(spool.id===focusId)nextFocus=button;
    }
    results.append(grid);
   }
   if(!list.length)results.append(element('p','micro',t(mineOnly&&!owned.size?'library.empty':'library.noResults')));
   if(focusId)(nextFocus||mine).focus({preventScroll:true});
  }
  manager=()=>render(true);
  body.append(intro,views,filters,status,results);dialog.append(header,body);document.body.append(dialog);
  dialog.addEventListener('close',()=>{
   manager=null;dialog.remove();
   if(!owned.size&&filtered){filtered=false;update();}
   if(focusThemes)themesPanel.focus();else trigger.focus({preventScroll:true});
  },{once:true});
  render();dialog.showModal();(matchMedia('(pointer: coarse)').matches?title:search).focus({preventScroll:true});
 }
 opener.onclick=()=>open(opener);
 filter.onclick=()=>{
  filtered=!filtered;update();
  if(filtered&&!owned.size)open(filter);
 };
 watchSpools(()=>{onInventoryChange();manager?.();});
 return {sync(config,options){
  if(config!==context||options!==selection){context=config;selection=options;requirements=null;}
  return update();
 }};
}
