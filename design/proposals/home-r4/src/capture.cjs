// Raw viewer shots for the R4 mockups: the standby model per theme (apart, turned a little).
// Needs build/showcase/flan36/helpers.cjs.
// FLAN36_PLAYWRIGHT_MODULE=… FLAN36_BROWSER=… node design/proposals/home-r4/src/capture.cjs
const fs=require('fs'),path=require('path');const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../../../..'),raw=path.join(root,'build/r4');fs.mkdirSync(raw,{recursive:true});
const {normalize,applyTheme}=require(path.join(root,'build/showcase/flan36/helpers.cjs'));
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p)));const catalog=read('keycaps/catalog.json');
const themes=Object.fromEntries(read('design/themes.json').themes.map(t=>[t.id,t]));
const presets={original:'default',normal:'normal-sculpted',saddle:'saddle-sculpted'};
function design({theme='snes',style='rim',keys='original'}={}){
  let c=normalize(structuredClone(catalog.default_configuration),catalog);const pre=read(`design/configurations/${presets[keys]}.json`);
  for(const s of ['left','right']){for(const r of Object.keys(c.keycaps[s]))c.keycaps[s][r]={...pre.keycaps[s][r],color:c.keycaps[s][r].color};c.cases[s].style=style;c.frames[s].style=themes[theme].recommended_frame;}
  return applyTheme(c,themes[theme],['left','right']);
}
const hide='.stage > :not(canvas){visibility:hidden!important}';
const settle=p=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,400)))));
(async()=>{const b=await chromium.launch({executablePath:process.env.FLAN36_BROWSER,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:2});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+path.join(root,'docs/offline.html'));await p.waitForSelector('#loading',{state:'hidden',timeout:400000});
const load=async c=>{await p.setInputFiles('#load-config',{name:'d.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(c))});await settle(p);};
const explode=v=>p.evaluate(v=>{const e=document.getElementById('explode');e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},v);
const shot=async name=>{await p.locator('#canvas').screenshot({path:path.join(raw,name+'.png'),style:hide,timeout:180000});};
// standby pose per theme: apart, turned a little
for(const theme of (process.env.THEMES||'snes,gameboy').split(',')){
  await load(design({theme}));await p.click('[data-view="iso"]');await explode(75);await p.click('#fit');await settle(p);
  const box=await p.locator('#canvas').boundingBox();await p.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await p.mouse.down();await p.mouse.move(box.x+box.width*.44,box.y+box.height*.51,{steps:12});await p.mouse.up();await p.click('#fit');await settle(p);
  await shot('standby-'+theme);
}
console.log(JSON.stringify({errs}));await b.close();})().catch(e=>{console.error(e);process.exit(1);});
