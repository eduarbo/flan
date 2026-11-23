// SPDX-License-Identifier: GPL-3.0-or-later
import {partURL} from './guide-parts.js';

// Eleven views of the same parts side by side, from apart to seated. The first and last are also the stills.
export function fitMotion(lang,{title,alt,caption}){
 const es=lang==='es',figure=document.createElement('figure');figure.className='fit-motion';
 const viewport=document.createElement('div');viewport.className='fit-viewport';
 const strip=document.createElement('img');strip.alt=alt;viewport.append(strip);
 const controls=document.createElement('div');controls.className='fit-controls';controls.setAttribute('role','group');controls.setAttribute('aria-label',title||alt);
 const labels=es?['Separado','Ensamblado','Repetir']:['Exploded','Assembled','Loop'];
 function select(mode){
  figure.dataset.pose=mode;figure.dataset.paused='false';
  for(const b of controls.children){
   b.setAttribute('aria-pressed',String(b.dataset.mode===mode));
   if(b.dataset.mode==='loop')b.textContent=mode==='loop'?(es?'Pausar':'Pause'):labels[2];
  }
 }
 ['open','seated','loop'].forEach((mode,i)=>{const b=document.createElement('button');b.type='button';b.dataset.mode=mode;b.textContent=labels[i];b.onclick=()=>{
  if(mode==='loop'&&figure.dataset.pose==='loop'){
   const pause=figure.dataset.paused!=='true';figure.dataset.paused=String(pause);b.textContent=pause?(es?'Continuar':'Resume'):(es?'Pausar':'Pause');
  }else select(mode);
 };controls.append(b);});
 select(matchMedia('(prefers-reduced-motion: reduce)').matches?'seated':'loop');
 const text=document.createElement('figcaption');text.textContent=caption;
 if(title){const heading=document.createElement('h3');heading.textContent=title;figure.append(heading);}
 figure.append(viewport,controls,text);return {figure,strip};
}
export function solderMotion(prefix,side,lang){
 const es=lang==='es';
 const {figure,strip}=fitMotion(lang,{title:es?'Cómo encaja':'How it fits',
  alt:prefix==='K'?(es?'Zócalo por debajo de la PCB y switch por encima.':'Socket below the PCB and switch above it.'):prefix==='U1'?(es?'Pines, controlador, soporte y zócalos alineados sobre U1.':'Pins, controller, support and sockets aligned at U1.'):(es?'Conector de la pantalla alineado con el zócalo J2 y su soporte.':'Display header aligned with the J2 socket and printed support.'),
  caption:prefix==='K'?(es?'El zócalo se suelda por el reverso. El switch entra desde la cara contraria después de colocar la placa de switches. Aquí se ve solo la unión con la PCB.':'Solder the socket underneath. Insert the switch from the opposite face after fitting the switch plate. This cutaway shows the PCB connection.'):prefix==='U1'?(es?'El soporte sostiene el módulo nivelado. Comprueba los 2.80 mm entre la cara superior de la PCB y la inferior del controlador.':'The support holds the module level. Check the 2.80 mm gap from the main PCB top to the controller PCB underside.'):(es?'Las colas cortas entran en la pantalla. Los postes largos bajan al zócalo; la separación final entre placas es de 7.00 mm.':'Short tails enter the display. Long posts enter the socket. The finished board gap is 7.00 mm.')});
 strip.dataset.guideArt=side+'-'+prefix.toLowerCase();strip.src=partURL(strip.dataset.guideArt);
 return figure;
}
export const motionStyles=`
.fit-motion{margin:14px 0}.fit-viewport{width:100%;max-width:420px;aspect-ratio:340/264;overflow:hidden;background:#e7eae5;border-radius:9px}
.fit-viewport img{display:block;width:1100%;max-width:none;height:100%;transform:translateX(-90.90909%)}
[data-pose=open] .fit-viewport img{transform:none}
[data-pose=loop] .fit-viewport img{animation:guide-fit 5.5s steps(10,end) infinite}
[data-paused=true] .fit-viewport img{animation-play-state:paused}
@keyframes guide-fit{0%,16%{transform:translateX(0)}78%,100%{transform:translateX(-90.90909%)}}
.fit-controls{display:flex;gap:4px;flex-wrap:wrap;margin:5px 0}.fit-controls button{min-height:36px;font-size:13px}
.fit-controls button[aria-pressed=true]{background:var(--ink,#21332d);color:var(--bg0,#fff)}
.fit-motion figcaption{font-size:14px;line-height:1.45}
@media print{.fit-controls{display:none}.fit-viewport img{animation:none!important;transform:translateX(-90.90909%)!important}}
`;
