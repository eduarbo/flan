// SPDX-License-Identifier: GPL-3.0-or-later
// Page colours from a keyboard theme, in OKLCH: a tint from its most colourful light part, a dark page
// for dark-bodied themes, ink and accent kept readable on either.
const lin=c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4,gam=c=>c<=.0031308?12.92*c:1.055*c**(1/2.4)-.055;
function oklch(hex){
  const [r,g,b]=[1,3,5].map(i=>lin(parseInt(hex.slice(i,i+2),16)/255));
  const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
  const L=.2104542553*l+.793617785*m-.0040720468*s,A=1.9779984951*l-2.428592205*m+.4505937099*s,B=.0259040371*l+.7827717662*m-.808675766*s;
  return [L,Math.hypot(A,B),(Math.atan2(B,A)*180/Math.PI+360)%360];
}
function hex([L,C,H]){
  // reduce chroma until the colour fits in sRGB
  for(let c=C;;c*=.92){
    const a=c*Math.cos(H*Math.PI/180),b=c*Math.sin(H*Math.PI/180);
    const l=(L+.3963377774*a+.2158037573*b)**3,m=(L-.1055613458*a-.0638541728*b)**3,s=(L-.0894841775*a-1.291485548*b)**3;
    const rgb=[4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.707614701*s];
    if(rgb.every(v=>v>=-.0005&&v<=1.0005)||c<.0005)return '#'+rgb.map(v=>Math.round(Math.min(1,Math.max(0,gam(Math.min(1,Math.max(0,v)))))*255).toString(16).padStart(2,'0')).join('');
  }
}
export function pageTokens(theme){
  const base=oklch(theme.base),dark=base[0]<.5;
  const [tint]=[theme.frame.secondary,theme.base].map(oklch).sort((a,b)=>b[1]-a[1]);
  const h=tint[1]<.015?oklch(theme.frame.accent)[2]:tint[2],c=tint[1]<.015?.006:Math.min(tint[1]*.5,.036);
  const accent=oklch(theme.frame.accent),ink=oklch(theme.plate);
  if(!dark)return {
    bg0:hex([.968,c*.55,h]),bg1:hex([.905,c,h]),bg2:hex([.815,c*1.3,h]),glow:theme.frame.secondary,
    ink:hex([.25,Math.min(ink[1],.03),ink[2]]),muted:hex([.47,Math.min(c*1.2,.04),h]),
    accent:hex([Math.min(accent[0],.52),Math.max(accent[1],.06),accent[2]]),on:'#ffffff',scheme:'light'};
  return {
    bg0:hex([.36,c*1.2,base[2]]),bg1:hex([.27,c*1.1,base[2]]),bg2:hex([.2,c,base[2]]),glow:theme.frame.accent,
    ink:hex([.965,.012,base[2]]),muted:hex([.78,Math.min(c*1.2,.04),base[2]]),
    accent:hex([Math.max(accent[0],.74),Math.max(accent[1],.08),accent[2]]),on:hex([.22,.02,base[2]]),scheme:'dark'};
}
