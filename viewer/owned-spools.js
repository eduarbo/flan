// SPDX-License-Identifier: GPL-3.0-or-later
import {catalogSpools} from './filament-swatches.js';

const prefix='flan.spools.v1/',ids=new Set(),unsaved=new Map(),listeners=new Set();
let initialized=false,tabOnly=false;
function read(){
 try{
  const saved=catalogSpools.filter(spool=>localStorage.getItem(prefix+spool.id)==='1');
  ids.clear();for(const spool of saved)ids.add(spool.id);
  for(const [id,has] of unsaved){if(has)ids.add(id);else ids.delete(id);}
  tabOnly=unsaved.size>0;
 }catch{tabOnly=true;}
}
export function ownedSpools(){
 if(!initialized){
  read();initialized=true;
  window.addEventListener('storage',event=>{
   if(event.key!==null&&!event.key.startsWith(prefix))return;
   read();for(const listener of listeners)listener();
  });
 }
 return ids;
}
export const onlyInTab=()=>tabOnly;
export function watchSpools(listener){listeners.add(listener);return ()=>listeners.delete(listener);}
export function toggleSpool(spool){
 const add=!ownedSpools().has(spool.id);
 try{
  if(add)localStorage.setItem(prefix+spool.id,'1');else localStorage.removeItem(prefix+spool.id);
  unsaved.delete(spool.id);tabOnly=unsaved.size>0;
 }catch{tabOnly=true;unsaved.set(spool.id,add);}
 if(add)ids.add(spool.id);else ids.delete(spool.id);
 for(const listener of listeners)listener();
}
