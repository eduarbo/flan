// SPDX-License-Identifier: GPL-3.0-or-later
import {cardStyles} from "./guide-parts.js";
import {motionStyles} from "./solder-motion.js";
export default `
${cardStyles}
${motionStyles}
* { box-sizing:border-box; }
:host { display:block; container-type:inline-size; color:var(--ink,#222e2b); font:15px/1.5 var(--sans,system-ui),sans-serif; }
main { max-width:1050px; margin:auto; padding:clamp(16px,4vw,40px); }
:host([data-embedded]) main { padding:0; }
header,.tools,.reference { display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
header { justify-content:space-between; }
h1,h2,h3,p,figure { margin:0; }
h1,h2 { font-family:var(--serif,Georgia),serif; font-weight:500; line-height:1.1; }
h1 { font-size:clamp(28px,4vw,44px); }
h2 { font-size:clamp(25px,3vw,32px); }
h3 { font-size:16px; }
#intro { margin:0 0 12px; }
.tools { margin-bottom:10px; }
label { display:inline-flex; gap:6px; align-items:center; font-size:14px; }
select,button { min-height:44px; max-width:100%; font:inherit; color:inherit; border:1px solid var(--line,#a7b2a8); border-radius:8px; background:var(--field,#fff); padding:6px 10px; }
select:focus-visible,button:focus-visible { outline:3px solid #3472aa; outline-offset:1px; }
nav { position:sticky; top:0; z-index:2; display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:6px; padding:5px 0; background:var(--bg0,#faf7ef); border-block:1px solid var(--line,#cad1c8); }
:host([data-embedded]) nav { top:var(--build-nav-height,0px); }
nav select { width:100%; }
.step-choice { position:relative; min-width:0; }
#progress { display:none; }
@container(max-width:500px) {
 .step-choice select { color:transparent; }
 .step-choice option { color:var(--ink,#222e2b); }
 #progress { display:block; position:absolute; inset:0; padding-inline:10px; align-content:center; pointer-events:none; }
 #progress::after { content:'⌄'; float:right; }
}
#next { background:var(--ink,#22342e); color:var(--bg0,#fff); }
button:disabled { opacity:.45; }
.stage { display:grid; grid-template-areas:"heading" "parts" "board" "detail" "motion"; gap:12px; padding:14px 0; }
.step-head {grid-area:heading}.part-step{grid-area:parts}.board-figure{grid-area:board}.pad-detail{grid-area:detail;min-width:0}#motion{grid-area:motion;min-width:0}#motion:empty{display:none}
#face,.meta { color:var(--muted,#465a50); font-size:13px; }
#face { margin-bottom:4px; }
#map,.detail svg { display:block; width:100%; height:auto; background:#e7eae5; border-radius:9px; }
.photo-group { cursor:pointer; }
#heading:focus { outline:none; }
figure { min-width:0; }
#caption { margin-top:5px; }
#instruction {margin:4px 0 12px}
#part .guide-parts {grid-template-columns:repeat(2,minmax(0,1fr))}
#part .guide-parts:has(figure:only-child){grid-template-columns:minmax(120px,180px)}
.part-step ol {padding-left:1.4em;margin:4px 0 12px}.part-step li+li{margin-top:5px}
#workbench-tools .guide-parts,#inspection .guide-parts{max-width:560px}
.detail svg { width:100%; max-height:215px; margin:6px 0; }
.reference { justify-content:space-between; }
#overview-link { display:none; padding:2px 6px; min-height:36px; font-size:12px; }
@container(max-width:679px) { #overview-link { display:inline-block; } }
.reference label { font-size:13px; }
.reference select { min-height:38px; }
.finish { display:flex; flex-wrap:wrap; gap:8px; }
#origin { margin-top:10px; }
[hidden] { display:none!important; }
@container(min-width:680px) {
 .stage { grid-template-areas:"heading heading" "board parts" "detail motion";grid-template-columns:minmax(0,1.3fr) minmax(0,1fr); align-items:start; gap:10px 20px; }
 .step-head { grid-column:1/-1; }
}
:host([data-embedded]) header,:host([data-embedded]) #size-field { display:none; }
@container(max-width:430px) { nav button { padding-inline:9px; } }
@media print { :host,main { background:white; padding:0; } nav,.tools,header select,.reference select,button { display:none!important; } figure { break-inside:avoid; } * { print-color-adjust:exact; } }
`;
