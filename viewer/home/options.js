// SPDX-License-Identifier: GPL-3.0-or-later
// What the home page's rail offers and the look it opens with: read by the page (app.js) and by the build
// (viewer/home-build.mjs), which writes the rail into the page so nothing moves when the script starts.
export const CASES=[['rim','Color rim'],['solid','Solid'],['terrace','Terrace'],['level','Level']];
export const KEYS=[['original','Original'],['normal','Sculpted'],['saddle','Saddle']];
export const GROUPS=['size','theme','case','keys','frame'];
// The look the page opens with, and the one its poster and share image show.
export const DEFAULT={size:'flan36',theme:'eva-01',case:'rim',keys:'original',frame:{left:'snes',right:'phone'},own:{left:false,right:false}};
// a phone shows one group at a time
export const TAB='theme';
