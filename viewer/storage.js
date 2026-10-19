// SPDX-License-Identifier: GPL-3.0-or-later
import {check,normalize,retiredFrames,retiredReplacementNames} from './config.js';
import {t} from './i18n.js';
export const savedKey='flan36.configuration.v1';
const legacyKey='filo36.configuration.v1';
export const recoveryPrefix='flan36.recovery.';
const uniqueId=()=>crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
// Reading is side-effect free, including failed migration.
export function restoreConfiguration(storage,catalog){
 for(const key of [savedKey,legacyKey])try{
  const raw=storage.getItem(key);if(raw===null)continue;
  if(raw.length>100000)throw Error('Oversized configuration');
  const parsed=JSON.parse(raw);if(check(parsed,catalog).errors.length)throw Error('Invalid configuration');
  return {configuration:normalize(parsed,catalog),message:retiredFrames(parsed,catalog).length?t('store.retired',{names:retiredReplacementNames(parsed,catalog)}):''};
 }catch{return {configuration:null,message:t('store.unreadable')};}
 return {configuration:null,message:''};
}
// Cooperating tabs serialize compare-and-write. Stale edits become separate
// recovery drafts. No lock means no shared write. Recovery keys survive reload.
export function createStore({key,validate,storage=()=>localStorage,locks=()=>navigator.locks,notify=()=>{},preserveBeforeWrite=()=>false}){
 let expected=null,invalid=false,queue=Promise.resolve(),sequence=0;
 const draftKey=recoveryPrefix+key+'.'+uniqueId();
 try{expected=storage().getItem(key);if(expected!==null)validateRaw(expected);}catch{invalid=true;}
 const initialRaw=expected;
 function validateRaw(raw){if(raw.length>100000)throw Error(t('store.large'));return validate(JSON.parse(raw));}
 function recover(raw,label){storage().setItem(draftKey,JSON.stringify({key,label,raw}));}
 function save(value){
  const raw=JSON.stringify(value),ticket=++sequence;
  // Preserve the newest edit synchronously even if this tab closes while the
  // shared write is waiting for a lock. Only that edit may remove its draft.
  try{recover(raw,'Pending draft');}catch{notify(t('store.tabOnly'),true);}
  queue=queue.then(async()=>{
   let notice;
   try{
    const manager=locks();
    if(!manager?.request){recover(raw,'Unsaved draft');notice=t('store.noLocks');}
    else await manager.request(key,{mode:'exclusive'},()=>{
     const current=storage().getItem(key);
     if(invalid||current!==expected){recover(raw,'Conflicting draft');notice=t('store.conflict');return;}
     if(current!==null&&preserveBeforeWrite(JSON.parse(current)))storage().setItem(recoveryPrefix+key+'.'+uniqueId(),JSON.stringify({key,label:'Before retired-frame migration',raw:current}));
     storage().setItem(key,raw);expected=raw;
     if(ticket===sequence)try{storage().removeItem?.(draftKey);}catch{/* A redundant recovery copy is harmless. */}
    });
   }catch{notice=t('store.unavailable');}
   if(ticket===sequence)notify(notice||t('store.saved'),!!notice);
   return !notice;
  });return queue;
 }
 function enqueue(operation){const result=queue.then(operation);queue=result.catch(()=>{});return result;}
 return {save,initialRaw,load(){return enqueue(()=>{const raw=storage().getItem(key);if(raw===null)throw Error(t('store.none'));const value=validateRaw(raw);expected=raw;invalid=false;return value;});},replace(value){
  const raw=JSON.stringify(value);++sequence;
  return enqueue(async()=>{
   const manager=locks();if(!manager?.request)throw Error(t('store.noShared'));
   await manager.request(key,{mode:'exclusive'},()=>{
    const current=storage().getItem(key);
    if(current!==null)storage().setItem(recoveryPrefix+key+'.'+uniqueId(),JSON.stringify({key,label:'Previous saved data',raw:current}));
    storage().setItem(key,raw);expected=raw;invalid=false;
   });notify(t('store.replaced'),false);
  });
 },idle:()=>queue};
}
