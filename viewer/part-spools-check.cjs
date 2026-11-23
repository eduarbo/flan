// SPDX-License-Identifier: GPL-3.0-or-later
// Run against the built explorer or FLAN36_EXPLORER_URL.
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
const red='Bambu PLA Basic/Red',petg='Bambu PETG HF/Black',pla='Bambu PLA Basic/Black';
const halves=['left','right'];

(async()=>{
 const server=await require('./serve-docs.cjs')();
 const base=process.env.FLAN36_EXPLORER_URL||server.base+'explore/';
 const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'flan-part-check-'));
 const browser=await chromium.launch({executablePath:process.env.FLAN36_BROWSER,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(ids=>{
   localStorage.setItem('flan.lang','es');
   for(const id of ids)localStorage.setItem('flan.spools.v1/'+id,'1');
  },[red,petg,'Bambu PLA Basic/Jade White','Bambu PLA Basic/Sunflower Yellow']);
  const snapshot=()=>page.evaluate(()=>flan36.snapshot().configuration);
  const panel=async()=>{
   await page.click('#nav-customize');await page.click('#editor-tabs [data-panel=themes]');
   if(!await page.locator('#theme-filaments').evaluate(el=>el.open))await page.click('#theme-filaments > summary');
  };
  const row=slot=>page.locator('#theme-spool-list [data-part="'+slot+'"]').first();
  const picker=page.locator('dialog.filament-picker');
  async function change(slot,id){
   await row(slot).click();if(slot==='plate')assert.match(await picker.locator('.target-swatch').innerText(),/Placa/);
   assert.equal(await picker.getByRole('heading',{name:'Mis bobinas'}).count(),1);
   await picker.getByRole('searchbox').fill(id);
   await picker.locator('[data-spool="'+id+'"]').click();
  }
  const idFor=(c,side,slot,hex)=>c.part_filaments?.[side]?.[slot]||c.filaments?.[side]?.[hex];
  function verifyPlateOnly(before,after,sides){
   for(const side of halves){
    assert.equal(after.cases[side].base_color,before.cases[side].base_color);
    assert.deepEqual(after.frames[side],before.frames[side]);assert.deepEqual(after.keycaps[side],before.keycaps[side]);
    assert.equal(after.cases[side].plate_color,sides.includes(side)?'#000000':before.cases[side].plate_color);
    if(sides.includes(side))assert.equal(idFor(after,side,'plate','#000000'),petg);
   }
  }
  async function download(selector,name){
   const event=page.waitForEvent('download');await page.click(selector);
   const dest=path.join(scratch,name);await (await event).saveAs(dest);return dest;
  }
  await page.goto(base+'?diagnostics#theme-filaments');await page.waitForFunction(()=>window.flan36?.settled);await page.evaluate(()=>flan36.settled());
  assert(await row('plate').isVisible());
  assert.equal(await page.locator('#spool-view [data-view=parts]').getAttribute('aria-pressed'),'true');
  const generated=page.locator('#owned-theme-grid [data-recipe=PLA]').filter({has:page.getByText('Red',{exact:true})});
  await generated.click();await page.click('#pin-theme');
  const start=await snapshot();
  for(const slot of ['base','plate','frame'])assert.equal(await row(slot).getAttribute('data-spool'),red);
  await change('plate',petg);verifyPlateOnly(start,await snapshot(),halves);
  await page.click('#undo');await page.waitForFunction(()=>document.querySelector('[data-part=plate]').dataset.spool==='Bambu PLA Basic/Red');
  await page.click('#themes-grid [data-theme=flan]');
  const preset=await snapshot();await change('plate',petg);verifyPlateOnly(preset,await snapshot(),halves);
  await page.click('#pinned-theme-grid button');assert.equal(await row('plate').getAttribute('data-spool'),red);
  const tune=page.locator('[aria-controls=tune-themes][aria-expanded=false]');if(await tune.count())await tune.click();
  await page.click('#theme-target [data-side=left]');await change('plate',petg);verifyPlateOnly(start,await snapshot(),['left']);
  await page.click('#theme-target [data-side=both]');await page.click('#pinned-theme-grid button');
  await page.click('#spool-view [data-view=spools]');assert.match(await row('base').innerText(),/Base.*Placa.*Marco/);
  await change('base',petg);const bulk=await snapshot();
  for(const side of halves){
   assert.equal(bulk.cases[side].base_color,'#000000');assert.equal(bulk.cases[side].plate_color,'#000000');
   assert.equal(bulk.frames[side].color,'#000000');assert.deepEqual(bulk.keycaps[side],start.keycaps[side]);
  }
  // The native case editor honours the user's color link. By part always isolates a plate.
  await page.click('#editor-tabs [data-panel=cases]');await page.click('#case-grid [data-case=level]');
  const caseTune=page.locator('[aria-controls=tune-cases][aria-expanded=false]');if(await caseTune.count())await caseTune.click();
  assert(await page.locator('#case-link-colors').isChecked());
  await page.locator('.color-editor').filter({has:page.locator('#case-plate_color')}).locator('.choose-spool').click();
  await picker.locator('[data-spool="'+red+'"]').click();
  const linked=await snapshot();
  for(const side of halves){
   assert(linked.cases[side].match_frame);assert.equal(linked.frames[side].color,linked.cases[side].base_color);
   assert.equal(linked.cases[side].plate_color,linked.cases[side].base_color);
  }
  await page.click('#editor-tabs [data-panel=themes]');await page.click('#spool-view [data-view=parts]');
  await change('plate',petg);const independent=await snapshot();verifyPlateOnly(linked,independent,halves);
  for(const side of halves)assert.equal(independent.cases[side].match_frame,false);
  await page.click('#spool-view [data-view=parts]');await page.click('#owned-theme-grid [data-recipe=PETG]');await change('plate',pla);
  const exact=await snapshot();
  for(const side of halves){
   for(const slot of ['base','frame','plate'])assert.equal(idFor(exact,side,slot,'#000000'),slot==='plate'?pla:petg);
  }
  const theme=await download('#save-print-theme','theme.json');
  await page.click('#themes-grid [data-theme=flan]');await page.locator('#print-theme-file').setInputFiles(theme);
  await page.waitForFunction(()=>document.querySelector('[data-part=plate]')?.dataset.spool==='Bambu PLA Basic/Black');
  await page.reload();await page.waitForFunction(()=>window.flan36?.settled);await panel();
  for(const [slot,id] of [['plate',pla],['base',petg],['frame',petg]])assert.equal(await row(slot).getAttribute('data-spool'),id);
  await page.click('#quick-print-open');await page.selectOption('#print-printer','X2D');await page.click('#print-scope [data-value=shells]');
  const file=await download('#print-project','project.3mf');
  const read=entry=>cp.execFileSync('unzip',['-p',file,'Metadata/'+entry],{encoding:'utf8'});
  const cfg=JSON.parse(read('project_settings.config'));
  assert.deepEqual([...cfg.filament_type].sort(),['PETG','PLA']);assert.deepEqual(cfg.filament_colour,['#000000','#000000']);
  const model=read('model_settings.config'),objectSlots=new Map();
  for(const [,body] of model.matchAll(/<object id="\d+">([\s\S]*?)<\/object>/g)){
   const name=body.match(/key="name" value="([^"]+)"/)?.[1],slot=body.match(/key="extruder" value="(\d+)"/)?.[1];
   if(name&&slot)objectSlots.set(name,cfg.filament_type[Number(slot)-1]);
  }
  for(const side of halves)for(const [part,polymer] of [['plate','PLA'],['base','PETG']]){
   const found=[...objectSlots].find(([name])=>name.startsWith(side+'-case-')&&name.endsWith('-'+part));
   assert.equal(found?.[1],polymer,side+' '+part+' has its own extruder');
  }
  await page.click('#print-scope [data-value=caps]');
  const capsFile=await download('#print-project','keycaps.3mf');
  const csv=cp.execFileSync('unzip',['-p',capsFile,'Metadata/Flan/Keycaps.csv'],{encoding:'utf8'}).trim().split('\n');
  assert(csv[0].endsWith(',spool'));assert(csv.slice(1).every(line=>line.endsWith(','+petg)));
  assert.deepEqual(errors,[]);console.log('PASS: generated, preset and pinned themes, separate plate, one half, undo, bulk edits, same-color PLA/PETG, theme round trip, reload and actual 3MF extruders.');
 }finally{await browser.close();server.close();fs.rmSync(scratch,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
