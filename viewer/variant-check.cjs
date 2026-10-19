// Keyboard size: switch to each built Flan variant and back; added parts, Gerber links, persistence.
// FLAN36_PLAYWRIGHT_MODULE=/path/to/playwright-core FLAN36_BROWSER=/path/to/chromium node viewer/variant-check.cjs
// SPDX-License-Identifier: GPL-3.0-or-later
const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');const fs=require('fs'),path=require('path'),assert=require('assert');
// Open a Design section's Fine-tune so every control in it is reachable.
const tune=async(page,name)=>{const t=page.locator(`#panel-${name} .tune[aria-expanded=false]`);if(await t.count()&&await t.isVisible())await t.click();};
const root=path.resolve(__dirname,'..'),shots=path.join(root,'build/variant-check');fs.mkdirSync(shots,{recursive:true});
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.FLAN36_BROWSER,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const ctx=await browser.newContext({viewport:{width:1400,height:900}});const page=await ctx.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const url='file://'+path.join(root,'docs/explore/offline.html');await page.goto(url);await page.waitForSelector('#loading',{state:'hidden',timeout:400000});
  const state=()=>page.evaluate(()=>({size:document.getElementById('size-current').textContent,status:document.getElementById('status').textContent,
    pressed:[...document.querySelectorAll('#size-grid [aria-pressed=true]')].map(b=>b.dataset.variant),
    links:[...document.querySelectorAll('#pcb-downloads a')].map(a=>a.href.split('/main/')[1]),note:document.getElementById('size-note').textContent}));
  await page.click('.app-nav [data-mode="customize"]');await page.click('[data-panel="cases"]');await tune(page,'cases');
  const s0=await state();const out={s0,variants:{}};
  const built=await page.$$eval('#size-grid button:not([disabled])',b=>b.map(x=>x.dataset.variant));
  for(const id of built.filter(v=>v!=='flan36')){
    await page.click(`#size-grid [data-variant="${id}"]`);
    await page.waitForFunction(id=>document.querySelector(`#size-grid [data-variant="${id}"]`).getAttribute('aria-pressed')==='true',id,{timeout:120000});
    await page.click('[data-panel="pcb"]');await tune(page,'pcb');const s=await state();await page.click('[data-panel="cases"]');await tune(page,'cases');
    await page.screenshot({path:path.join(shots,id+'.png')});
    out.variants[id]=s;
  }
  // persistence: reload keeps the last variant
  await page.reload();await page.waitForSelector('#loading',{state:'hidden',timeout:400000});await page.waitForTimeout(3000);
  out.reloaded=await state();
  await page.click('.app-nav [data-mode="customize"]');await page.click('[data-panel="cases"]');await tune(page,'cases');await page.click('#size-grid [data-variant="flan36"]');await page.waitForTimeout(800);
  out.back=await state();out.errors=errors;
  console.log(JSON.stringify(out,null,1));
  const n=s=>Number(s.status.match(/(\d+) visible/)[1]);
  for(const [id,s] of Object.entries(out.variants)){assert.deepEqual(s.pressed,[id]);assert(n(s)>n(s0),id+' adds parts');assert(s.links.every(l=>l.startsWith(`hardware/${id}/`)),id+' links');}
  assert.equal(n(out.back),n(s0));assert(!errors.length,errors.join('; '));
  await browser.close();console.log('variant ok');
})().catch(e=>{console.error(e);process.exit(1);});
