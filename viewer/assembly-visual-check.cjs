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
  assert(await guide.locator('#workbench-tools').isHidden());assert(await guide.locator('#final-inspection').isHidden());
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
  const final=page.locator('#build-final'),nav=final.locator('.assembly-nav'),step=final.locator('.assembly-step:not([hidden])');
  const previous=nav.locator('[data-move="-1"]'),next=nav.locator('[data-move="1"]');
  const views=()=>[['battery-stack'],['board-screws','plate-screws'],['key-stack'],['battery-port'],['display-stack'],['base-feet']];
  for(const side of ['left','right']){
   await final.locator('[data-assembly-side='+side+']').click();
   await nav.locator('select').selectOption('0');assert(await previous.isDisabled());
   for(const [i,ids] of views(side).entries()){
    assert.equal(await step.count(),1);assert.equal(await step.getAttribute('data-assembly-step'),String(i));
    assert.equal(await nav.locator('.assembly-progress').innerText(),'Paso '+(i+1)+' de 6');
    // Moving on leaves the bar pinned and the new title in view below it.
    if(i)assert(await step.locator('h4').evaluate(h=>{const bar=h.closest('#build-final').querySelector('.assembly-nav').getBoundingClientRect(),box=h.getBoundingClientRect();return box.top>=bar.bottom-1&&box.bottom<innerHeight;}));
    const still=ids[0]==='battery-port',pictures=step.locator('.assembly-preview');
    assert.deepEqual(await pictures.evaluateAll(list=>list.map(img=>img.dataset.buildView)),ids);
    assert.equal(await step.locator('.fit-motion').count(),still?0:ids.length);
    for(const img of await pictures.all()){
     await img.scrollIntoViewIfNeeded();await img.locator('xpath=self::img[starts-with(@src,"data:image/")]').waitFor();
     assert.equal(await img.getAttribute('data-side'),side);
     // Eleven frames side by side where parts come down, and the first differs from the last.
     const frames=await img.evaluate(async el=>{await el.decode();return el.naturalWidth/680;});
     assert.equal(frames,still?1:11);
     assert(await img.evaluate(el=>{
      const canvas=document.createElement('canvas');canvas.width=680;canvas.height=528;const ctx=canvas.getContext('2d');ctx.drawImage(el,0,0);
      const data=ctx.getImageData(0,0,680,528).data;let solid=0;for(let k=3;k<data.length;k+=4)if(data[k]>200)solid++;
      return solid>20000;
     }),'the picture shows parts');
     if(!still)assert(await img.evaluate(el=>{
      const canvas=document.createElement('canvas');canvas.width=680;canvas.height=528;const ctx=canvas.getContext('2d',{willReadFrequently:true});
      const frame=f=>{ctx.clearRect(0,0,680,528);ctx.drawImage(el,-680*f,0);return ctx.getImageData(0,0,680,528).data;};
      const apart=frame(0),seated=frame(10);let moved=0;for(let k=0;k<apart.length;k++)if(Math.abs(apart[k]-seated[k])>40)moved++;
      return moved>100;
     }));
    }
    if(i===0){
     assert(await step.locator('[data-guide-part="'+(side==='left'?'adafruit-1570':'301230')+'"]').isVisible());
     const motion=step.locator('.fit-motion');assert.equal(await motion.getAttribute('data-pose'),'seated');
     await motion.getByRole('button',{name:'Separado',exact:true}).click();assert.equal(await motion.getAttribute('data-pose'),'open');
    }
    if(i===3)assert(await step.locator('[data-guide-part=meter]').isVisible(),'the polarity check has its multimeter');
    if(i===4)assert.equal(await step.locator('[data-guide-part=frame]').count(),side==='left'?1:0);
    assert.equal(await final.locator('.assembly-finish').isVisible(),i===5);
    if(i<5)await next.click();
   }
   assert(await next.isDisabled());
  }
  await final.locator('.assembly-finish button').click();
  assert.equal(await final.locator('[data-assembly-side][aria-pressed=true]').getAttribute('data-assembly-side'),'left');
  assert.equal(await nav.locator('select').inputValue(),'0');
  await page.locator('#build-more').evaluate(el=>el.open=true);
  const planEvent=page.waitForEvent('download');await page.click('#build-plan');
  const planFile=path.join(scratch,'plan.html');await (await planEvent).saveAs(planFile);
  const plan=await context.newPage();await plan.route(/^https?:/,route=>route.abort());await plan.goto(pathToFileURL(planFile).href);
  for(const side of ['left','right']){
   const section=plan.locator('#build-final [data-guide-half="'+side+'"]');
   assert.equal(await section.locator('.assembly-step').count(),6);
   assert.equal(await section.locator('[data-guide-part="'+(side==='left'?'adafruit-1570':'301230')+'"]').count(),1);
   assert.equal(await section.locator('[data-guide-part=frame]').count(),side==='left'?1:0);
   assert.equal(await section.locator('.fit-controls').count(),0);
   const stills=section.locator('.assembly-preview');
   assert.deepEqual(await stills.evaluateAll(imgs=>imgs.map(img=>img.dataset.buildView)),views(side).flat());
   assert(await stills.evaluateAll(async imgs=>{await Promise.all(imgs.map(img=>img.decode()));return imgs.every(img=>img.src.startsWith('data:image/')&&img.naturalWidth===680);}));
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
     assert.equal(await root.locator('#workbench-tools summary').isVisible(),i===0);
     assert.equal(await root.locator('#bench').isVisible(),i===expected.length-1);
     assert.equal(await root.locator('#checks').isVisible(),i===expected.length-1);
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
  await root.locator('#next').click();assert(await root.locator('#bench').evaluate(el=>el===el.getRootNode().activeElement));
  await root.locator('#other-side').click();
  const tools=root.locator('#workbench-tools');assert.equal(await tools.evaluate(el=>el.open),false);
  await tools.locator('summary').click();assert.equal(await tools.locator('figure:visible').count(),3);
  await root.locator('#next').click();assert(await tools.isHidden());assert(await root.locator('#checks').isHidden());
  await root.locator('#step').selectOption('5');
  const event=standalone.waitForEvent('download');await root.locator('#portable').click();
  const file=path.join(scratch,'guide.html');await (await event).saveAs(file);
  const offline=await context.newPage();
  await offline.route(/^https?:/,route=>route.abort());await offline.goto(pathToFileURL(file).href);
  const saved=offline.locator('#guide');await saved.locator('#side').selectOption('left');await saved.locator('#step').selectOption('6');
  assert(await saved.locator('#tools-list').isHidden());assert(await saved.locator('#checks').isVisible());
  assert.equal(await saved.locator('#part img[src^="data:image/webp"]').count(),4);
  await saved.locator('.fit-viewport img[src^="data:image/webp"]').evaluate(img=>img.decode());
  assert.deepEqual(errors,[]);console.log('PASS: all six steps, four sizes and both halves, named parts and nonempty CAD animation frames, motion controls, configured assembly and offline guide.');
 }finally{await browser.close();server.close();fs.rmSync(scratch,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
