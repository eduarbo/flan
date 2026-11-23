// SPDX-License-Identifier: GPL-3.0-or-later
// Browser acceptance for the bench guide. FLAN36_EXPLORER_URL also exercises the published files.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
const expected=[['diode','tweezers'],['socket','switch'],['reset'],['power'],['jack','plug','301230','meter'],['strip','pins','riser','nano'],['view-socket','header','view','sled']];
(async()=>{
 const server=await require('./serve-docs.cjs')(),base=process.env.FLAN36_EXPLORER_URL||server.base+'explore/';
 const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'flan-assembly-'));
 const browser=await chromium.launch({executablePath:process.env.FLAN36_BROWSER,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'}),errors=[];
  context.on('weberror',e=>errors.push(e.error().message));
  const page=await context.newPage();await page.addInitScript(()=>localStorage.setItem('flan.lang','es'));
  await page.goto(base+'?size=flan46&diagnostics#build-solder-u1');await page.waitForFunction(()=>window.flan36?.settled);
  const guide=page.locator('.solder-map');assert.equal(await guide.locator('#step').inputValue(),'5');
  assert.equal(await guide.locator('#part figure').count(),4);
  assert.match(await guide.locator('#part').innerText(),/2 × Tiras Mill-Max.*24 × Pines redondos/s);
  assert.equal(await guide.locator('.fit-motion').getAttribute('data-pose'),'seated');
  await guide.getByRole('button',{name:'Repetir',exact:true}).click();
  assert.notEqual(await guide.locator('.fit-viewport img').evaluate(el=>getComputedStyle(el).animationName),'none');
  await guide.getByRole('button',{name:'Pausar',exact:true}).click();
  assert.equal(await guide.locator('.fit-viewport img').evaluate(el=>getComputedStyle(el).animationPlayState),'paused');
  await guide.getByRole('button',{name:'Separado',exact:true}).click();
  assert.equal(await guide.locator('.fit-viewport img').evaluate(el=>getComputedStyle(el).animationName),'none');
  assert.equal(await guide.locator('.fit-motion').getAttribute('data-pose'),'open');
  const asym=await page.evaluate(()=>flan36.snapshot().configuration);
  asym.batteries.left='adafruit-1570';asym.batteries.right='301230';asym.cases.right.cover=false;
  await page.locator('#load-config').setInputFiles({name:'asymmetric.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(asym))});
  await page.waitForFunction(()=>flan36.snapshot().configuration.cases.right.cover===false);
  await page.click('#build-nav [data-target=build-close]');
  const final=page.locator('#build-final');
  for(const side of ['left','right']){
   await final.locator('[data-assembly-side='+side+']').click();
   for(const img of await final.locator('img[data-build-view]').all()){
    await img.scrollIntoViewIfNeeded();await img.evaluate(el=>new Promise((ok,bad)=>{
     if(el.complete&&el.naturalWidth)return ok();el.addEventListener('load',ok,{once:true});el.addEventListener('error',bad,{once:true});
    }));assert.equal(await img.getAttribute('data-side'),side);
   }
   assert.equal(await final.locator('.assembly-preview[src^="data:image/png"]').count(),2);
   assert.equal(await final.locator('.build-assembly-stages>li').count(),7);
  }
  await page.locator('#build-more').evaluate(el=>el.open=true);
  const planEvent=page.waitForEvent('download');await page.click('#build-plan');
  const planFile=path.join(scratch,'plan.html');await (await planEvent).saveAs(planFile);
  const plan=await context.newPage();await plan.route(/^https?:/,route=>route.abort());await plan.goto(pathToFileURL(planFile).href);
  for(const side of ['left','right']){
   const section=plan.locator('#build-final [data-guide-half="'+side+'"]');
   assert.equal(await section.locator('[data-guide-part="'+(side==='left'?'adafruit-1570':'301230')+'"]').count(),3);
   assert.equal(await section.locator('[data-guide-part=frame]').count(),side==='left'?2:0);
   assert.equal(await section.locator('.assembly-preview[src^="data:image/png"]').count(),2);
  }
  const standalone=await context.newPage();
  await standalone.goto(base+'solder.html?size=flan36&lang=en&leftBattery=301230&rightBattery=301230');
  const root=standalone.locator('#guide');
  for(const size of ['flan36','flan42','flan46','flan54']){
   await root.locator('#size').selectOption(size);
   for(const side of ['left','right']){
    await root.locator('#side').selectOption(side);
    for(const [i,ids] of expected.entries()){
     await root.locator('#step').selectOption(String(i));
     const cards=root.locator('#part figure');
     assert.deepEqual(await cards.evaluateAll(rows=>rows.map(r=>r.dataset.guidePart)),ids);
     await cards.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
     await root.locator('#map image[href^="data:image/"]').waitFor({state:'attached'});
     if([1,5,6].includes(i)){
      const sprite=root.locator('.fit-viewport img');
      const areas=await sprite.evaluate(async img=>{
       await img.decode();const canvas=document.createElement('canvas');canvas.width=340;canvas.height=264;
       const ctx=canvas.getContext('2d',{willReadFrequently:true});
       return [0,5,10].map(f=>{ctx.clearRect(0,0,340,264);ctx.drawImage(img,-340*f,0);
        const rgba=ctx.getImageData(0,0,340,264).data;let area=0,first=264;
        for(let j=3;j<rgba.length;j+=4)if(rgba[j]>128){area++;first=Math.min(first,Math.floor(j/4/340));}
        return [area,first];});
      });
      assert(areas.every(([n])=>n>2600),side+' '+i+' contains the CAD at every sampled pose');
      assert(areas[0][1]<areas[2][1]-10,side+' '+i+' separates and seats');
     }
    }
   }
  }
  await root.locator('#step').selectOption('5');
  const event=standalone.waitForEvent('download');await root.locator('#portable').click();
  const file=path.join(scratch,'guide.html');await (await event).saveAs(file);
  const offline=await context.newPage();
  await offline.route(/^https?:/,route=>route.abort());await offline.goto(pathToFileURL(file).href);
  const saved=offline.locator('#guide');await saved.locator('#side').selectOption('left');await saved.locator('#step').selectOption('6');
  assert.equal(await saved.locator('#part img[src^="data:image/webp"]').count(),4);
  await saved.locator('.fit-viewport img[src^="data:image/webp"]').evaluate(img=>img.decode());
  assert.deepEqual(errors,[]);console.log('PASS: all seven steps, four sizes and both halves, named parts and nonempty CAD animation frames, motion controls, configured assembly and offline guide.');
 }finally{await browser.close();server.close();fs.rmSync(scratch,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
