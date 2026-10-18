// Frame shots for the R4 mockups. On the home page the theme owns the colors and a frame choice changes only its shape,
// so every frame is shot in the theme's colors: a top view per frame and theme (cropped to the frame by process.sh),
// and the SNES standby pose previewing Talavera for the frame browser.
// FLAN36_PLAYWRIGHT_MODULE=… FLAN36_BROWSER=… node design/proposals/home-r4/src/capture-preview.cjs
const fs=require('fs'),path=require('path');const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../../../..'),raw=path.join(root,'build/r4');fs.mkdirSync(raw,{recursive:true});
const {normalize,applyTheme}=require(path.join(root,'build/showcase/flan36/helpers.cjs'));
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p)));const catalog=read('keycaps/catalog.json');
const themes=Object.fromEntries(read('design/themes.json').themes.map(t=>[t.id,t]));
const frames=['talavera','gameboy','snes','phone','ipod','hanafuda'];
function design(theme,frame){
  let c=applyTheme(normalize(structuredClone(catalog.default_configuration),catalog),themes[theme],['left','right']);
  for(const s of ['left','right']){c.cases[s].style='rim';c.frames[s].style=frame;}
  return c;
}
const hide='.stage > :not(canvas){visibility:hidden!important}';
const settle=p=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,400)))));
(async()=>{const b=await chromium.launch({executablePath:process.env.FLAN36_BROWSER,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:2});const errs=[],shown={};p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+path.join(root,'docs/offline.html'));await p.waitForSelector('#loading',{state:'hidden',timeout:400000});
const load=async c=>{await p.setInputFiles('#load-config',{name:'d.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(c))});await settle(p);};
const explode=v=>p.evaluate(v=>{const e=document.getElementById('explode');e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},v);
const shot=name=>p.locator('#canvas').screenshot({path:path.join(raw,name+'.png'),style:hide,timeout:180000});
for(const theme of ['snes','gameboy'])for(const frame of frames){
  await load(design(theme,frame));shown[`${theme}/${frame}`]=await p.evaluate(()=>document.getElementById('frame-current')?.textContent);
  await explode(0);await p.click('[data-view="top"]');await p.click('#fit');await settle(p);await shot(`top-${theme}-${frame}`);
}
// the same standby pose as capture.cjs
await load(design('snes','talavera'));await p.click('[data-view="iso"]');await explode(75);await p.click('#fit');await settle(p);
const box=await p.locator('#canvas').boundingBox();await p.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await p.mouse.down();await p.mouse.move(box.x+box.width*.44,box.y+box.height*.51,{steps:12});await p.mouse.up();await p.click('#fit');await settle(p);
await shot('standby-snes-talavera');
console.log(JSON.stringify({errs,shown}));await b.close();})().catch(e=>{console.error(e);process.exit(1);});
