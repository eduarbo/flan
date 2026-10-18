// Option previews for the R4 mockups, per theme: a top view per size, and the case and keycap sources.
// Needs build/showcase/flan36/helpers.cjs.
// FLAN36_PLAYWRIGHT_MODULE=… FLAN36_BROWSER=… node design/proposals/home-r4/src/capture-options.cjs
const fs=require('fs'),path=require('path');const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../../../..'),raw=path.join(root,'build/r4');fs.mkdirSync(raw,{recursive:true});
const {normalize,applyTheme}=require(path.join(root,'build/showcase/flan36/helpers.cjs'));
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p)));const catalog=read('keycaps/catalog.json');
const themes=Object.fromEntries(read('design/themes.json').themes.map(t=>[t.id,t]));
const presets={original:'default',normal:'normal-sculpted',saddle:'saddle-sculpted'};
function design({theme='snes',style='rim',keys='original',variant}={}){
  let c=normalize(structuredClone(catalog.default_configuration),catalog);const pre=read(`design/configurations/${presets[keys]}.json`);
  if(variant)c.variant=variant;
  for(const s of ['left','right']){for(const r of Object.keys(c.keycaps[s]))c.keycaps[s][r]={...pre.keycaps[s][r],color:c.keycaps[s][r].color};c.cases[s].style=style;c.frames[s].style=themes[theme].recommended_frame;}
  return applyTheme(c,themes[theme],['left','right']);
}
const hide='.stage > :not(canvas){visibility:hidden!important}';
const settle=p=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,400)))));
(async()=>{const b=await chromium.launch({executablePath:process.env.FLAN36_BROWSER,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:2});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+path.join(root,'docs/offline.html'));await p.waitForSelector('#loading',{state:'hidden',timeout:400000});
const load=async c=>{await p.setInputFiles('#load-config',{name:'d.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(c))});await settle(p);};
const shot=async name=>{await p.locator('#canvas').screenshot({path:path.join(raw,name+'.png'),style:hide,timeout:180000});};
const view=async v=>{await p.click(`[data-view="${v}"]`);await p.click('#fit');await settle(p);};
for(const theme of (process.env.THEMES||'snes,gameboy').split(',')){
  for(const variant of ['flan36','flan42','flan46','flan54']){
    await load(design({theme,variant}));
    await p.waitForFunction(id=>document.querySelector(`#size-grid [data-variant="${id}"]`)?.getAttribute('aria-pressed')==='true',variant,{timeout:300000});
    await settle(p);await view('top');await shot(`size-${theme}-${variant}`);
  }
  for(const style of ['rim','solid','terrace','level']){await load(design({theme,style}));await view('iso');await shot(`case-${theme}-${style}`);}
  for(const keys of Object.keys(presets)){await load(design({theme,keys}));await view('left');await shot(`keys-${theme}-${keys}`);}
}
console.log(JSON.stringify({errs}));await b.close();})().catch(e=>{console.error(e);process.exit(1);});
