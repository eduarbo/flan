// Home page renders of every Flan size (3D and top, transparent WebP), from the built offline viewer.
// FLAN36_PLAYWRIGHT_MODULE=/path/to/playwright-core FLAN36_BROWSER=/path/to/chromium node viewer/capture-home.cjs
// SPDX-License-Identifier: GPL-3.0-or-later
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/images/home');
const hide='.stage > :not(canvas){visibility:hidden!important}';
const settle=p=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,500)))));
(async()=>{
  const b=await chromium.launch({executablePath:process.env.FLAN36_BROWSER,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const p=await b.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1.5});const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+path.join(root,'docs/explore/offline.html'));await p.waitForSelector('#loading',{state:'hidden',timeout:400000});
  for(const id of ['flan36','flan42','flan46','flan54']){
    await p.click('.app-nav [data-mode="customize"]');await p.click('[data-panel="cases"]');await p.click(`#size-grid [data-variant="${id}"]`);
    await p.waitForFunction(id=>document.querySelector(`#size-grid [data-variant="${id}"]`).getAttribute('aria-pressed')==='true',id,{timeout:120000});
    await p.click('#panel-close');await settle(p);
    for(const view of ['iso','top']){
      await p.click(`[data-view="${view}"]`);await p.click('#fit');await settle(p);
      const file=path.join(out,`${id}-${view==='iso'?'3d':'top'}.png`);
      await p.locator('#canvas').screenshot({path:file,style:hide});
      // trim, then clear the viewer background from the corner so the model sits on any page colour
      const webp=file.replace(/\.png$/,'.webp');
      execFileSync('magick',[file,'-fuzz','2%','-trim','+repage','-bordercolor','#eef0f3','-border','4%','-alpha','set','-fuzz','2.5%','-fill','none','-draw','color 0,0 floodfill','-trim','+repage','-strip',webp]);fs.unlinkSync(file);
    }
  }
  console.log(JSON.stringify({errs}));await b.close();
})().catch(e=>{console.error(e);process.exit(1);});
