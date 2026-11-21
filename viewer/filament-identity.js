// SPDX-License-Identifier: GPL-3.0-or-later
import {language} from './i18n.js';

export function filamentReel(spool){
 const reel=document.createElement('i');
 reel.className='filament-reel';reel.dataset.finish=spool.finish;
 reel.setAttribute('aria-hidden','true');
 reel.style.setProperty('--filament',spool.hex);
 return reel;
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
  const description=language()==='es'?(selected?'Bobina elegida':'Bobina sugerida'):(selected?'Selected spool':'Suggested spool');
  mark.className='filament-state';mark.setAttribute('role','img');mark.setAttribute('aria-label',description);
  mark.title=description;mark.textContent=selected?'✓':'≈';name.append(mark);
 }
 const brand=document.createElement('b');brand.textContent=spool.brand;
 name.append(spool.name);series.append(brand,' · '+spool.line);
 label.append(name,series);
 return label;
}
