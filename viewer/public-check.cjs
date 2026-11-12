// Current public journey; --local runs the same readback before synchronization.
// SPDX-License-Identifier: GPL-3.0-or-later
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'build/interface-audit'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const commit=process.argv.find(v=>/^[a-f0-9]{40}$/.test(v));assert(commit,'Pass the commit being verified');
 const local=process.argv.includes('--local'),server=local?await require('./serve-docs.cjs')():null,base=server?.base||'https://flankbd.com/';
 const browser=await chromium.launch({headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',acceptDownloads:true}),p=await context.newPage(),errors=[];p.setDefaultTimeout(60000);p.on('pageerror',e=>errors.push(e.message));
  for(const file of ['index.html','explore/index.html','explore/offline.html','offline.html','frame-proposals/index.html','branding.html']){
   const response=await p.request.get(base+file+'?verify='+commit,{timeout:120000});assert.equal(response.status(),200,file);assert.equal(sha(await response.body()),sha(fs.readFileSync(path.join(root,'docs',file))),file+' must be byte-exact');await response.dispose();
  }
  const homeReady=async()=>{await p.waitForSelector('#stage.live',{timeout:120000});await p.waitForFunction(()=>[...document.querySelectorAll('.opt img')].every(i=>i.complete&&i.naturalWidth>0),null,{timeout:120000});};
  const viewerReady=async()=>{await p.waitForSelector('#loading',{state:'hidden',timeout:150000});assert.equal(await p.locator('#error').isVisible(),false);await p.waitForFunction(()=>document.getElementById('variant-status').hidden,null,{timeout:120000});};
  const config=async()=>{await p.click('#nav-files');const event=p.waitForEvent('download');await p.click('#save-config');const d=await event,file=path.join(out,(local?'local':'public')+'-config.json');await d.saveAs(file);return JSON.parse(fs.readFileSync(file));};
  const url=base+'?size=flan42&theme=gameboy&case=terrace&keys=saddle&frame=talavera%2Cgameboy&palette=frame%2Ctheme&campaign=keep';
  await p.goto(url);await homeReady();const historyLength=await p.evaluate(()=>history.length);
  assert.match(await p.locator('#open').getAttribute('href'),/frame=talavera%2Cgameboy/);
  await p.click('#o-theme [data-value=snes]');assert.equal(new URL(p.url()).searchParams.get('theme'),'snes');assert.equal(new URL(p.url()).searchParams.get('campaign'),'keep');assert.equal(await p.evaluate(()=>history.length),historyLength);
  const address=p.url(),fresh=await browser.newContext(),other=await fresh.newPage();await other.goto(address);await other.waitForSelector('#o-theme [aria-pressed=true]');assert.equal(await other.locator('#open').getAttribute('href'),await p.locator('#open').getAttribute('href'));await fresh.close();
  for(const a of await p.locator('header [data-build-step],footer [data-build-step]').all()){const link=new URL(await a.getAttribute('href'),base);assert.equal(link.origin,new URL(base).origin);assert.equal(link.searchParams.get('size'),'flan42');}
  await p.locator('footer [data-build-step=build-boards]').click();await viewerReady();assert.equal(await p.locator('body').getAttribute('data-mode'),'files');assert.equal(await p.locator('body').getAttribute('data-build-focus'),'true');await p.waitForFunction(()=>document.querySelector('#build-nav [aria-current]')?.dataset.target==='build-boards');
  const selected=await config();assert.equal(selected.variant,'flan42');assert.equal(selected.cases.left.style,'terrace');assert.equal(selected.frames.left.style,'talavera');assert.equal(selected.frames.right.style,'snes');
  // All six destinations work in the same document, with the chosen design intact.
  for(const step of ['build-buy','build-print','build-solder','build-program','build-close']){await p.evaluate(step=>location.hash=step,step);await p.waitForFunction(step=>document.querySelector('#build-nav [aria-current]')?.dataset.target===step,step);}
  const advanced=structuredClone(selected);advanced.batteries.right='301230';advanced.pcb_editions={left:'asanoha',right:'seigaiha'};advanced.pcb_masks={left:'white',right:'purple'};
  await p.locator('#load-config').setInputFiles({name:'asymmetric.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(advanced))});await p.waitForFunction(()=>document.querySelector('#save-state').dataset.state==='saved');assert.deepEqual(await config(),advanced);
  await p.click('#nav-home');await homeReady();await p.locator('#resume-design').waitFor();await p.click('#resume-design');await viewerReady();assert.deepEqual(await config(),advanced,'Continue saved design preserves advanced asymmetric choices');
  const event=p.waitForEvent('download');await p.locator('#build-more').evaluate(n=>n.open=true);await p.click('#build-plan');const d=await event,guide=path.join(out,(local?'local':'public')+'-guide.html');await d.saveAs(guide);assert.match(fs.readFileSync(guide,'utf8'),/data:image\/png;base64/);
  // Exercise the hosted lazy print assets and retain the original STL integrity check.
  const kitEvent=p.waitForEvent('download',{timeout:120000});await p.click('#print-kit');const kitDownload=await kitEvent,kitPath=path.join(out,(local?'local':'public')+'-kit.zip');await kitDownload.saveAs(kitPath);
  require('esbuild').buildSync({stdin:{contents:"export {unzipSync} from 'three/addons/libs/fflate.module.js';",resolveDir:__dirname},bundle:true,platform:'node',format:'cjs',outfile:path.join(out,'print-zip.cjs')});
  const kit=require(path.join(out,'print-zip.cjs')).unzipSync(fs.readFileSync(kitPath)),manifest=JSON.parse(Buffer.from(kit['manifest.json']).toString());assert.deepEqual(manifest.configuration,advanced);assert(manifest.parts.length>0);
  for(const part of manifest.parts)assert.equal(sha(kit['STL/'+part.id+'.stl']),sha(fs.readFileSync(path.join(root,part.source))),part.id);
  const gallery=await context.newPage();await gallery.goto(base+'frame-proposals/');const text=await gallery.locator('body').textContent();assert.match(text,/14\.50 mm/);assert.match(text,/earlier 13\.59 mm/);assert.equal(await gallery.locator('[data-state=selected]').count(),6);assert.equal(await gallery.locator('a[href*="#build-print"]').count(),7);await gallery.close();
  await p.goto(base+'explore/?diagnostics');await viewerReady();assert.equal(await p.locator('body').getAttribute('data-panel-open'),'true');await p.click('[data-view=front]');const before=await p.evaluate(()=>window.flan36.snapshot());await p.click('[data-panel=cases]');await p.click('[data-case=rim]');const after=await p.evaluate(()=>window.flan36.snapshot());assert.deepEqual(after.camera,before.camera);await p.click('#undo');assert.deepEqual(await p.evaluate(()=>window.flan36.snapshot().configuration),before.configuration);
  assert.deepEqual(errors,[]);const report={commit,environment:local?'local':'public',six_pages_byte_exact:true,editor_open_on_startup:true,home_live_address:true,home_fresh_context:true,home_build_preserves_selection:true,six_build_destinations:true,saved_design_roundtrip_exact:true,illustrated_guide_download:true,lazy_print_assets_verified:true,exact_stl_hashes:true,current_gallery_with_historic_reference:true,design_change_keeps_camera:true,undo_preserved:true,errors};fs.writeFileSync(path.join(out,local?'local-browser.json':'public-browser.json'),JSON.stringify(report,null,2)+'\n');console.log(report);
 }finally{await browser.close();server?.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
