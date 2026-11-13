// Home page: the live model loads, every control changes the look and its previews, the frame browser
// previews without applying, the explorer opens on the same look, and phones get the tabbed rail. Also how the page
// starts: the poster first, then the 3D engine and each mesh pack once; on a phone its own poster as the largest picture
// and pictures only for the open tab; and what remains when the engine does not arrive.
// FLAN36_PLAYWRIGHT_MODULE=/path/to/playwright-core FLAN36_BROWSER=/path/to/chromium node viewer/home-check.cjs
const fs=require('fs'),path=require('path'),assert=require('assert'),serve=require('./serve-docs.cjs');
const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shots=path.join(root,'build/home-check');fs.mkdirSync(shots,{recursive:true});
(async()=>{
  const server=await serve(),base=server.base;
  const browser=await chromium.launch({executablePath:process.env.FLAN36_BROWSER,args:process.env.FLAN36_BROWSER_ANGLE?['--use-angle='+process.env.FLAN36_BROWSER_ANGLE]:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const errors=[],out={};
  const watch=(p,name)=>{p.on('pageerror',e=>errors.push(name+': '+e.message));p.on('console',m=>{if(m.type()==='error')errors.push(name+': '+m.text());});p.on('requestfailed',r=>errors.push(name+': failed '+r.url()));};
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});watch(page,'desktop');
  await page.goto(base,{timeout:120000});await page.waitForSelector('#stage.live',{timeout:120000});
  await page.waitForFunction(()=>[...document.querySelectorAll('.opt img')].every(i=>i.src),null,{timeout:180000});
  // the spec sheet renders once it nears the viewport
  await page.evaluate(()=>document.querySelector('.specs').scrollIntoView());
  await page.waitForFunction(()=>[...document.querySelectorAll('.art img')].every(i=>i.src),null,{timeout:180000});
  await page.evaluate(()=>scrollTo(0,0));
  await page.waitForTimeout(2200);await page.screenshot({path:path.join(shots,'desktop-snes.png'),fullPage:true});
  // the engine is a file of its own, asked for after the poster has arrived; the meshes the page asked for ahead are the ones the model reads
  out.start=await page.evaluate(()=>{const of=part=>performance.getEntriesByType('resource').filter(r=>r.name.includes('/assets/'+part)),poster=of('home-poster')[0],engine=of('home-engine-')[0];
    return {poster:poster?.name.split('/').pop(),engine:of('home-engine-').length,afterPoster:engine?.startTime>=poster?.responseEnd,common:of('home-common-').length,size:of('home-flan36-').length};});
  assert.deepEqual(out.start,{poster:'home-poster.webp',engine:1,afterPoster:true,common:1,size:1});
  const state=()=>page.evaluate(()=>({href:document.getElementById('open').getAttribute('href'),bg:getComputedStyle(document.documentElement).getPropertyValue('--bg1').trim(),
    pressed:[...document.querySelectorAll('#rail [aria-pressed=true]')].map(b=>b.dataset.value),explode:+document.getElementById('explode').getAttribute('aria-valuenow')}));
  out.initial=await state();
  assert.equal(out.initial.href,'explore/?size=flan36&theme=eva-01&case=rim&keys=original&frame=snes%2Cphone');
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
  await page.click('[data-lang=es]');out.es=await page.textContent('#open');assert(/Personalizar/.test(out.es));await page.click('[data-lang=en]');
  // the explorer opens on this look and retains a copyable address
  const href=await page.getAttribute('#open','href');
  const viewer=await browser.newPage({viewport:{width:1440,height:900}});watch(viewer,'explore');
  await viewer.goto(base+href+'&diagnostics');await viewer.waitForSelector('#loading',{state:'hidden',timeout:400000});
  await viewer.waitForFunction(()=>window.flan36&&document.getElementById('size-current')?.textContent==='Flan54',null,{timeout:300000});
  const c=await viewer.evaluate(()=>window.flan36.snapshot().configuration);
  out.explore={variant:c.variant,cases:[c.cases.left.style,c.cases.right.style],frames:[c.frames.left.style,c.frames.right.style],base:c.cases.left.base_color,url:viewer.url()};
  assert.deepEqual(out.explore.cases,['terrace','terrace']);assert.deepEqual(out.explore.frames,['talavera','gameboy']);assert.equal(c.cases.left.base_color,'#dcd6ba');
  assert(/theme=|design=/.test(out.explore.url),'the design remains in the address');
  out.homeLink=await viewer.getAttribute('#nav-home','href');assert.equal(out.homeLink,'../');
  await viewer.screenshot({path:path.join(shots,'explore.png')});
  // software rendering is slow: free the CPU before the next layouts
  await page.close();await viewer.close();
  // phone
  const phone=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});watch(phone,'phone');
  await phone.addInitScript(()=>{window.__largest=[];new PerformanceObserver(list=>{for(const e of list.getEntries())window.__largest.push(e.element?.id||e.element?.tagName);}).observe({type:'largest-contentful-paint',buffered:true});});
  await phone.goto(base,{timeout:120000});await phone.waitForSelector('#stage.live',{timeout:120000});await phone.waitForTimeout(2200);
  const drawn=()=>phone.evaluate(()=>Object.fromEntries(['case','keys'].map(g=>[g,[...document.querySelectorAll(`#o-${g} img`)].filter(i=>i.src).length])));
  out.phone=await phone.evaluate(()=>({tabs:[...document.querySelectorAll('#tabs button')].length,scroll:document.documentElement.scrollWidth,visible:[...document.querySelectorAll('.grp')].filter(g=>getComputedStyle(g).display!=='none').length,
    poster:document.getElementById('poster').currentSrc.split('/').pop(),largest:window.__largest.at(-1)}));
  assert.equal(out.phone.tabs,5);assert.equal(out.phone.visible,1);assert(out.phone.scroll<=390,'no sideways scroll');
  // the phone's own poster, and the browser times it as the largest picture: nothing scrolls with animation as the page opens
  assert.equal(out.phone.poster,'home-poster-800.webp');assert.equal(out.phone.largest,'poster');
  await phone.screenshot({path:path.join(shots,'phone.png'),fullPage:true});
  // pictures are drawn for the strip that shows: none for Case or Keycaps until its tab opens
  out.phone.drawn=await drawn();assert.deepEqual(out.phone.drawn,{case:0,keys:0});
  await phone.click('#tabs [data-tab=case]');await phone.waitForFunction(()=>[...document.querySelectorAll('#o-case img')].every(i=>i.src),null,{timeout:180000});
  out.phone.opened=await drawn();assert.deepEqual(out.phone.opened,{case:4,keys:0});
  // a look chosen there redraws them in its colours
  const before=await phone.getAttribute('#o-case [data-value=terrace] img','src');await phone.click('#o-case [data-value=terrace]');
  await phone.waitForFunction(old=>{const i=document.querySelector('#o-case [data-value=rim] img');return i.src&&document.querySelector('#o-case [data-value=terrace] img').src!==old;},before,{timeout:180000});
  // a look chosen while the meshes are still on their way is the one the model opens on
  const early=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});watch(early,'early');
  await early.route('**/home-common-*.bin',r=>setTimeout(()=>r.continue(),2500));
  await early.goto(base+'?diagnostics',{timeout:120000});await early.waitForFunction(()=>window.flanHome,null,{timeout:120000});
  await early.click('#o-theme [data-value=gameboy]');await early.click('#o-case [data-value=terrace]');
  out.early={waiting:await early.evaluate(()=>!document.getElementById('stage').classList.contains('live'))};assert(out.early.waiting,'chosen before the model was live');
  await early.waitForSelector('#stage.live',{timeout:120000});
  out.early.look=await early.evaluate(()=>{const l=window.flanHome.info().look;return [l.theme,l.case];});assert.deepEqual(out.early.look,['gameboy','terrace']);await early.close();
  // without the engine: the poster, the note and a rail that still changes the page
  const bare=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});await bare.route('**/home-engine-*.js',r=>r.abort());
  await bare.goto(base,{timeout:120000});await bare.waitForSelector('#note:not([hidden])',{timeout:60000});
  const page0=()=>bare.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--bg1').trim());const bg=await page0();await bare.click('#o-theme [data-value=gameboy]');
  // the page eases to the theme's colours: wait for them to move rather than read the same instant
  const recoloured=await bare.waitForFunction(old=>getComputedStyle(document.documentElement).getPropertyValue('--bg1').trim()!==old,bg,{timeout:10000}).then(()=>true,()=>false);
  out.bare={note:await bare.textContent('#note'),live:await bare.evaluate(()=>document.getElementById('stage').classList.contains('live')),poster:await bare.evaluate(()=>getComputedStyle(document.getElementById('poster')).opacity),recoloured};
  assert.deepEqual(out.bare,{note:'The 3D model could not load. Check the connection and reload.',live:false,poster:'1',recoloured:true});await bare.close();
  // tablet: the rail moves below the model; Spanish; reduced motion skips the intro and the standby
  const tablet=await browser.newPage({viewport:{width:1024,height:900},reducedMotion:'reduce'});watch(tablet,'tablet');
  await tablet.addInitScript(()=>{try{localStorage.setItem('flan.lang','es');}catch{}});
  await phone.close();await tablet.goto(base,{timeout:120000});await tablet.waitForSelector('#stage.live',{timeout:120000});await tablet.waitForTimeout(1500);
  out.tablet=await tablet.evaluate(()=>({lang:document.documentElement.lang,cta:document.getElementById('open').textContent.trim(),standby:document.getElementById('standby').getAttribute('aria-pressed'),
    explode:+document.getElementById('explode').getAttribute('aria-valuenow'),scroll:document.documentElement.scrollWidth,railBelow:document.getElementById('rail').getBoundingClientRect().top>document.getElementById('stage').getBoundingClientRect().bottom-1}));
  assert.equal(out.tablet.lang,'es');assert(/Personalizar/.test(out.tablet.cta));assert.equal(out.tablet.standby,'false');assert.equal(out.tablet.explode,75);
  assert(out.tablet.railBelow,'rail below the model');assert(out.tablet.scroll<=1024,'no sideways scroll');
  await tablet.screenshot({path:path.join(shots,'tablet-es.png'),fullPage:true,timeout:180000});
  assert.deepEqual(errors,[]);
  await browser.close();server.close();console.log(JSON.stringify(out,null,1));console.log('home ok');
})().catch(e=>{console.error(e);process.exit(1);});
