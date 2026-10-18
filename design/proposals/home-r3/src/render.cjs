const path=require('path');const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE);
// Renders the R3 mockups in this folder to PNG. FLAN36_PLAYWRIGHT_MODULE=… FLAN36_BROWSER=… node design/proposals/home-r3/src/render.cjs
const dir=path.resolve(__dirname,'..');
(async()=>{const b=await chromium.launch({executablePath:process.env.FLAN36_BROWSER});const errs=[];
for(const [f,w,h,s] of [['a-dock',1440,960,1.5],['b-rail',1440,960,1.5],['c-immersive',1440,960,1.5],['d-storyboard',1440,620,1.5],['e-phone',390,844,3]]){
  const p=await b.newPage({viewport:{width:w,height:h},deviceScaleFactor:s});p.on('pageerror',e=>errs.push(f+': '+e.message));p.on('requestfailed',r=>errs.push(f+': '+r.url()));
  await p.goto('file://'+path.join(dir,'src',f+'.html'),{waitUntil:'networkidle'});await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(300);
  await p.screenshot({path:path.join(dir,f+'.png')});await p.close();}
console.log(JSON.stringify({errs}));await b.close();})();
