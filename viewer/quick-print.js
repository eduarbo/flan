// SPDX-License-Identifier: GPL-3.0-or-later
import {filamentLabel,filamentReel} from './filament-identity.js';
import {closestSwatch} from './filament-swatches.js';
import {t} from './i18n.js';

export function createQuickPrint({$,getUses,onOpen}){
 const dialog=$('quick-print'),opener=$('quick-print-open');
 // The sheet uses the Build controls and exporter, including their selected values and download status.
 const sections=[['print-controls','quick-settings'],['print-export','quick-download'],['print-plate-plan','quick-plan']].map(([id,destination])=>{
  const node=$(id),anchor=document.createComment(id);
  node.before(anchor);return {node,anchor,destination:$(destination)};
 });
 function sync(){
  if(!dialog.open)return;
  $('quick-spools').replaceChildren(...getUses().map(({hex,chosen})=>{
   const item=document.createElement('li'),spool=chosen||closestSwatch(hex);
   item.append(filamentReel(spool),filamentLabel(spool,chosen?undefined:'suggested'));
   if(!chosen){const hint=document.createElement('small');hint.textContent=t('quick.suggestion',{hex});item.append(hint);}
   return item;
  }));
 }
 opener.onclick=()=>{
  for(const {node,destination} of sections)destination.append(node);
  dialog.showModal();sync();onOpen();$('quick-title').focus({preventScroll:true});
 };
 $('quick-adjust').onclick=()=>{const first=$('print-controls').querySelector('button');first.focus({preventScroll:true});$('quick-settings').scrollIntoView({block:'start'});};
 dialog.querySelector('[data-quick-close]').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{
  for(const {node,anchor} of sections)anchor.after(node);
  if(opener.offsetWidth)opener.focus({preventScroll:true});
 });
 return {sync};
}
