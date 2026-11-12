// The visitor can buy and build from the selected design without opening Markdown.
// FLAN36_PLAYWRIGHT_MODULE=/path/to/playwright node viewer/build-check.cjs
// SPDX-License-Identifier: GPL-3.0-or-later
const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'build/build-workflow');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const server=await require('./serve-docs.cjs')(),browser=await chromium.launch({headless:true,executablePath:process.env.FLAN36_BROWSER,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(60000);
  const ready=async()=>{await page.waitForFunction(()=>window.flan36,null,{timeout:120000});await page.evaluate(()=>window.flan36.idle());};
  const open=async()=>{await page.click('#nav-files');};
  const count=async(id)=>Number(await page.locator('[data-part="'+id+'"]').getAttribute('data-required'));
  const download=async(id)=>{if(['#build-csv','#build-plan'].includes(id))await page.locator('#build-more').evaluate(n=>n.open=true);const event=page.waitForEvent('download');await page.click(id);const d=await event;const file=path.join(out,d.suggestedFilename());await d.saveAs(file);return file;};
  const jump=async(id)=>page.locator(id).evaluate(n=>n.scrollIntoView({block:'start'}));
  console.log('Loading build workflow');await page.goto(server.base+'explore/?diagnostics');await ready();await open();
  assert.equal(await count('switch'),36);assert.equal(await count('m6'),6);assert.equal(await count('adafruit-1570'),2);
  assert.equal(await page.locator('[data-part="switch"]').getAttribute('data-buy'),'40');
  await page.locator('[data-part="switch"] input').check();
  await page.locator('[data-part="nano"] input').check();
  await page.reload();await ready();await open();
  assert(await page.locator('[data-part="switch"] input').isChecked());
  assert.match(await page.locator('#build-shopping-progress').textContent(),/^2 of/);
  const config=await page.evaluate(()=>window.flan36.snapshot().configuration);
  config.batteries.right='301230';config.cases.right.cover=false;config.cases.right.style='solid';
  config.pcb_editions={left:'asanoha',right:'seigaiha'};config.pcb_masks={left:'white',right:'purple'};
  await page.locator('#load-config').setInputFiles({name:'mixed-build.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(config))});
  await page.waitForFunction(()=>window.flan36.snapshot().configuration.batteries.right==='301230');
  assert.equal(await count('adafruit-1570'),1);assert.equal(await count('301230'),1);assert.equal(await count('frame-magnets'),3);
  assert.equal(await count('view'),2,'frame removal does not remove the display');
  assert.match(await page.locator('[data-part="socket"] a').getAttribute('href'),/variant=45742200324327/);
  assert.match(await page.locator('[data-part="301230"] a').getAttribute('href'),/variant=43294731665639/);
  assert.equal(await page.locator('[data-print-part="right-frame-talavera"]').count(),0);
  assert.match(await page.locator('[data-part="301230"]').textContent(),/Right/);
  const amounts={flan36:[36,6,40],flan42:[42,8,50],flan46:[46,8,50],flan54:[54,12,60]};
  for(const [variant,[keys,screws,buy]] of Object.entries(amounts)){
   console.log('Checking list and files',variant);await page.click('#nav-customize');await page.click('[data-panel="size"]');await page.click('#size-grid [data-variant="'+variant+'"]');
   await page.waitForFunction(id=>window.flan36.snapshot().configuration.variant===id,variant);await ready();await open();
   assert.equal(await count('switch'),keys);assert.equal(await count('m6'),screws);
   assert.equal(Number(await page.locator('[data-part="diode"]').getAttribute('data-buy')),buy);
   if(variant!=='flan36')assert.equal(await page.locator('[data-part="switch"] input').isChecked(),false,'changed quantities need checking again');
   assert(await page.locator('[data-part="nano"] input').isChecked(),'unchanged lines retain progress');
   const pcb=await page.locator('#build-pcb-downloads a').evaluateAll(es=>es.map(e=>({url:e.href,text:e.textContent})));
   assert(pcb[0].url.includes(variant+'-left-'));assert.match(pcb[0].text,/Asanoha.*white mask/);assert.match(pcb[1].text,/Seigaiha.*purple mask/);
   assert.deepEqual(await page.locator('#build-firmware a').evaluateAll(es=>es.map(e=>e.href.split('/').pop())),[variant+'-left.uf2',variant+'-right.uf2']);
   assert.match(await page.locator('#build-final').textContent(),new RegExp('all '+keys+' keys'));
   assert.equal(await page.locator('[data-cap-count]').evaluateAll(es=>es.reduce((n,e)=>n+Number(e.dataset.capCount),0)),keys);
  }
  await page.click('#print-half [data-value=right]');await page.click('#print-scope [data-value=shells]');
  assert.equal(await page.locator('[data-print-part]').count(),2);assert.equal(await page.locator('[data-cap-count]').count(),0);
  assert.equal(await count('switch'),54,'printing one half does not shrink whole-build shopping');
  await page.click('#print-half [data-value=both]');await page.click('#print-scope [data-value=complete]');
  const csv=fs.readFileSync(await download('#build-csv'),'utf8');assert.match(csv,/"54","60","6"/);assert.match(csv,/301230/);assert.match(csv,/https:\/\/typeractive.xyz/);
  const plan=fs.readFileSync(await download('#build-plan'),'utf8');assert.match(plan,/Flan54/);assert.match(plan,/HASL/);assert.match(plan,/2.80 mm/);assert.match(plan,/54 keys/);assert.match(plan,/one data cable in turn/);assert.match(plan,/Q–P positions in the alphabetic block/);assert.match(plan,/left-flan|flan54-left/);
  const planPage=await context.newPage();await planPage.goto('file://'+path.join(out,'Flan54-build-plan.html'));
  assert.equal(await planPage.locator('[data-part="switch"]').getAttribute('data-required'),'54');assert.equal(await planPage.locator('details:not([open])').count(),0);
  const designLink=await planPage.locator('#build-design-link').getAttribute('href');assert.match(designLink,/design=/);const reopened=await browser.newContext(),reopenedPage=await reopened.newPage();await reopenedPage.goto(designLink+'&diagnostics');await reopenedPage.waitForFunction(()=>window.flan36,null,{timeout:120000});assert.deepEqual(await reopenedPage.evaluate(()=>window.flan36.snapshot().configuration.pcb_masks),{left:'white',right:'purple'});assert.equal(await reopenedPage.evaluate(()=>window.flan36.snapshot().configuration.variant),'flan54');await reopened.close();await planPage.close();
  await jump('#build-buy');await page.screenshot({path:path.join(out,'shopping-desktop.png')});
  await jump('#build-boards');await page.screenshot({path:path.join(out,'ordering-desktop.png')});
  await page.click('#recovery > summary');await jump('#recovery');
  const alignment=await page.locator('#recovery .config-actions button').evaluateAll(es=>es.map(e=>({align:getComputedStyle(e).textAlign,left:e.getBoundingClientRect().left,width:e.getBoundingClientRect().width,padding:getComputedStyle(e).paddingLeft})));
  assert(alignment.length>=4);assert(alignment.every(a=>a.align==='left'&&Math.abs(a.left-alignment[0].left)<1&&Math.abs(a.width-alignment[0].width)<1&&a.padding===alignment[0].padding));
  await page.screenshot({path:path.join(out,'recovery-desktop.png')});
  const recovered=JSON.parse(fs.readFileSync(await download('#recovery-list button:first-child'),'utf8'));assert.deepEqual(recovered.pcb_masks,{left:'white',right:'purple'});
  await page.click('[data-lang="es"]');await page.setViewportSize({width:390,height:844});await open();
  await jump('#build-buy');await page.screenshot({path:path.join(out,'shopping-mobile.png')});
  await jump('#build-boards');await page.screenshot({path:path.join(out,'ordering-mobile.png')});
  await page.locator('#build-print-contents > summary').click();await jump('#build-print');await page.screenshot({path:path.join(out,'printing-mobile.png')});
  await jump('#recovery');await page.screenshot({path:path.join(out,'recovery-mobile.png')});
  assert.match(await page.locator('#build-shopping-note').textContent(),/teclado completo/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const overflowing=await page.locator('#panel-files').evaluate(root=>[...root.querySelectorAll('*')].filter(e=>e.getClientRects().length&&!e.closest('.build-jumps')&&e.getBoundingClientRect().right>innerWidth+1).map(e=>e.id||e.className));
  assert.deepEqual(overflowing,[]);
  await page.setViewportSize({width:320,height:740});await jump('#build-buy');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,'shopping-small-phone.png')});await page.setViewportSize({width:390,height:844});
  const esGuide=fs.readFileSync(await download('#build-plan'),'utf8');assert.match(esGuide,/Plan de construcción/);assert.match(esGuide,/Necesitas/);
  const esCsv=fs.readFileSync(await download('#build-csv'),'utf8');assert.match(esCsv,/Necesarias/);assert.match(esCsv,/Derecha/);
  // A real generated print kit still matches the inventory shown before download.
  console.log('Generating selected print kit');const kit=await download('#print-kit');
  const manifest=JSON.parse(require('node:child_process').execFileSync('unzip',['-p',kit,'manifest.json'],{encoding:'utf8',maxBuffer:2e6}));
  assert.equal(manifest.keycaps.groups.reduce((n,g)=>n+g.count,0),54);
  assert.deepEqual(manifest.parts.map(p=>p.id).sort(),await page.locator('[data-print-part]').evaluateAll(es=>es.map(e=>e.dataset.printPart).sort()));
  assert.equal(manifest.configuration.batteries.right,'301230');assert.deepEqual(manifest.configuration.pcb_masks,{left:'white',right:'purple'});
  assert.deepEqual(errors,[]);
  const report={all_four_sizes:true,per_half_batteries:true,supplier_variants_preselected:true,installed_frame_quantities:true,shopping_progress_reload:true,quantity_changes_invalidate_progress:true,csv:true,portable_guide:true,guide_reopens_exact_design:true,per_half_pcb_and_firmware:true,print_subset_and_actual_kit_match:true,recovery_download:true,recovery_alignment:true,desktop_and_mobile:true,languages:['en','es'],browser:await browser.version(),errors};
  fs.writeFileSync(path.join(root,'validation/build-workflow.json'),JSON.stringify(report,null,2)+'\n');console.log(report);
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
