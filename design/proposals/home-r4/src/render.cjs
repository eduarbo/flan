// Renders the R4 mockups to PNG in design/proposals/home-r4. Run process.sh first.
// FLAN36_PLAYWRIGHT_MODULE=… FLAN36_BROWSER=… node design/proposals/home-r4/src/render.cjs
const path=require('path');const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
const dir=path.resolve(__dirname,'..'),src=f=>'file://'+path.join(dir,'src',f);
const pages=[
  ['a-snes','home.html?theme=snes',1440,900,true],
  ['b-gameboy','home.html?theme=gameboy',1440,900,true],
  ['c-frames','home.html?theme=snes&state=frames',1440,900,false],
  ['t-0','home.html?mix=0&hero=1',1440,900,false],['t-1','home.html?mix=0.5&hero=1',1440,900,false],['t-2','home.html?mix=1&hero=1',1440,900,false],
  ['d-transition','transition.html',1440,480,false],
  ['e-phone','phone.html',390,844,true],
];
(async()=>{const b=await chromium.launch({executablePath:process.env.FLAN36_BROWSER});const errs=[];
for(const [name,file,w,h,full] of pages){
  if(process.env.ONLY&&!process.env.ONLY.split(',').includes(name))continue;
  const p=await b.newPage({viewport:{width:w,height:h},deviceScaleFactor:w<500?3:1.5});
  p.on('pageerror',e=>errs.push(name+': '+e.message));p.on('requestfailed',r=>errs.push(name+': '+r.url()));
  await p.goto(src(file),{waitUntil:'networkidle'});await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(300);
  // the transition stills are inputs for transition.html, not deliverables
  await p.screenshot({path:path.join(name.startsWith('t-')?path.join(dir,'../../../build/r4'):dir,name+'.png'),fullPage:full});await p.close();
}
console.log(JSON.stringify({errs}));await b.close();})().catch(e=>{console.error(e);process.exit(1);});
