// The page a design paints must not hide its case, and its text must stay readable on it.
// Every named theme, then a sweep of plain case colours from black to white. No browser needed:
// node viewer/page-colors-check.mjs
// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pageTokens} from './home/tokens.js';
const themes=JSON.parse(fs.readFileSync(new URL('../design/themes.json',import.meta.url))).themes;
const lin=c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4;
const lum=h=>{const [r,g,b]=[1,3,5].map(i=>lin(parseInt(h.slice(i,i+2),16)/255));return .2126*r+.7152*g+.0722*b;};
const ratio=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return (x+.05)/(y+.05);};
function check(theme,least){
 const k=pageTokens(theme),name=theme.id||theme.base;
 assert(ratio(theme.base,k.bg0)>=least&&ratio(theme.base,k.bg1)>=least,`${name}: the case blends into the page (${ratio(theme.base,k.bg0).toFixed(2)}, ${ratio(theme.base,k.bg1).toFixed(2)})`);
 assert(ratio(k.ink,k.bg1)>=4.5&&ratio(k.muted,k.bg1)>=4.5,`${name}: text is too faint on the page`);
 assert(ratio(k.accent,k.bg1)>=4&&ratio(k.on,k.accent)>=4.5,`${name}: the accent does not read`);
 return Math.min(ratio(theme.base,k.bg0),ratio(theme.base,k.bg1));
}
const named=Math.min(...themes.map(t=>check(t,1.35)));
let plain=Infinity;
for(let v=0;v<=255;v+=3){const grey='#'+v.toString(16).padStart(2,'0').repeat(3);
 for(const accent of ['#c8402f','#2f6fc8','#8fd43a','#f2ead8','#20242c'])plain=Math.min(plain,check({base:grey,plate:'#2a2d33',frame:{body:grey,detail:'#2a2d33',accent,secondary:'#8a8f98'}},1.3));}
console.log(`PASS: ${themes.length} themes keep the case at least ${named.toFixed(2)}:1 from the page, plain case colours at least ${plain.toFixed(2)}:1; text and accent stay readable`);
