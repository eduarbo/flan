// Hero and load-animation shots for the R3 mockups (SNES · Color rim · Original, Flan36) from the offline viewer.
// Needs build/showcase/flan36/helpers.cjs from viewer/capture-showcase.cjs. ONLY_ANIM=1 renders the four animation frames.
// FLAN36_PLAYWRIGHT_MODULE=… FLAN36_BROWSER=… node design/proposals/home-r3/src/capture.cjs
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE);
const root=path.resolve(__dirname,'../../../..'),out=path.join(root,'design/proposals/home-r3/assets'),work=path.join(root,'build/hero');fs.mkdirSync(work,{recursive:true});
const {normalize,applyTheme}=require(path.join(root,'build/showcase/flan36/helpers.cjs'));
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p)));const catalog=read('keycaps/catalog.json');
const theme=read('design/themes.json').themes.find(t=>t.id==='snes');
let c=normalize(structuredClone(catalog.default_configuration),catalog);for(const s of ['left','right']){c.cases[s].style='rim';c.frames[s].style='snes';}c=applyTheme(c,theme,['left','right']);c.pcb_edition='asanoha';c.pcb_mask='purple';
const hide='.stage > :not(canvas){visibility:hidden!important}';
const settle=p=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,500)))));
(async()=>{const b=await chromium.launch({executablePath:process.env.FLAN36_BROWSER,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:2});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+path.join(root,'docs/offline.html'));await p.waitForSelector('#loading',{state:'hidden',timeout:400000});
await p.setInputFiles('#load-config',{name:'snes.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(c))});await settle(p);
const shot=async(name,{view='iso',explode=0,zoom=0,at=null}={})=>{
  await p.click(`[data-view="${view}"]`);await p.evaluate(v=>{const e=document.getElementById('explode');e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},explode);
  await p.click('#fit');await settle(p);
  if(zoom){const box=await p.locator('#canvas').boundingBox();await p.mouse.move(box.x+box.width*(at?at[0]:.5),box.y+box.height*(at?at[1]:.5));for(let i=0;i<zoom;i++){await p.mouse.wheel(0,-120);await p.waitForTimeout(60);}await settle(p);}
  const png=path.join(work,name+'.png');await p.locator('#canvas').screenshot({path:png,style:hide});
  execFileSync('magick',[png,'-fuzz','2%','-trim','+repage','-bordercolor','#eef0f3','-border','2%','-alpha','set','-fuzz','2.5%','-fill','none','-draw','color 0,0 floodfill','-strip',path.join(out,name+'.png')]);};
// load animation frames: assembled, separating, separated; then a standby turn (drag the orbit)
await shot('anim-0');await shot('anim-1',{explode:35});await shot('anim-2',{explode:75});
await p.click('[data-view="iso"]');await p.evaluate(()=>{const e=document.getElementById('explode');e.value=75;e.dispatchEvent(new Event('input',{bubbles:true}));});await p.click('#fit');await settle(p);
{const box=await p.locator('#canvas').boundingBox();await p.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await p.mouse.down();await p.mouse.move(box.x+box.width*.44,box.y+box.height*.51,{steps:12});await p.mouse.up();await p.click('#fit');await settle(p);
 const png=path.join(work,'anim-3.png');await p.locator('#canvas').screenshot({path:png,style:hide});
 execFileSync('magick',[png,'-fuzz','2%','-trim','+repage','-bordercolor','#eef0f3','-border','2%','-alpha','set','-fuzz','2.5%','-fill','none','-draw','color 0,0 floodfill','-strip',path.join(out,'anim-3.png')]);}
if(process.env.ONLY_ANIM){console.log('anim only');await b.close();return;}
await shot('hero-3d');await shot('hero-exploded',{explode:70});await shot('hero-top',{view:'top'});await shot('hero-front',{view:'front'});
// underside with an edition
await p.click('.app-nav [data-mode="customize"]');await p.click('[data-panel="pcb"]');await p.click('#pcb-underside');await p.waitForTimeout(3000);await p.click('#panel-close');await settle(p);
const png=path.join(work,'hero-under.png');await p.locator('#canvas').screenshot({path:png,style:hide});
execFileSync('magick',[png,'-fuzz','2%','-trim','+repage','-bordercolor','#eef0f3','-border','2%','-alpha','set','-fuzz','2.5%','-fill','none','-draw','color 0,0 floodfill','-strip',path.join(out,'hero-under.png')]);
console.log(JSON.stringify({errs}));await b.close();})().catch(e=>{console.error(e);process.exit(1);});
