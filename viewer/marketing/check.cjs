// SPDX-License-Identifier: GPL-3.0-or-later
// Check the launch workflow, not just the presence of tags or buttons.
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright'),serve=require('../serve-docs.cjs');
const root=path.resolve(__dirname,'../..'),work=path.join(root,'build/marketing');
(async()=>{
 const site=await serve();let browser;const results=[],errors=[];
 try{
  browser=await chromium.launch({headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
  const context=await browser.newContext({permissions:['clipboard-read','clipboard-write']});const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
  for(const width of [1440,390]){
   await p.setViewportSize({width,height:900});await p.goto(site.base+'marketing/');await p.evaluate(()=>document.fonts.ready);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'marketing overflow at '+width);
   for(const lang of ['es','en']){
    await p.click(`[data-lang="${lang}"]`);assert.equal(await p.locator('html').getAttribute('lang'),lang);
    const target=`${lang}-reddit`;await p.locator(`[data-target="${target}"]`).click();
    assert.equal(await p.evaluate(()=>navigator.clipboard.readText()),await p.locator('#'+target).inputValue(),'copy differs from the draft');
    await p.evaluate(()=>scrollTo({top:0,behavior:"instant"}));await p.screenshot({path:path.join(work,`kit-${width}-${lang}.png`)});
   }
   results.push({width,overflow:false,copy:'both languages'});
  }
  // Denied clipboard access retains a usable manual selection.
  await p.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.reject(Error('denied'))},configurable:true}));
  await p.click('[data-target="en-reddit"]');assert.match(await p.locator('#copy-status').textContent(),/selected/);
  assert.equal(await p.locator('#en-reddit').evaluate(e=>e.selectionEnd-e.selectionStart),await p.locator('#en-reddit').evaluate(e=>e.value.length));
  const links=await p.locator('a[download]').evaluateAll(xs=>[...new Set(xs.map(a=>a.href))]);
  for(const url of links){const r=await context.request.get(url);assert(r.ok(),url);assert((await r.body()).length>0,url);}
  for(const lang of ['es','en']){
   await p.click(`[data-lang="${lang}"]`);const video=p.locator(`.language[lang="${lang}"] video`);
   await video.evaluate(v=>{v.preload='auto';v.load();});
   await p.waitForFunction(lang=>{const v=document.querySelector(`.language[lang="${lang}"] video`);return v.readyState>=2;},lang,{timeout:60000});
   const media=await video.evaluate(v=>({width:v.videoWidth,height:v.videoHeight,duration:v.duration}));assert.deepEqual(media,{width:1080,height:1920,duration:30});
  }
  for(const width of [1440,390]){
   await p.setViewportSize({width,height:900});await p.goto(site.base);await p.waitForSelector('#stage.live',{timeout:120000});
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'home overflow at '+width);
   await p.click('[data-lang="en"]');assert.match(await p.locator('.build-status').textContent(),/parts ordered/);assert.equal(await p.locator('a[href="marketing/"]').count(),1);
   await p.click('[data-lang="es"]');assert.match(await p.locator('.build-status').textContent(),/piezas encargadas/);
   await p.screenshot({path:path.join(work,`home-${width}.png`)});
  }
  assert.deepEqual(errors,[],'page errors');
  const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');
  const receipt={schema_version:1,results,clipboard_fallback:'selected full draft',downloads:links.length,videos:'both decode as 1080x1920, 30 s',home:'desktop and phone, no overflow, order status in EN/ES; existing 3D loads',page_errors:errors,files:['docs/index.html','docs/explore/index.html','docs/marketing/index.html','docs/marketing/flan-launch-kit.zip'].map(file=>({file,sha256:hash(file)}))};
  fs.writeFileSync(path.join(root,'validation/marketing-check.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
 }finally{if(browser)await browser.close();site.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
