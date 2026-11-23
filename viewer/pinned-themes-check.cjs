// SPDX-License-Identifier: GPL-3.0-or-later
// Exercise the shared explorer/home pin library against the local site or FLAN36_SITE_URL.
const assert=require('node:assert/strict');
const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
const serve=require('./serve-docs.cjs');
const ids=['Bambu PLA Basic/Jade White','Bambu PLA Matte/Ash Gray','Bambu PLA Basic/Red','Bambu PLA Basic/Cocoa Brown','Bambu PETG HF/Black'];

(async()=>{
 const server=await serve(),base=process.env.FLAN36_SITE_URL||server.base;
 const browser=await chromium.launch({executablePath:process.env.FLAN36_BROWSER,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});
  const home=await context.newPage(),errors=[];
  context.on('weberror',error=>errors.push(error.error().message));
  await home.goto(base);await home.locator('#stage.live').waitFor();
  await home.locator('[data-lang=es]').click();
  const create=home.getByRole('link',{name:/filamentos de impresión 3D/});
  assert(await create.isVisible());assert(await home.locator('#home-pins').isHidden());
  const sample=home.locator('#example-chip button');await sample.click();
  assert.equal(await sample.getAttribute('aria-pressed'),'true');
  await home.locator('[data-tab=size]').click();await home.locator('#o-size [data-value=flan46]').click();
  await home.locator('[data-tab=case]').click();await home.locator('#o-case [data-value=terrace]').click();
  await home.locator('[data-tab=theme]').click();
  const explorer=await context.newPage(),startUrl=new URL(await create.getAttribute('href'),base);
  startUrl.searchParams.set('diagnostics','');await explorer.goto(startUrl.href);
  const library=explorer.locator('dialog.spool-library');
  await library.waitFor();
  const starting=await explorer.evaluate(()=>flan36.snapshot().configuration);
  assert.equal(starting.variant,'flan46');assert.equal(starting.cases.left.style,'terrace');
  assert.equal(starting.filaments.left['#9b9ea0'],'Bambu PLA Matte/Ash Gray');
  for(const id of ids)await library.locator('[data-owned-spool="'+id+'"]').click();
  await library.getByRole('button',{name:'Probar temas'}).click();
  const gallery=explorer.locator('#owned-theme-grid'),pins=explorer.locator('#pinned-theme-grid button');
  const settle=()=>explorer.evaluate(()=>flan36.settled());
  await gallery.locator('img[src^="data:image/png"]').first().waitFor();
  await gallery.locator('[data-recipe=PLA]').first().click();await settle();
  await explorer.locator('#pin-theme').click();await pins.first().waitFor();
  const firstId=await pins.first().getAttribute('data-pinned-theme');
  const source=await explorer.evaluate(()=>flan36.snapshot().configuration);
  await explorer.locator('#owned-next').click();await gallery.locator('[data-recipe=PETG]').click();await settle();
  await explorer.locator('#pin-theme').click();assert.equal(await pins.count(),2);
  const homePins=home.locator('#home-pin-grid button');
  await home.waitForFunction(()=>document.querySelectorAll('#home-pin-grid button').length===2);
  const liveHome=async()=>{
   await home.locator('#canvas').scrollIntoViewIfNeeded();
   // The home model interpolates its materials over 600 ms.
   await home.waitForTimeout(750);
   return home.locator('#canvas').screenshot();
  };
  assert(await home.locator('#home-filament-example').isHidden());
  await homePins.first().click();await home.waitForFunction(()=>document.getElementById('v-theme').textContent.includes('PETG'));
  const dark=await liveHome();
  await homePins.last().click();await home.waitForFunction(()=>document.getElementById('v-theme').textContent.includes('PLA'));
  assert.notDeepEqual(await liveHome(),dark);
  const sameLook=await home.locator('#open').getAttribute('href');
  assert.equal(new URL(sameLook,base).searchParams.get('theme'),firstId);
  const clean=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'}),fromLink=await clean.newPage();
  const url=new URL(sameLook,base);url.searchParams.set('diagnostics','');
  await fromLink.goto(url.href);await fromLink.waitForFunction(()=>window.flan36?.settled);await fromLink.evaluate(()=>flan36.settled());
  const opened=await fromLink.evaluate(()=>flan36.snapshot().configuration);
  for(const half of ['left','right']){
   assert.deepEqual(opened.filaments[half],source.filaments[half]);
   assert.equal(opened.cases[half].base_color,source.cases[half].base_color);
   assert.equal(opened.keycaps[half].K01.color,source.keycaps[half].K01.color);
  }
  assert(await fromLink.locator('#pinned-themes').isHidden());await clean.close();
  await explorer.reload();await pins.first().waitFor();assert.equal(await pins.count(),2);
  await pins.last().click();await settle();assert.deepEqual((await explorer.evaluate(()=>flan36.snapshot().configuration)).filaments,source.filaments);
  await home.reload();await home.locator('#stage.live').waitFor();assert.equal(await homePins.last().getAttribute('aria-pressed'),'true');
  await explorer.locator('#unpin-theme').click();await home.waitForFunction(()=>document.querySelectorAll('#home-pin-grid button').length===1);
  assert.equal(await pins.count(),1);
  assert.deepEqual(errors,[]);await context.close();
  console.log('PASS: first-visit 3D print entry, two pins, live home colors, cross-tab removal, reload, exact filament IDs in fresh explorer.');
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
