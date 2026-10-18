// Shared visual controls for the R3 mockups (static markup, no behaviour).
const ICON={
 case:{
  rim:`<svg viewBox="0 0 48 30"><rect x="3" y="12" width="42" height="14" rx="2" fill="var(--base)"/><rect x="3" y="9" width="42" height="5" rx="1.5" fill="var(--accent)"/><rect x="9" y="8" width="30" height="3" fill="var(--plate)"/></svg>`,
  solid:`<svg viewBox="0 0 48 30"><rect x="3" y="10" width="42" height="16" rx="2" fill="var(--base)"/><rect x="3" y="8" width="42" height="4" rx="1.5" fill="var(--plate)"/></svg>`,
  terrace:`<svg viewBox="0 0 48 30"><rect x="3" y="10" width="42" height="16" rx="2" fill="var(--base)"/><rect x="3" y="15" width="42" height="2" fill="var(--plate)" opacity=".55"/><rect x="3" y="20" width="42" height="2" fill="var(--plate)" opacity=".55"/><rect x="3" y="8" width="42" height="4" rx="1.5" fill="var(--plate)"/></svg>`,
  level:`<svg viewBox="0 0 48 30"><rect x="3" y="5" width="42" height="21" rx="2" fill="var(--base)"/><rect x="8" y="5" width="7" height="4" fill="var(--plate)"/><rect x="18" y="5" width="7" height="4" fill="var(--plate)"/><rect x="28" y="5" width="7" height="4" fill="var(--plate)"/></svg>`},
 keys:{
  original:`<svg viewBox="0 0 48 30"><rect x="3" y="12" width="12" height="9" rx="3" fill="var(--cap)"/><rect x="18" y="12" width="12" height="9" rx="3" fill="var(--cap)"/><rect x="33" y="12" width="12" height="9" rx="3" fill="var(--cap)"/><rect x="2" y="21" width="44" height="3" rx="1" fill="var(--plate)"/></svg>`,
  normal:`<svg viewBox="0 0 48 30"><path d="M3 21V11q6-3 12 1v9z" fill="var(--cap)"/><path d="M18 21v-9q6-2 12 0v9z" fill="var(--cap)"/><path d="M33 21v-9q6-4 12-1v10z" fill="var(--cap)"/><rect x="2" y="21" width="44" height="3" rx="1" fill="var(--plate)"/></svg>`,
  saddle:`<svg viewBox="0 0 48 30"><path d="M3 21V10q6 5 12 0v11z" fill="var(--cap)"/><path d="M18 21V10q6 5 12 0v11z" fill="var(--cap)"/><path d="M33 21V10q6 5 12 0v11z" fill="var(--cap)"/><rect x="2" y="21" width="44" height="3" rx="1" fill="var(--plate)"/></svg>`},
 layers:{
  together:`<svg viewBox="0 0 30 30"><rect x="4" y="12" width="22" height="4" rx="1" fill="currentColor"/><rect x="4" y="16" width="22" height="4" rx="1" fill="currentColor" opacity=".55"/><rect x="4" y="20" width="22" height="3" rx="1" fill="currentColor" opacity=".3"/></svg>`,
  apart:`<svg viewBox="0 0 30 30"><rect x="4" y="4" width="22" height="4" rx="1" fill="currentColor"/><rect x="4" y="13" width="22" height="4" rx="1" fill="currentColor" opacity=".55"/><rect x="4" y="22" width="22" height="3" rx="1" fill="currentColor" opacity=".3"/></svg>`},
 reset:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/></svg>`,
 rotate:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 12c0-3 4-5 9-5s9 2 9 5-4 5-9 5"/><path d="M9 14l3 3-3 3"/></svg>`};
const THEMES=[['SNES','#d1d0c9','#464751','#746198'],['Flan','#f2dfaf','#68422f','#b96732'],['Talavera','#f1e6ca','#244e91','#e8693d'],['Game Boy','#dcd6ba','#42454d','#a33e61'],['NES','#c6c7be','#32363b','#c83b32'],['Walkman','#275273','#192d3b','#e7b23f'],['2000s Phone','#263c55','#b8bbb5','#8fbf6a'],['Manga','#f0eadb','#27282e','#d4423b']];
function controls(el,{assets,layout='row',size='flan36'}){
  const g=(label,body,cls='')=>`<div class="grp ${cls}"><span class="lab">${label}</span><div class="opts">${body}</div></div>`;
  const sil=z=>`<svg viewBox="${SIZE_BOX.join(' ')}"><path d="${SIZE_PATHS[z]}" fill="currentColor" fill-rule="evenodd"/></svg>`;
  const sizes=['flan36','flan42','flan46','flan54'].map(z=>`<button class="tile ${z===size?'on':''}">${sil(z)}<span>${z.replace('flan','')}</span></button>`).join('');
  const themes=THEMES.map((t,i)=>`<button class="sw ${i?'':'on'}" title="${t[0]}" style="background:conic-gradient(${t[1]} 0 50%,${t[2]} 0 78%,${t[3]} 0)"></button>`).join('');
  const cases=['rim','solid','terrace','level'].map((c,i)=>`<button class="ico ${i?'':'on'}">${ICON.case[c]}<span>${{rim:'Color rim',solid:'Solid',terrace:'Terrace',level:'Level'}[c]}</span></button>`).join('');
  const keys=['original','normal','saddle'].map((k,i)=>`<button class="ico ${i?'':'on'}">${ICON.keys[k]}<span>${{original:'Original',normal:'Sculpted',saddle:'Saddle'}[k]}</span></button>`).join('');
  const layers=`<div class="layers"><i>${ICON.layers.together}</i><span class="track"><span class="fill"></span><span class="knob"></span></span><i>${ICON.layers.apart}</i><button class="reset" title="Put it back together">${ICON.reset}</button></div>`;
  el.innerHTML=g('Size',sizes,'sizes')+g('Theme',themes,'themes')+g('Case',cases)+g('Keycaps',keys)+g('Layers',layers,'lay');
  el.classList.add('controls',layout);
}
