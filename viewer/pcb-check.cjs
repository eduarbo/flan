// Independent PCB editions: rendered choices, downloads, persistence, sharing and history.
// FLAN36_PLAYWRIGHT_MODULE=/path/to/playwright node viewer/pcb-check.cjs
// SPDX-License-Identifier: GPL-3.0-or-later
const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'build/pcb-identity');fs.mkdirSync(out,{recursive:true});
const gl=process.env.FLAN_GL==='software'?['--use-angle=swiftshader','--enable-unsafe-swiftshader']:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'];
(async()=>{
 const server=await require('./serve-docs.cjs')(),browser=await chromium.launch({headless:true,executablePath:process.env.FLAN36_BROWSER,args:gl});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error('Page:',e.message);});
  const ready=async p=>{await p.waitForFunction(()=>window.flan36,null,{timeout:120000});await p.evaluate(()=>window.flan36.idle());};
  const open=async()=>{if(await page.locator('body').getAttribute('data-mode')!=='customize'||await page.locator('body').getAttribute('data-panel-open')!=='true')await page.click('#nav-customize');await page.click('[data-panel="pcb"]');const tune=page.locator('#panel-pcb .tune[aria-expanded=false]');if(await tune.count())await tune.click();};
  const configuration=()=>page.evaluate(()=>window.flan36.snapshot().configuration);
  const select=async(side,edition)=>{await page.click(`#pcb-target [data-side="${side}"]`);await page.click(`#pcb-grid [data-edition="${edition}"]`);await page.evaluate(()=>window.flan36.idle());await page.waitForFunction(({side,edition})=>{const s=window.flan36.snapshot();return (side==='both'?['left','right']:[side]).every(h=>s.silkscreen[h].visible&&s.silkscreen[h].texture===s.configuration.variant+'/'+edition+'/'+h);},{side,edition},{timeout:120000});};
  console.log('Loading viewer');await page.goto(server.base+'explore/?diagnostics');await ready(page);await open();console.log('Selecting mixed editions');
  await select('left','asanoha');await select('right','seigaiha');
  assert.deepEqual((await configuration()).pcb_editions,{left:'asanoha',right:'seigaiha'});
  await page.click('#undo');assert.equal((await configuration()).pcb_editions.right,'base');
  await page.click('#redo');assert.equal((await configuration()).pcb_editions.right,'seigaiha');
  await page.click('#pcb-target [data-side="both"]');assert.equal(await page.locator('#pcb-grid [aria-pressed=true]').count(),0);
  const links=()=>page.locator('#pcb-downloads a').evaluateAll(es=>es.map(e=>({url:e.href,text:e.textContent})));
  let downloads=await links();assert.match(downloads[0].url,/flan36-left-revI-asanoha.zip$/);assert.match(downloads[1].url,/flan36-right-revI-seigaiha.zip$/);
  await page.click('#nav-files');
  assert.deepEqual(await page.locator('#build-pcb-downloads a').evaluateAll(es=>es.map(e=>e.href)),downloads.map(d=>d.url));
  await page.waitForFunction(()=>document.querySelector('#share-link').value.includes('?design='));
  const shared=await page.locator('#share-link').inputValue(),sharedContext=await browser.newContext(),sharedPage=await sharedContext.newPage();
  await sharedPage.goto(shared+'&diagnostics');await ready(sharedPage);
  assert.deepEqual(await sharedPage.evaluate(()=>window.flan36.snapshot().configuration.pcb_editions),{left:'asanoha',right:'seigaiha'});await sharedContext.close();
  console.log('Sharing and history passed');
  await page.reload();await ready(page);await open();assert.deepEqual((await configuration()).pcb_editions,{left:'asanoha',right:'seigaiha'});
  await page.click('#pcb-underside');await page.waitForTimeout(1500);await page.screenshot({path:path.join(out,'desktop.png')});
  // Every size keeps the choice and points to each half's selected package.
  for(const variant of ['flan42','flan46','flan54','flan36']){
   console.log('Checking',variant);
   await page.click('[data-panel="size"]');await page.click(`#size-grid [data-variant="${variant}"]`);
   await page.waitForFunction(id=>window.flan36.snapshot().configuration.variant===id,variant,{timeout:120000});await open();
   await page.waitForFunction(id=>{const s=window.flan36.snapshot();return s.silkscreen.left.visible&&s.silkscreen.right.visible&&s.silkscreen.left.texture===id+'/asanoha/left'&&s.silkscreen.right.texture===id+'/seigaiha/right';},variant,{timeout:120000});
   downloads=await links();assert.match(downloads[0].url,new RegExp(`${variant}-left-${variant==='flan36'?'revI-':''}asanoha.zip$`));assert.match(downloads[1].url,new RegExp(`${variant}-right-${variant==='flan36'?'revI-':''}seigaiha.zip$`));
  }
  console.log('Checking mobile');await page.setViewportSize({width:390,height:844});await page.click('[data-lang="es"]');await open();
  await page.locator('#pcb-target').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'mobile.png')});
  const bounds=await page.locator('#pcb-target').boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=391,'half selector fits the phone');
  await select('both','kikko');assert.equal((await configuration()).pcb_edition,'kikko');assert.equal((await configuration()).pcb_editions,undefined);
  assert.equal(await page.locator('#pcb-grid [aria-pressed=true]').getAttribute('data-edition'),'kikko');assert.deepEqual(errors,[]);
  // Refresh the README's current underside render with the same Asanoha/black finish.
  await page.setViewportSize({width:1600,height:1000});await open();await select('both','asanoha');await page.click('#pcb-masks [data-mask="black"]');
  await page.click('#panel-close');await page.click('#fit');await page.waitForTimeout(1500);
  const raw=path.join(out,'underside.png'),preview='docs/images/revI-pcb-underside.png';
  await page.locator('#canvas').screenshot({path:raw,style:'.bar,.stage > :not(canvas),#workspace{visibility:hidden!important}html,body{background:transparent!important}',omitBackground:true});
  execFileSync('magick',[raw,'-trim','+repage','-bordercolor','none','-border','4%x6%','-resize','1600x>','-strip',path.join(root,preview)]);
  const report={mixed_halves:true,rendered_choices_all_sizes:true,correct_downloads_all_sizes:true,shared_link_fresh_context:true,reload:true,undo_redo:true,paired_choice:true,mobile_width:390,browser:await browser.version(),errors,
   preview:{path:preview,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,preview))).digest('hex')}};
  fs.writeFileSync(path.join(root,'validation/pcb-viewer.json'),JSON.stringify(report,null,2)+'\n');console.log(report);
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
