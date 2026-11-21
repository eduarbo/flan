// SPDX-License-Identifier: GPL-3.0-or-later
// Exercise the mobile sheet, the real 3MF exporter and the inventory across tabs.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
const out=path.join(__dirname,'../build/spool-library');fs.mkdirSync(out,{recursive:true});
const ids=['Bambu PLA Matte/Desert Tan','Bambu PLA Basic/Cocoa Brown','Polymaker Panchroma Matte/Wood Brown','Polymaker Panchroma Basic/Beige'];
(async()=>{
 const server=await require('./serve-docs.cjs')(),browser=await chromium.launch({args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
 const base=process.env.FLAN36_EXPLORER_URL||server.base+'explore/';
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'}),p=await ctx.newPage(),errors=[];
  p.on('pageerror',err=>errors.push(err.message));
  const open=async(page)=>{await page.goto(base+'?theme=flan&diagnostics');await page.waitForFunction(()=>window.flan36);await page.evaluate(()=>window.flan36.idle());};
  const ownedButton=(page,id)=>page.locator('[data-owned-spool="'+id+'"]');
  const themes=async(page)=>{await page.click('#nav-customize');await page.click('#editor-tabs [data-panel=themes]');};
  await open(p);await p.click('[data-lang=es]');await themes(p);
  const original=await p.evaluate(()=>window.flan36.snapshot().configuration);
  const dlg=p.locator('dialog.spool-library');
  await p.setViewportSize({width:320,height:658});
  await p.click('#printable-filter');assert(await dlg.isVisible());
  await dlg.getByRole('button',{name:'Listo',exact:true}).click();
  await dlg.waitFor({state:'detached'});assert.equal(await p.locator('#printable-filter').getAttribute('aria-pressed'),'false');
  assert(await p.locator('#printable-filter').evaluate(node=>document.activeElement===node));
  await p.click('#quick-print-open');
  assert(await p.locator('#quick-print').evaluate(node=>node.scrollWidth===node.clientWidth));
  const downloadBox=await p.locator('#print-project').boundingBox();assert(downloadBox.y+downloadBox.height<=658);
  await p.keyboard.press('Escape');
  await p.setViewportSize({width:390,height:844});await p.click('#my-spools');
  await dlg.screenshot({path:path.join(out,'library-mobile.png')});
  for(const id of ids)await ownedButton(p,id).click();
  await dlg.getByRole('searchbox').fill('white');
  await ownedButton(p,'Bambu PLA Matte/Ivory White').click();
  assert.equal(await ownedButton(p,'Bambu PLA Basic/Jade White').getAttribute('aria-pressed'),'false');
  await ownedButton(p,'Bambu PLA Matte/Ivory White').click();
  await dlg.getByRole('searchbox').fill('');await dlg.getByRole('button',{name:'Mis bobinas · 4',exact:true}).click();
  assert.equal(await dlg.locator('[data-owned-spool]').count(),4);await dlg.getByRole('button',{name:'Listo',exact:true}).click();
  assert.deepEqual(await p.evaluate(()=>window.flan36.snapshot().configuration),original);
  await p.click('#printable-filter');assert(await p.locator('[data-theme=flan]').isVisible());assert(await p.locator('[data-theme=eva-01]').isHidden());
  await p.screenshot({path:path.join(out,'theme-mobile.png')});
  await p.click('#quick-print-open');await p.selectOption('#print-printer','X2D');
  assert.equal(await p.locator('#quick-spools li').count(),4);await p.screenshot({path:path.join(out,'print-mobile.png')});
  async function save(scope){
   await p.click('#print-scope [data-value='+scope+']');const promise=p.waitForEvent('download');await p.click('#print-project');
   const file=path.join(out,scope+'.3mf');await (await promise).saveAs(file);
   const entry=key=>cp.execFileSync('unzip',['-p',file,key],{encoding:'utf8'});
   const cfg=JSON.parse(entry('Metadata/project_settings.config'));assert.equal(cfg.printer_settings_id,'Bambu Lab X2D 0.4 nozzle');
   const csv=entry('Metadata/Flan/Filaments.csv');const names=new Set(csv.trim().split('\n').slice(1).map(r=>r.split(',').at(-2)));
   const list=await p.locator('#quick-spools .filament-label strong').allTextContents();
   assert.deepEqual([...names].map(n=>n.split(' · ').at(-1)).sort(),list.sort());
   assert.equal(entry('Metadata/model_settings.config').includes('keycaps')||csv.includes('Keycaps'),scope==='complete');
  }
  await save('complete');await p.selectOption('#print-method','manual');await save('shells');assert.equal(await p.locator('#quick-spools li').count(),2);
  await p.locator('[data-quick-close]').click();
  assert.equal(await p.locator('#build-print #print-printer').inputValue(),'X2D');
  const other=await ctx.newPage();await open(other);await other.click('[data-lang=en]');await themes(other);await other.click('#my-spools');
  for(const id of ids.slice(2))await ownedButton(other,id).click();
  await p.waitForFunction(()=>document.querySelector('#library-count').textContent==='2');
  assert(await p.locator('[data-theme=flan]').isVisible(),'the shells in single-spool mode use just two colors');
  await p.click('#quick-print-open');await p.selectOption('#print-method','ams');await p.keyboard.press('Escape');
  assert(await p.locator('[data-theme=flan]').isHidden(),'AMS includes frame accents');
  await p.reload();await p.waitForFunction(()=>window.flan36);await themes(p);assert.equal(await p.locator('#library-count').textContent(),'2');
  await p.setViewportSize({width:1440,height:960});assert(await p.locator('#quick-print-open').isHidden());await p.click('#my-spools');
  await p.locator('dialog.spool-library').screenshot({path:path.join(out,'library-desktop.png')});
  // A failed inventory write stays available in this tab even after another tab saves.
  await p.evaluate(()=>{const write=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){
   if(k.startsWith('flan.spools.v1/'))throw new DOMException('Storage full','QuotaExceededError');
   return write.call(this,k,v);
  };});
  await ownedButton(p,ids[2]).click();await ownedButton(other,ids[3]).click();
  await p.waitForFunction(()=>document.querySelector('#library-count').textContent==='4');
  assert.equal(await ownedButton(p,ids[2]).getAttribute('aria-pressed'),'true');
  await p.keyboard.press('Escape');assert.deepEqual(errors,[]);await ctx.close();
  console.log('PASS: exact spool IDs, both languages, persistence and cross-tab changes, scope/mode matching, and both X2D downloads.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
