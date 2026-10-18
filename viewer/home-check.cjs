// Home page: the live model loads, every control changes the look and its previews, the frame browser
// previews without applying, the explorer opens on the same look, and phones get the tabbed rail.
// FLAN36_PLAYWRIGHT_MODULE=/path/to/playwright-core FLAN36_BROWSER=/path/to/chromium node viewer/home-check.cjs
const fs=require('fs'),path=require('path'),assert=require('assert'),serve=require('./serve-docs.cjs');
const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shots=path.join(root,'build/home-check');fs.mkdirSync(shots,{recursive:true});
(async()=>{
  const server=await serve(),base=server.base;
  const browser=await chromium.launch({executablePath:process.env.FLAN36_BROWSER,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const errors=[],out={};
  const watch=(p,name)=>{p.on('pageerror',e=>errors.push(name+': '+e.message));p.on('console',m=>{if(m.type()==='error')errors.push(name+': '+m.text());});p.on('requestfailed',r=>errors.push(name+': failed '+r.url()));};
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});watch(page,'desktop');
  await page.goto(base);await page.waitForSelector('#stage.live',{timeout:120000});
  await page.waitForFunction(()=>[...document.querySelectorAll('.opt img')].every(i=>i.src),null,{timeout:120000});
  await page.waitForTimeout(2200);await page.screenshot({path:path.join(shots,'desktop-snes.png'),fullPage:true});
  const state=()=>page.evaluate(()=>({href:document.getElementById('open').getAttribute('href'),bg:getComputedStyle(document.documentElement).getPropertyValue('--bg1').trim(),
    pressed:[...document.querySelectorAll('#rail [aria-pressed=true]')].map(b=>b.dataset.value),explode:+document.getElementById('explode').getAttribute('aria-valuenow')}));
  out.initial=await state();
  assert.equal(out.initial.href,'explore/?size=flan36&theme=snes&case=rim&keys=original&frame=snes');
  assert(out.initial.explode>=70,'the intro separates the layers');
  // every control
  await page.click('#o-theme [data-value=gameboy]');await page.click('#o-case [data-value=terrace]');await page.click('#o-keys [data-value=saddle]');await page.click('#o-size [data-value=flan54]');
  await page.waitForTimeout(1600);out.changed=await state();
  assert.equal(out.changed.href,'explore/?size=flan54&theme=gameboy&case=terrace&keys=saddle&frame=gameboy');
  assert.notEqual(out.changed.bg,out.initial.bg,'page colours follow the theme');
  await page.screenshot({path:path.join(shots,'desktop-gameboy.png')});
  // layers slider: keyboard and pointer
  await page.focus('#explode');await page.keyboard.press('Home');await page.waitForTimeout(600);
  assert.equal(await page.getAttribute('#explode','aria-valuenow'),'0');
  // the frame browser previews, cancels and applies
  await page.click('#browse');await page.hover('#f-grid [data-value=talavera]');await page.waitForTimeout(500);
  out.previewTag=await page.textContent('.preview-tag');assert(/Talavera/.test(out.previewTag));
  await page.screenshot({path:path.join(shots,'desktop-frames.png')});
  assert.equal((await state()).href.includes('frame=gameboy'),true,'hover does not apply');
  await page.click('#sides [data-side=left]');await page.click('#f-apply');
  out.applied=await state();assert(out.applied.href.endsWith('frame=talavera%2Cgameboy'),out.applied.href);
  // Spanish
  await page.click('[data-lang=es]');out.es=await page.textContent('#open');assert(/Abrir/.test(out.es));await page.click('[data-lang=en]');
  // the explorer opens on this look and keeps a clean address
  const href=await page.getAttribute('#open','href');
  const viewer=await browser.newPage({viewport:{width:1440,height:900}});watch(viewer,'explore');
  await viewer.goto(base+href+'&diagnostics');await viewer.waitForSelector('#loading',{state:'hidden',timeout:400000});
  await viewer.waitForFunction(()=>window.flan36&&document.getElementById('size-current')?.textContent==='Flan54',null,{timeout:300000});
  const c=await viewer.evaluate(()=>window.flan36.snapshot().configuration);
  out.explore={variant:c.variant,cases:[c.cases.left.style,c.cases.right.style],frames:[c.frames.left.style,c.frames.right.style],base:c.cases.left.base_color,url:viewer.url()};
  assert.deepEqual(out.explore.cases,['terrace','terrace']);assert.deepEqual(out.explore.frames,['talavera','gameboy']);assert.equal(c.cases.left.base_color,'#dcd6ba');
  assert(!/theme=/.test(out.explore.url),'the look leaves the address');
  out.homeLink=await viewer.getAttribute('#nav-home','href');assert.equal(out.homeLink,'../');
  await viewer.screenshot({path:path.join(shots,'explore.png')});
  // phone
  const phone=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});watch(phone,'phone');
  await phone.goto(base);await phone.waitForSelector('#stage.live',{timeout:120000});await phone.waitForTimeout(2200);
  out.phone=await phone.evaluate(()=>({tabs:[...document.querySelectorAll('#tabs button')].length,scroll:document.documentElement.scrollWidth,visible:[...document.querySelectorAll('.grp')].filter(g=>getComputedStyle(g).display!=='none').length}));
  assert.equal(out.phone.tabs,5);assert.equal(out.phone.visible,1);assert(out.phone.scroll<=390,'no sideways scroll');
  await phone.screenshot({path:path.join(shots,'phone.png'),fullPage:true});
  // tablet: the rail moves below the model; Spanish; reduced motion skips the intro and the standby
  const tablet=await browser.newPage({viewport:{width:1024,height:900},reducedMotion:'reduce'});watch(tablet,'tablet');
  await tablet.addInitScript(()=>{try{localStorage.setItem('flan.lang','es');}catch{}});
  await tablet.goto(base);await tablet.waitForSelector('#stage.live',{timeout:120000});await tablet.waitForTimeout(1500);
  out.tablet=await tablet.evaluate(()=>({lang:document.documentElement.lang,cta:document.getElementById('open').textContent.trim(),standby:document.getElementById('standby').getAttribute('aria-pressed'),
    explode:+document.getElementById('explode').getAttribute('aria-valuenow'),scroll:document.documentElement.scrollWidth,railBelow:document.getElementById('rail').getBoundingClientRect().top>document.getElementById('stage').getBoundingClientRect().bottom-1}));
  assert.equal(out.tablet.lang,'es');assert(/Abrir/.test(out.tablet.cta));assert.equal(out.tablet.standby,'false');assert.equal(out.tablet.explode,75);
  assert(out.tablet.railBelow,'rail below the model');assert(out.tablet.scroll<=1024,'no sideways scroll');
  await tablet.screenshot({path:path.join(shots,'tablet-es.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  await browser.close();server.close();console.log(JSON.stringify(out,null,1));console.log('home ok');
})().catch(e=>{console.error(e);process.exit(1);});
