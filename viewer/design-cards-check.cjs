// Live address and illustrated shopping cards, including offline portable output.
// FLAN36_PLAYWRIGHT_MODULE=/path/to/playwright node viewer/design-cards-check.cjs
// SPDX-License-Identifier: GPL-3.0-or-later
const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'build/design-cards');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const {createDesignURL}=await import('./design-url.js');
 let links=[],writes=[],location={href:'https://example.test/explore/?diagnostics&campaign=keep#build',protocol:'https:'};
 const live=createDesignURL({location,history:{state:{preserve:true},replaceState(state,title,url){assert.deepEqual(state,{preserve:true});writes.push(url);location.href=url;}},encode:c=>'https://example.test/explore/?design='+c.id,onLink:link=>links.push(link),onError:error=>{throw error;}});
 for(const id of ['first','second','last']){live.schedule({id});assert.equal(new URL(location.href).searchParams.get('design'),id,'URL updates in the same task');}
 live.schedule({id:'last'});assert.equal(writes.length,3,'UI redraw does not encode or rewrite unchanged designs');assert.equal(new URL(location.href).searchParams.get('campaign'),'keep');assert.equal(new URL(location.href).hash,'#build');
 const server=await require('./serve-docs.cjs')(),browser=await chromium.launch({headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[],cases=[];page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
  const ready=async(p=page)=>{await p.waitForFunction(()=>window.flan36,null,{timeout:150000});await p.evaluate(()=>window.flan36.idle());};
  const config=()=>page.evaluate(()=>window.flan36.snapshot().configuration);
  const importConfig=async(c)=>{await page.locator('#load-config').setInputFiles({name:'test.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(c))});await page.waitForFunction(c=>JSON.stringify(window.flan36.snapshot().configuration)===JSON.stringify(c),c);await ready();};
  await page.goto(server.base+'explore/?diagnostics&campaign=keep#build');await ready();
  assert.equal(await page.evaluate(()=>localStorage.getItem('flan36.configuration.v1')),null,'URL startup does not save a draft');
  const initial=await config(),historyLength=await page.evaluate(()=>history.length),initialURL=page.url();assert.match(initialURL,/size=|design=/);
  const changed=structuredClone(initial);changed.pcb_editions={left:'asanoha',right:'seigaiha'};changed.pcb_masks={left:'white',right:'purple'};changed.batteries.right='301230';
  await importConfig(changed);const address=page.url();assert.notEqual(address,initialURL);assert.equal(new URL(address).searchParams.get('campaign'),'keep');assert.equal(new URL(address).hash,'#build');
  assert.equal(await page.evaluate(()=>history.length),historyLength,'edits do not add browser history');
  await page.click('#undo');await ready();assert.deepEqual(await config(),initial);assert.equal(page.url(),initialURL);
  await page.click('#redo');await ready();assert.deepEqual(await config(),changed);assert.equal(page.url(),address);
  // Fire an edit and reload in one browser task: no idle, timeout or awaited save.
  await page.evaluate(()=>{document.querySelector('#undo').click();location.reload();});await ready();assert.deepEqual(await config(),initial);assert.equal(page.url(),initialURL);
  await page.reload();await ready();assert.deepEqual(await config(),initial);assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('flan36.configuration.v1'))),initial);
  await importConfig(changed);
  await page.evaluate(()=>document.querySelector('#default-config').click());assert.deepEqual(await config(),initial);assert.equal(page.url(),initialURL);
  await page.click('#undo');assert.deepEqual(await config(),changed);assert.equal(page.url(),address);
  const clean=await browser.newContext(),reopened=await clean.newPage();await reopened.goto(address);await ready(reopened);assert.deepEqual(await reopened.evaluate(()=>window.flan36.snapshot().configuration),changed,'current address reopens exact configuration without Share');await clean.close();
  await page.reload();await ready();assert.deepEqual(await config(),changed);
  await page.click('#nav-files');assert.equal(await page.locator('.shopping-row').count(),21);assert.equal(await page.locator('summary[aria-label=\"Details: nice!nano v2 controller\"]').count(),1);
  await page.locator('[data-part=nano] input').check();await page.reload();await ready();await page.click('#nav-files');assert(await page.locator('[data-part=nano] input').isChecked());
  const inspect=async(name)=>{
   await page.locator('#build-buy').evaluate(n=>n.scrollIntoView({block:'start'}));
   await page.waitForFunction(()=>[...document.querySelectorAll('.shopping-art')].every(i=>i.complete&&i.naturalWidth>0));
   const result=await page.locator('#build-shopping').evaluate(root=>{
    const grids=[...root.querySelectorAll('.shopping-grid')];const cards=[...root.querySelectorAll('.shopping-row')];
    return {columns:getComputedStyle(grids[0]).gridTemplateColumns.split(' ').length,images:cards.map(c=>{const i=c.querySelector('img');return {id:c.dataset.part,width:i.naturalWidth,embedded:i.src.startsWith('data:image/png;')};}),clipped:cards.flatMap(c=>[...c.querySelectorAll('strong,.shopping-quantity,.shopping-buy,summary')].filter(n=>n.scrollWidth>n.clientWidth+1||getComputedStyle(n).textOverflow==='ellipsis').map(n=>n.textContent)),outside:cards.some(c=>c.getBoundingClientRect().right>root.getBoundingClientRect().right+1),width:root.clientWidth};
   });
   assert.deepEqual(result.clipped,[],name);assert.equal(result.outside,false,name);assert(result.images.every(i=>i.width===240&&i.embedded),name);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name);
   if(result.width>850)assert.equal(result.columns,3,name);else if(result.width<530)assert.equal(result.columns,1,name);
   await page.screenshot({path:path.join(out,name+'.png')});cases.push({name,columns:result.columns,width:result.width});
  };
  for(const lang of ['en','es']){
   await page.click('[data-lang='+lang+']');for(const width of [1440,1024,768,390,320]){await page.setViewportSize({width,height:1000});await inspect(lang+'-'+width);}
   await page.setViewportSize({width:1440,height:1000});await page.click('#build-focus-toggle');await page.locator('#panel-resize').focus();await page.keyboard.press('Home');await inspect(lang+'-shared-280');await page.locator('#inspector').evaluate(n=>n.scrollTop=0);await page.click('#build-focus-toggle');
  }
  await page.click('[data-lang=en]');await page.setViewportSize({width:1440,height:1000});for(let i=0;i<4;i++){await page.locator('.shopping-group').nth(i).evaluate(n=>n.scrollIntoView({block:'start'}));await page.screenshot({path:path.join(out,'supplier-'+i+'.png')});}await page.locator('#part-jack summary').click();assert(await page.locator('#part-jack').getAttribute('open')!==null);assert.match(await page.locator('#part-jack').textContent(),/S2B-PH-K-S/);
  await page.locator('#build-more').evaluate(n=>n.open=true);const download=page.waitForEvent('download');await page.click('#build-plan');const d=await download,file=path.join(out,d.suggestedFilename());await d.saveAs(file);
  const guide=await context.newPage(),requests=[];guide.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});await guide.goto('file://'+file);assert.equal(await guide.locator('.shopping-art').count(),21);assert.match(await guide.locator('body').textContent(),/keyswitch-kicad-library contributors/);await guide.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));assert.equal(await guide.locator('.shopping-grid').first().evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' ').length),3);assert(await guide.locator('[data-part=nano] input').isChecked());assert.equal(await guide.locator('details:not([open])').count(),0);assert.deepEqual(requests,[]);await guide.screenshot({path:path.join(out,'portable-guide.png'),fullPage:true});await guide.close();
  // A downloaded viewer remains self-contained; its sharing URL still targets the website.
  const offline=await context.newPage(),network=[];offline.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});const fileURL='file://'+path.join(root,'docs/explore/offline.html')+'?diagnostics';await offline.goto(fileURL);await ready(offline);assert.equal(offline.url(),fileURL);assert.match(await offline.locator('#share-link').inputValue(),/^https:\/\/flankbd.com\/explore\/\?/);assert.equal(await offline.locator('.shopping-art').count(),20);assert.deepEqual(network,[]);await offline.close();
  // Storage failure must not prevent the live link from carrying an edit.
  const denied=await browser.newContext();await denied.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('Denied','SecurityError');};});const p=await denied.newPage();await p.goto(server.base+'explore/?diagnostics');await ready(p);await p.locator('#load-config').setInputFiles({name:'denied.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(changed))});await p.waitForFunction(()=>window.flan36.snapshot().configuration.batteries.right==='301230');await ready(p);assert(new URL(p.url()).searchParams.has('design'));assert.deepEqual(await p.evaluate(()=>window.flan36.snapshot().configuration),changed);await denied.close();
  assert.deepEqual(errors,[]);const report={cases,live_url_without_share:true,exact_fresh_context:true,undo_redo_reload:true,unrelated_query_hash_preserved:true,no_browser_history_growth:true,synchronous_address_update:true,immediate_reload_twice:true,checklist_persists:true,all_21_illustrations_embedded:true,portable_illustrated_guide:true,offline_no_network:true,denied_storage_link:true,browser:await browser.version(),errors};fs.writeFileSync(path.join(root,'validation/design-cards.json'),JSON.stringify(report,null,2)+'\n');console.log(report);
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
