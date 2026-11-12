// Print controls must reveal their labels and use the space they actually need.
// FLAN36_PLAYWRIGHT_MODULE=/path/to/playwright node viewer/build-controls-check.cjs
// SPDX-License-Identifier: GPL-3.0-or-later
const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'build/build-controls');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const server=await require('./serve-docs.cjs')(),browser=await chromium.launch({headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[],cases=[];page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(server.base+'explore/?diagnostics');await page.waitForFunction(()=>window.flan36,null,{timeout:120000});await page.click('#nav-files');
  const inspect=async(name)=>{
   await page.locator('#build-print').evaluate(n=>n.scrollIntoView({block:'start'}));
   await page.waitForFunction(()=>document.querySelector('#build-nav [aria-current]')?.dataset.target==='build-print');
   const metrics=await page.locator('#build-print').evaluate(card=>{
    const c=card.getBoundingClientRect(),measure=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {label:e.textContent.trim(),width:r.width,height:r.height,left:r.left,right:r.right,clipped:e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1,ellipsis:s.textOverflow==='ellipsis'};};
    return {width:innerWidth,card:{left:c.left,right:c.right,width:c.width},buttons:[...card.querySelectorAll('.segments button')].map(measure),download:measure(card.querySelector('#print-kit')),fields:[...card.querySelectorAll('.print-choice')].map(measure)};
   });
   for(const b of [...metrics.buttons,metrics.download]){assert(!b.clipped,name+': clipped '+b.label);assert(!b.ellipsis,name+': ellipsis '+b.label);assert(b.height>=43,name+': touch target '+b.label);assert(b.left>=metrics.card.left+8&&b.right<=metrics.card.right-8,name+': outside card '+b.label);}
   assert.equal(metrics.fields.length,2);
   if(metrics.card.width>=600){assert(metrics.download.width<metrics.card.width*.5,name+': stretched download');const tops=await page.locator('.print-choice').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().top));assert(Math.abs(tops[0]-tops[1])<1,name+': groups waste a wide row');}
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.screenshot({path:path.join(out,name+'.png')});if(['en-1440','es-390','es-shared-280'].includes(name))await page.locator('#build-print').screenshot({path:path.join(out,name+'-card.png')});cases.push({name,...metrics});
  };
  for(const lang of ['en','es']){
   await page.click('[data-lang='+lang+']');
   for(const width of [1440,1024,768,390,320]){await page.setViewportSize({width,height:1000});await inspect(lang+'-'+width);}
   await page.setViewportSize({width:1440,height:1000});await page.click('#build-focus-toggle');await page.locator('#panel-resize').focus();await page.keyboard.press('Home');
   assert(Math.abs((await page.locator('#workspace').boundingBox()).width-280)<1);await inspect(lang+'-shared-280');
   await page.locator('#inspector').evaluate(n=>n.scrollTop=0);await page.click('#build-focus-toggle');
  }
  await page.click('[data-lang=en]');await page.setViewportSize({width:1440,height:1000});await page.locator('#build-print').evaluate(n=>n.scrollIntoView({block:'start'}));
  // Native Tab/Space/Enter, not DOM click simulation: traverse choices and activate.
  await page.locator('#print-half [data-value=both]').focus();await page.keyboard.press('Tab');assert.equal(await page.locator('#print-half [data-value=left]').evaluate(n=>n===document.activeElement),true);await page.keyboard.press('Tab');await page.keyboard.press('Space');
  assert.equal(await page.locator('#print-half [data-value=right]').getAttribute('aria-pressed'),'true');await page.keyboard.press('Tab');assert.equal(await page.locator('#print-scope [data-value=complete]').evaluate(n=>n===document.activeElement),true);await page.keyboard.press('Tab');await page.keyboard.press('Enter');
  assert.equal(await page.locator('#print-scope [data-value=shells]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#print-half [aria-pressed=true]').count(),1);assert.equal(await page.locator('#print-scope [aria-pressed=true]').count(),1);
  assert.match(await page.locator('#build-print-contents summary').textContent(),/Right.*Shells/);assert.equal(await page.locator('[data-cap-count]').count(),0);const parts=await page.locator('[data-print-part]').evaluateAll(es=>es.map(e=>e.dataset.printPart).sort());assert(parts.length>0&&parts.every(id=>id.startsWith('right-')));
  await page.keyboard.press('Tab');assert.equal(await page.locator('#build-print-contents summary').evaluate(n=>n===document.activeElement),true);await page.keyboard.press('Tab');assert.equal(await page.locator('#print-kit').evaluate(n=>n===document.activeElement),true);
  assert.equal(await page.locator('#print-kit').evaluate(n=>n.matches(':focus-visible')&&getComputedStyle(n).outlineStyle!=='none'),true);await page.screenshot({path:path.join(out,'keyboard-focus.png')});
  const event=page.waitForEvent('download');await page.keyboard.press('Enter');const d=await event,file=path.join(out,d.suggestedFilename());await d.saveAs(file);const manifest=JSON.parse(cp.execFileSync('unzip',['-p',file,'manifest.json'],{encoding:'utf8',maxBuffer:2e6}));assert.equal(manifest.half,'right');assert.equal(manifest.scope,'shells');assert.deepEqual(manifest.parts.map(p=>p.id).sort(),parts);
  await page.locator('#build-more').evaluate(n=>n.open=true);const guideEvent=page.waitForEvent('download');await page.click('#build-plan');const guide=await guideEvent,guidePath=path.join(out,guide.suggestedFilename());await guide.saveAs(guidePath);const html=fs.readFileSync(guidePath,'utf8');assert.doesNotMatch(html,/class="print-options"/);assert.match(html,/Right.*Shells/);assert.match(html,/HASL/);
  assert.deepEqual(errors,[]);const report={cases:cases.map(c=>({name:c.name,card_width:c.card.width,download_width:c.download.width,labels:c.buttons.map(b=>b.label)})),all_labels_visible:true,content_sized_download:true,wrapped_fields:true,shared_panel_minimum:280,keyboard_selection_and_download:true,individual_zip_matches_selection:true,portable_guide_preserved:true,browser:await browser.version(),errors};
  fs.writeFileSync(path.join(root,'validation/build-controls.json'),JSON.stringify(report,null,2)+'\n');console.log(report);
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
