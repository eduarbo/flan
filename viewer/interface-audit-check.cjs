// Current UI inventory and regression checks for the home and explorer surfaces.
// SPDX-License-Identifier: GPL-3.0-or-later
const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright'),fs=require('node:fs'),path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'build/interface-audit'),phase=process.argv.includes('--before')?'before':'after';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const server=await require('./serve-docs.cjs')(),browser=await chromium.launch({headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[],cases=[];page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(server.base+'explore/?diagnostics');await page.waitForFunction(()=>window.flan36,null,{timeout:120000});
  for(const lang of ['en','es']){
   await page.click('[data-lang='+lang+']');
   for(const [width,edge] of [[1440,'Home'],[1440,'End'],[768,null],[390,null],[320,null]]){
    await page.setViewportSize({width,height:1000});await page.click('#nav-customize');
    if(width===1440){await page.locator('#panel-resize').focus();await page.keyboard.press(edge);}
    for(const panel of ['size','themes','cases','keycaps','frames','battery','pcb']){
     await page.click('[data-panel='+panel+']');const tune=page.locator('[aria-controls=tune-'+panel+']');if(await tune.count()&&await tune.getAttribute('aria-expanded')==='false')await tune.click();
     await page.locator('#panel-'+panel).evaluate(n=>n.scrollIntoView({block:'start'}));
     const audit=await page.locator('#panel-'+panel).evaluate(section=>({clipped:[...section.querySelectorAll('button,.cur,.preview-card span,strong')].filter(n=>n.getClientRects().length&&n.scrollWidth>n.clientWidth+1).map(n=>({id:n.id,label:n.textContent.trim(),width:n.clientWidth,content:n.scrollWidth})),segments:[...section.querySelectorAll('.segments button')].map(n=>({text:n.textContent,width:n.clientWidth,content:n.scrollWidth})),links:[...section.querySelectorAll('a[href]')].map(a=>({text:a.textContent,url:a.getAttribute('href')}))}));
     if(phase==='after'&&edge==='End'&&panel==='cases'){assert(await page.locator('#case-grid .preview-card').first().evaluate(n=>n.getBoundingClientRect().width<=121));assert.equal(await page.locator('#case-colors').evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' ').length),2);}
     cases.push({lang,width,edge,panel,...audit});if(lang==='es')await page.screenshot({path:path.join(out,phase+'-'+width+(edge==='End'?'-wide':'')+'-'+panel+'.png')});
    }
   }
  }
  await page.setViewportSize({width:1440,height:1000});for(const id of ['nav-inspect','nav-about','nav-files']){await page.click('#'+id);await page.locator('#inspector').evaluate(n=>n.scrollTop=0);await page.screenshot({path:path.join(out,phase+'-'+id+'.png')});}
  if(phase==='after'){
   await page.click('#nav-customize');await page.click('[data-panel=battery]');
   const tune=page.locator('[aria-controls=tune-battery]');if(await tune.getAttribute('aria-expanded')==='false')await tune.click();
   await page.locator('#battery-target [data-side=right]').focus();await page.keyboard.press('Space');
   await page.locator('#battery-options [data-battery="301230"]').focus();await page.keyboard.press('Enter');
   assert.deepEqual(await page.evaluate(()=>window.flan36.snapshot().configuration.batteries),{left:'adafruit-1570',right:'301230'});
   await page.click('#undo');assert.equal(await page.evaluate(()=>window.flan36.snapshot().configuration.batteries.right),'adafruit-1570');
   await page.click('[data-panel=cases]');const c=page.locator('[aria-controls=tune-cases]');if(await c.getAttribute('aria-expanded')==='false')await c.click();
   await page.click('[data-build-step=build-print]');await page.waitForFunction(()=>document.querySelector('#build-nav [aria-current]')?.dataset.target==='build-print');
  }
  const home=await browser.newPage({viewport:{width:1440,height:1000}});await home.goto(server.base);await home.waitForSelector('#stage.live',{timeout:120000});await home.waitForFunction(()=>[...document.querySelectorAll('.opt img')].every(i=>i.complete&&i.naturalWidth>0),null,{timeout:120000});await home.click('[data-lang=es]');await home.screenshot({path:path.join(out,phase+'-home-desktop.png')});await home.setViewportSize({width:390,height:844});await home.screenshot({path:path.join(out,phase+'-home-mobile.png')});
  const homeLinks=await home.locator('header a,footer a').evaluateAll(as=>as.map(a=>({text:a.textContent,url:a.getAttribute('href')})));
  if(phase==='after'){assert.deepEqual(errors,[]);assert.deepEqual(cases.flatMap(c=>c.clipped),[]);assert(homeLinks.filter(a=>/Piezas|Guía|PCB|Firmware/.test(a.text)).every(a=>a.url.includes('explore/?')&&a.url.includes('#build-')));}
  if(phase==='after')fs.writeFileSync(path.join(root,'validation/interface-audit.json'),JSON.stringify({layouts:cases.map(c=>({language:c.lang,viewport:c.width,panelEdge:c.edge,panel:c.panel,clipped:c.clipped.length})),complete_control_labels:true,keyboard_battery_per_half:true,undo_preserved:true,case_print_entry:true,home_workflow_links:true,compact_expanded_previews:true,wide_color_and_key_columns:true,errors},null,2)+'\n');
  fs.writeFileSync(path.join(out,phase+'.json'),JSON.stringify({cases,homeLinks,errors},null,2)+'\n');console.log(JSON.stringify({clipped:cases.filter(c=>c.clipped.length).map(({lang,width,panel,clipped})=>({lang,width,panel,clipped})),homeLinks,errors},null,2));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
