// SPDX-License-Identifier: GPL-3.0-or-later
// Exercise catalog substitutions, portable themes and the three real project downloads.
const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const out=path.join(__dirname,'../build/filament-print');fs.mkdirSync(out,{recursive:true});
const read=(file,entry)=>cp.execFileSync('unzip',['-p',file,entry],{encoding:'utf8',maxBuffer:20e6});
(async()=>{
 const server=await require('./serve-docs.cjs')(),browser=await chromium.launch({args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
 try{
  const p=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(90000);
  await p.goto(server.base+'explore/?theme=flan&frame=gameboy&diagnostics');await p.waitForFunction(()=>window.flan36);
  const snap=()=>p.evaluate(()=>window.flan36.snapshot().configuration);
  const save=async(button,file)=>{const event=p.waitForEvent('download');await p.click(button);await (await event).saveAs(file);};
  await p.click('#nav-files');await p.click('#filament-guide summary');
  await p.getByRole('button',{name:'Choose spools and substitutes'}).click();
  assert(await p.locator('#theme-filaments').evaluate(el=>el.open));
  await p.click('#match-theme-spools');const matched=await snap();assert(Object.keys(matched.filaments.left).length>=3);
  await p.click('#theme-spool-list button:first-child');const dlg=p.locator('dialog.filament-picker');
  assert(await dlg.locator('button[data-spool]').count()>100);
  await dlg.getByRole('combobox',{name:'Color family',exact:true}).selectOption('purple');
  await dlg.getByRole('combobox',{name:'Filament range',exact:true}).selectOption('Polymaker Panchroma Matte');
  assert(await dlg.locator('button[data-spool]').count()>=2);await dlg.getByRole('searchbox').fill('Lavender');
  await dlg.locator('[data-spool="Polymaker Panchroma Matte/Lavender Purple"]').click();
  assert.equal((await snap()).cases.left.base_color,'#9572bf');
  assert.equal(await p.locator(':focus').getAttribute('data-theme-color'),'#9572bf');
  await p.click('#editor-tabs [data-panel=cases]');const tune=p.locator('#panel-cases .tune[aria-expanded=false]');if(await tune.count())await tune.click();
  for(const [side,range,name] of [['left','Bambu PLA Matte','Ivory White'],['right','Bambu PLA Basic','Jade White']]){
   await p.click('#case-target [data-side='+side+']');await p.locator('.color-editor').filter({has:p.locator('#case-base_color')}).locator('.choose-spool').click();
   await dlg.getByRole('searchbox').fill(name);await dlg.locator('[data-spool="'+range+'/'+name+'"]').click();
  }
  const custom=await snap();assert.equal(custom.cases.left.base_color,custom.cases.right.base_color);
  assert.notEqual(custom.filaments.left['#ffffff'],custom.filaments.right['#ffffff']);
  await p.click('#editor-tabs [data-panel=themes]');const theme=path.join(out,'theme.json');
  await save('#save-print-theme',theme);await p.click('[data-theme=matcha]');
  await p.locator('#print-theme-file').setInputFiles(theme);await p.waitForFunction(()=>document.querySelector('#theme-file-status').textContent.includes('applied'));
  assert.deepEqual((await snap()).filaments,custom.filaments);assert.deepEqual((await snap()).frames,custom.frames);
  await p.click('#nav-files');await p.selectOption('#print-bed','180');await p.click('#print-scope [data-value=shells]');
  for(const mode of ['ams','object','manual']){
   await p.selectOption('#print-method',mode);const file=path.join(out,mode+'.3mf');await save('#print-project',file);
   const settings=read(file,'Metadata/model_settings.config'),spools=read(file,'Metadata/Flan/Filaments.csv');
   assert(spools.includes('Bambu PLA Matte · Ivory White')&&spools.includes('Bambu PLA Basic · Jade White'));
   assert.equal((settings.match(/<model_instance>/g)||[]).length,6);
   const project=JSON.parse(read(file,'Metadata/project_settings.config'));assert.equal(project.printable_area[2],'180x180');
   assert.equal(project.filament_colour.filter(hex=>hex==='#FFFFFF').length,2);
   const slots=new Map();for(const row of spools.trim().split('\n').slice(1)){const [plate,,slot]=row.split(',');if(!slots.has(plate))slots.set(plate,new Set());slots.get(plate).add(slot);}
   assert([...slots.values()].every(s=>s.size<=(mode==='manual'?1:4)));
   assert(settings.includes('key="print_sequence" value="'+(mode==='object'?'by object':'by layer')+'"'));
   if(mode==='object'){
    for(const [,plate] of settings.matchAll(/<plate>([\s\S]*?)<\/plate>/g)){
     if(/value="(Bases|Display frames)"/.test(plate)){
      assert.equal((plate.match(/<model_instance>/g)||[]).length,1);
      assert(plate.includes('key="print_sequence" value="by layer"'));
     }
    }
   }
   const frames=[...settings.matchAll(/<object id="\d+"><metadata key="name" value="[^"]*-frame-[^"]*"\/>.*?<\/object>/g)];
   assert.equal(frames.length,2);assert(frames.every(m=>(m[0].match(/<part /g)||[]).length===(mode==='ams'?4:1)));
   await p.waitForFunction(()=>!document.querySelector('#print-plate-plan').hidden);
  }
  await p.reload();await p.waitForFunction(()=>window.flan36);const restored=await snap();assert.deepEqual(restored.print_setup,{mode:'manual',bed:180});assert.deepEqual(restored.filaments,custom.filaments);
  assert.deepEqual(errors,[]);console.log('PASS: real swatches, alternatives, same-HEX spools, theme round trip, all three 3MF modes, plate budgets and saved setup.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
