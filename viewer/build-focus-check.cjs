// Focused Build, scroll navigation, and a real complete ZIP, including failure/retry.
// FLAN36_PLAYWRIGHT_MODULE=/path/to/playwright node viewer/build-focus-check.cjs
// SPDX-License-Identifier: GPL-3.0-or-later
const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'build/build-focus');fs.mkdirSync(out,{recursive:true});
const unzip=(zip,file)=>cp.execFileSync('unzip',['-p',zip,file],{maxBuffer:150e6});
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
(async()=>{
 const server=await require('./serve-docs.cjs')(),browser=await chromium.launch({headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(90000);
  const ready=async()=>{await page.waitForFunction(()=>window.flan36,null,{timeout:120000});await page.evaluate(()=>window.flan36.idle());};
  const importConfig=async c=>{await page.locator('#load-config').setInputFiles({name:'build.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(c))});await ready();};
  const top=()=>page.locator('#inspector').evaluate(n=>n.scrollTop=0);
  const focus=async()=>{assert.equal(await page.locator('.stage').isVisible(),false);assert.equal(await page.locator('#build-toolbar').isVisible(),true);};
  console.log('Focus, responsive layout and scrollspy');await page.goto(server.base+'explore/?diagnostics');await ready();await page.click('#nav-files');await focus();
  const original=await page.evaluate(()=>window.flan36.snapshot().configuration);
  await page.screenshot({path:path.join(out,'desktop-overview.png')});
  for(const width of [1440,768,390,320]){
   await page.setViewportSize({width,height:width<500?844:1000});await top();await page.screenshot({path:path.join(out,'overview-'+width+'.png')});
   for(const id of ['build-buy','build-boards','build-print','build-solder','build-program','build-close']){
    await page.locator('#'+id).evaluate(n=>n.scrollIntoView({block:'start'}));
    await page.waitForFunction(id=>document.querySelector('#build-nav [aria-current]')?.dataset.target===id,id);
    const active=await page.locator('#build-nav [aria-current]').boundingBox(),nav=await page.locator('#build-nav').boundingBox();assert(active.x>=nav.x-1&&active.x+active.width<=nav.x+nav.width+1,'active item stays visible');
   }
   await page.locator('#build-nav button[data-target=build-boards]').evaluate(n=>n.click());
   await page.waitForFunction(()=>document.querySelector('#build-nav [aria-current]')?.dataset.target==='build-boards');
   const nav=await page.locator('#build-nav').boundingBox(),card=await page.locator('#build-boards').boundingBox();assert(card.y>=nav.y+nav.height+10,'sticky nav has a gap before the card');
   const overflow=await page.locator('#panel-files').evaluate(r=>[...r.querySelectorAll('*')].filter(e=>e.getClientRects().length&&!e.closest('.build-jumps')&&e.getBoundingClientRect().right>innerWidth+1).map(e=>e.id||e.className));assert.deepEqual(overflow,[]);
   await page.screenshot({path:path.join(out,'ordering-'+width+'.png')});
  }
  await page.setViewportSize({width:1440,height:1000});await top();await page.click('#build-focus-toggle');assert(await page.locator('.stage').isVisible());await page.screenshot({path:path.join(out,'shared-3d.png')});await page.click('#build-focus-toggle');await focus();
  await page.click('#build-edit');assert(await page.locator('.stage').isVisible());assert.deepEqual(await page.evaluate(()=>window.flan36.snapshot().configuration),original);
  await page.click('#nav-files');await focus();await page.click('[data-lang=es]');await top();assert.match(await page.locator('#build-focus-toggle').textContent(),/Mostrar/);await page.screenshot({path:path.join(out,'desktop-es.png')});await page.click('[data-lang=en]');
  // Published assets for every size/edition have exact source bytes.
  const receipt=JSON.parse(fs.readFileSync(path.join(root,'validation/revI-viewer.json'))),assets=receipt.build_assets;
  for(const [source,asset] of Object.entries(assets)){const bytes=fs.readFileSync(path.join(root,'docs/explore',asset.url));assert.equal(bytes.length,asset.bytes);assert.equal(sha(bytes),asset.sha256);assert.equal(sha(fs.readFileSync(path.join(root,source))),asset.sha256);}
  // A corrupt required asset must fail with no download, then allow retry.
  let downloads=0;page.on('download',()=>downloads++);await page.route('**/assets/build/*',r=>r.fulfill({body:'corrupt',contentType:'application/octet-stream'}));await page.click('#download-build');await page.waitForFunction(()=>document.querySelector('#build-export-status').textContent.includes('File mismatch'));assert.equal(downloads,0);assert.equal(await page.locator('#download-build').isDisabled(),false);await page.unroute('**/assets/build/*');
  // Cancel a pending fetch without leaving the exporter locked.
  let release;const gate=new Promise(r=>release=r),routes=[];await page.route('**/assets/build/*',async r=>{routes.push(r);await gate;await r.abort().catch(()=>{});});await Promise.all([page.waitForRequest(r=>r.url().includes('/assets/build/')),page.click('#download-build')]);await page.click('#build-cancel');await page.waitForFunction(()=>document.querySelector('#build-export-status').textContent.includes('cancelled'));release();await page.unroute('**/assets/build/*');assert.equal(downloads,0);
  // Cancelling while shared geometry loads also unlocks the export immediately.
  let releasePrint;const printGate=new Promise(r=>releasePrint=r);await page.route('**/printing-*.bin',async r=>{await printGate;await r.abort().catch(()=>{});});
  await Promise.all([page.waitForRequest(r=>/printing-.*\.bin/.test(r.url())),page.click('#download-build')]);await page.click('#build-cancel');
  await page.waitForFunction(()=>!document.querySelector('#download-build').disabled,null,{timeout:3000});assert.match(await page.locator('#build-export-status').textContent(),/cancelled/);releasePrint();await page.unroute('**/printing-*.bin');assert.equal(downloads,0);
  console.log('Complete Flan54 ZIP, with different PCBs/colors and a smaller individual print selection');
  await page.click('#nav-customize');await page.click('[data-panel=size]');await page.click('#size-grid [data-variant=flan54]');await ready();await page.click('#nav-files');
  const config=await page.evaluate(()=>window.flan36.snapshot().configuration);config.batteries.right='301230';config.cases.right.cover=false;config.cases.right.style='solid';config.pcb_editions={left:'asanoha',right:'seigaiha'};config.pcb_masks={left:'white',right:'purple'};await importConfig(config);
  const selected=await page.evaluate(()=>window.flan36.snapshot().configuration);await page.click('#print-half [data-value=right]');await page.click('#print-scope [data-value=shells]');
  let allow;const hold=new Promise(r=>allow=r);await page.route('**/assets/build/*',async r=>{await hold;await r.continue().catch(()=>{});});
  const pending=page.waitForEvent('download',{timeout:180000});await Promise.all([page.waitForRequest(r=>r.url().includes('/assets/build/')),page.click('#download-build')]);
  const changed=structuredClone(selected);changed.pcb_masks.right='red';await importConfig(changed);allow();
  const d=await pending,zip=path.join(out,d.suggestedFilename());await d.saveAs(zip);await page.unroute('**/assets/build/*');assert.equal(d.suggestedFilename(),'Flan54-complete-build.zip');
  const manifest=JSON.parse(unzip(zip,'manifest.json'));assert.deepEqual(manifest.configuration,selected);assert.deepEqual(JSON.parse(unzip(zip,'Configuration.json')),selected);
  for(const entry of manifest.files){const bytes=unzip(zip,entry.path);assert.equal(bytes.length,entry.bytes,entry.path);assert.equal(sha(bytes),entry.sha256,entry.path);if(entry.source)assert.equal(sha(fs.readFileSync(path.join(root,entry.source))),entry.sha256,entry.source);}
  assert.deepEqual(manifest.pcbs.map(p=>[p.side,p.edition,p.mask]),[['left','asanoha','white'],['right','seigaiha','purple']]);assert.match(unzip(zip,'Shopping.csv').toString(),/"54","60","6"/);
  fs.writeFileSync(path.join(out,'Print-kit.zip'),unzip(zip,'Print-kit.zip'));const kit=JSON.parse(unzip(path.join(out,'Print-kit.zip'),'manifest.json'));
  assert.equal(kit.half,'both');assert.equal(kit.scope,'complete');assert.deepEqual(kit.configuration,selected);assert.deepEqual(kit.keycaps.missing,[]);assert.equal(kit.keycaps.groups.reduce((n,g)=>n+g.count,0),54);assert(kit.parts.some(p=>p.side==='left')&&kit.parts.some(p=>p.side==='right'));assert(!kit.parts.some(p=>p.id.startsWith('right-frame-')));
  for(const file of kit.keycaps.bundled)assert(unzip(path.join(out,'Print-kit.zip'),'Keycaps/'+file).length>84);
  const guide=unzip(zip,'Guide.html').toString();assert.match(guide,/Both halves.*Complete kit/);assert.match(guide,/54 keycaps/);assert.match(guide,/purple mask/);assert.doesNotMatch(guide,/red mask/);assert.match(guide,/href="Print-kit.zip"/);assert.match(guide,/href="PCB\/flan54-left-asanoha.zip"/);assert.match(guide,/href="Firmware\/flan54-right.uf2"/);
  const entries=new Set(manifest.files.map(e=>e.path));for(const [,href] of guide.matchAll(/href="([^"#]+)"/g))if(!/^(https?:|mailto:)/.test(href))assert(entries.has(href),'Guide local link exists: '+href);
  assert.equal(await page.locator('#print-half [aria-pressed=true]').getAttribute('data-value'),'right');assert.equal(await page.locator('#print-scope [aria-pressed=true]').getAttribute('data-value'),'shells');assert.equal(await page.evaluate(()=>window.flan36.snapshot().configuration.pcb_masks.right),'red');
  await page.waitForFunction(()=>!document.querySelector('#download-build').disabled);assert.match(await page.locator('#build-export-status').textContent(),/downloaded/);
  // The file copy offers an actionable link to this exact design online.
  const offline=await context.newPage();await offline.goto('file://'+path.join(root,'docs/explore/offline.html')+'?diagnostics');await offline.waitForFunction(()=>window.flan36,null,{timeout:120000});await offline.click('#nav-files');await offline.click('#download-build');
  const online=offline.locator('#build-export-status a');await online.waitFor();const onlineURL=new URL(await online.getAttribute('href'));assert.equal(onlineURL.origin,'https://flankbd.com');assert.equal(onlineURL.pathname,'/explore/');assert(onlineURL.searchParams.has('design')||onlineURL.searchParams.has('size'));assert.equal(await offline.locator('#download-build').isDisabled(),false);await offline.close();
  assert.deepEqual(errors,[]);
  const report={focus_default:true,optional_3d:true,edit_preserves_configuration:true,responsive_widths:[320,390,768,1440],scrollspy_all_sections:true,active_nav_visible:true,sticky_spacing:true,languages:['en','es'],pinned_assets:Object.keys(assets).length,real_complete_zip:true,per_half_pcbs:true,complete_despite_subset:true,configuration_snapshot:true,guide_local_links:true,hashes_verified:true,corruption_rejected:true,cancellation_and_retry:true,cancellation_during_geometry_load:true,offline_exact_design_link:true,browser:await browser.version(),errors};
  fs.writeFileSync(path.join(root,'validation/build-focus.json'),JSON.stringify(report,null,2)+'\n');console.log(report);
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
