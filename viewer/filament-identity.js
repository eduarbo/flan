// SPDX-License-Identifier: GPL-3.0-or-later
import {language,t} from './i18n.js';
import manufacturerCodes from '../design/filament-color-codes.json' with {type:'json'};

export const filamentColorCode=spool=>manufacturerCodes[spool.series]?.[spool.name];

export function filamentReel(spool){
 const reel=document.createElement('i');
 reel.className='filament-reel';reel.dataset.finish=spool.finish;
 reel.setAttribute('aria-hidden','true');
 reel.style.setProperty('--filament',spool.hex);
 return reel;
}

// Keep the native summary as the single pointer and keyboard target.
export function decorateFilamentDisclosure(details){
 const summary=details.querySelector('summary'),reel=document.createElement('i'),action=document.createElement('span');
 details.classList.add('filament-disclosure');
 reel.className='filament-reel';reel.setAttribute('aria-hidden','true');
 action.className='filament-disclosure-action';action.setAttribute('aria-hidden','true');
 for(const key of ['act.view','act.hide']){
  const word=document.createElement('b');word.dataset.t=key;word.textContent=t(key);action.append(word);
 }
 summary.prepend(reel);summary.append(action);
}

export function flatSwatch(hex){
 const swatch=document.createElement('i');
 swatch.className='filament-swatch';
 swatch.setAttribute('aria-hidden','true');
 swatch.style.backgroundColor=hex;
 return swatch;
}

export function filamentLabel(spool,state){
 const label=document.createElement('span'),name=document.createElement('strong'),series=document.createElement('small');
 label.className='filament-label';series.className='filament-series';
 if(state){
  const mark=document.createElement('span'),selected=state==='selected';
  const description=language()==='es'?(selected?'Bobina asignada':'Bobina sugerida'):(selected?'Assigned spool':'Suggested spool');
  mark.className='filament-state';mark.setAttribute('role','img');mark.setAttribute('aria-label',description);
  mark.title=description;mark.textContent=selected?'✓':'≈';name.append(mark);
 }
 const brand=document.createElement('b');brand.textContent=spool.brand;brand.dataset.brand=spool.brand;
 name.append(spool.name);series.append(brand,' · '+spool.line);
 const code=filamentColorCode(spool);
 if(code)series.append(' · '+code);
 label.append(name,series);
 return label;
}
