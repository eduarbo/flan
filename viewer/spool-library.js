// SPDX-License-Identifier: GPL-3.0-or-later
import {filamentFilters} from './filament-picker.js';
import {filamentReel,filamentLabel} from './filament-identity.js';
import {catalogSpools,spoolById} from './filament-swatches.js';
import {printThemes} from './preset-filaments.js';
import {t} from './i18n.js';

const prefix='flan.spools.v1/';
const alphabetical=[...catalogSpools].sort((a,b)=>a.name.localeCompare(b.name,'en')||a.series.localeCompare(b.series,'en'));
function element(tag,cls,text){
 const node=document.createElement(tag);if(cls)node.className=cls;if(text)node.textContent=text;return node;
}

export function createSpoolLibrary({$,getThemeUses,getCurrentUses,selectionLabel}){
 const owned=new Set(),unsaved=new Map(),opener=$('my-spools'),filter=$('printable-filter'),note=$('theme-match-note');
 let tabOnly=false,filtered=false,manager=null,context=null,selection='',requirements=null;
 // Independent keys let two tabs add different spools without overwriting one another.
 function read(){
  try{
   const saved=catalogSpools.filter(spool=>localStorage.getItem(prefix+spool.id)==='1');
   owned.clear();for(const spool of saved)owned.add(spool.id);
   for(const [id,has] of unsaved){if(has)owned.add(id);else owned.delete(id);}
  }catch{tabOnly=true;}
 }
 read();
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
 }
 function change(spool){
  const add=!owned.has(spool.id);
  try{
   if(add)localStorage.setItem(prefix+spool.id,'1');else localStorage.removeItem(prefix+spool.id);
   unsaved.delete(spool.id);tabOnly=unsaved.size>0;
  }catch{tabOnly=true;unsaved.set(spool.id,add);}
  if(add)owned.add(spool.id);else owned.delete(spool.id);
  update();
 }
 function open(trigger){
  const dialog=element('dialog','filament-picker spool-library');dialog.setAttribute('aria-labelledby','library-title');
  const header=element('div','dialog-heading'),title=element('h2','title',t('library.title'));
  title.id='library-title';title.tabIndex=-1;
  const close=element('button','',t('library.done'));close.onclick=()=>dialog.close();header.append(title,close);
  const body=element('div','dialog-body'),intro=element('p','library-intro',t('library.hint'));
  const {filters,matches,search}=filamentFilters(render);
  const views=element('div','library-views'),all=element('button','',t('library.catalog')),mine=element('button');
  let mineOnly=false;all.onclick=()=>{mineOnly=false;render();};mine.onclick=()=>{mineOnly=true;render();};views.append(all,mine);
  const status=element('p','micro');status.setAttribute('role','status');const results=element('div');
  const current=new Set(getCurrentUses().map(u=>u.chosen?.id).filter(Boolean));
  function render(keepFocus){
   const focusId=keepFocus===true?document.activeElement?.dataset.ownedSpool:null;
   const list=alphabetical.filter(s=>matches(s)&&(!mineOnly||owned.has(s.id)));
   all.setAttribute('aria-pressed',String(!mineOnly));mine.setAttribute('aria-pressed',String(mineOnly));
   mine.textContent=t('library.owned',{n:owned.size});
   status.textContent=tabOnly?t('library.tabOnly'):t('library.total',{n:owned.size});results.replaceChildren();
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
     button.onclick=()=>{change(spool);render(true);};
     grid.append(button);if(spool.id===focusId)nextFocus=button;
    }
    results.append(grid);
   }
   if(!list.length)results.append(element('p','micro',t(mineOnly&&!owned.size?'library.empty':'library.noResults')));
   if(focusId)(nextFocus||mine).focus({preventScroll:true});
  }
  manager=()=>render(true);
  body.append(intro,filters,views,status,results);dialog.append(header,body);document.body.append(dialog);
  dialog.addEventListener('close',()=>{
   manager=null;dialog.remove();
   if(!owned.size&&filtered){filtered=false;update();}
   trigger.focus({preventScroll:true});
  },{once:true});
  render();dialog.showModal();(matchMedia('(pointer: coarse)').matches?title:search).focus({preventScroll:true});
 }
 opener.onclick=()=>open(opener);
 filter.onclick=()=>{
  filtered=!filtered;update();
  if(filtered&&!owned.size)open(filter);
 };
 window.addEventListener('storage',event=>{
  if(event.key!==null&&!event.key.startsWith(prefix))return;
  read();update();manager?.();
 });
 return {sync(config,options){
  if(config!==context||options!==selection){context=config;selection=options;requirements=null;}
  update();
 }};
}
