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
  const base=process.env.FLAN36_EXPLORER_URL||server.base+'explore/';
  await p.goto(base+'?theme=flan&frame=gameboy&diagnostics');await p.waitForFunction(()=>window.flan36);
  const snap=()=>p.evaluate(()=>window.flan36.snapshot().configuration);
  const save=async(button,file)=>{const event=p.waitForEvent('download');await p.click(button);await (await event).saveAs(file);};
  const {rankedSwatches,spoolById}=await import('./filament-swatches.js');
  const {contrastRatio}=await import('./home/tokens.js');
  const stock=require('../design/preset-filaments.json');
  const qualified=new Set(Object.entries(stock.available).flatMap(([range,names])=>names.map(name=>range+'/'+name)));
  for(const id of qualified)assert(spoolById(id),id);
  const closest=(hex,body,reserved=new Set())=>rankedSwatches(hex).find(spool=>qualified.has(spool.id)&&!reserved.has(spool.hex.toLowerCase())&&(!body||contrastRatio(spool.hex,body)>=1.5)).hex.toLowerCase();
  function checkKeySlots(c,side,palette,resolve){
   for(const [ref,key] of Object.entries(c.keycaps[side])){
    const row=Number(ref[1]),col=Number(ref[2]);
    const authored=row===3?palette.thumbs[col]:palette.pattern==='rows'?palette.colors[row]:palette.base;
    assert.equal(key.color,resolve(authored),ref);
    checkAssigned(c,side,key.color);
   }
  }
  function checkAssigned(config,side,hex){
   const id=config.filaments?.[side]?.[hex];
   assert(qualified.has(id),'missing qualified spool for '+hex);
   assert.equal(spoolById(id).hex.toLowerCase(),hex);
  }
  await p.click('#nav-customize');await p.click('#editor-tabs [data-panel=themes]');
  for(const theme of require('../design/themes.json').themes){
   await p.click('[data-theme="'+theme.id+'"]');
   const c=await snap(),body=closest(theme.frame.body);
   for(const side of ['left','right']){
    const f=c.frames[side],cs=c.cases[side],caps=theme.keycaps;
    const mapped=new Map(),frames=Object.values(theme.frame),keys=[caps.base,...(caps.colors||[]),...caps.thumbs].filter(Boolean);
    function record(source,printed){
     if(mapped.has(source))assert.equal(mapped.get(source),printed,'same authored color across parts');
     mapped.set(source,printed);
    }
    record(theme.frame.body,f.color);
    for(const [role,hex] of Object.entries(f.accents))record(theme.frame[role],hex);
    for(const [ref,key] of Object.entries(c.keycaps[side])){
     const row=Number(ref[1]),col=Number(ref[2]);record(row===3?caps.thumbs[col]:caps.pattern==='rows'?caps.colors[row]:caps.base,key.color);
    }
    for(const group of [frames,keys])assert.equal(new Set(group).size,new Set(group.map(color=>mapped.get(color))).size,'distinct authored colors within '+theme.id);
    function expected(source){
     if(source===theme.frame.body)return body;
     const peers=[frames,keys].filter(group=>group.includes(source)).flat().filter(color=>color!==source);
     return closest(source,frames.includes(source)?body:null,new Set(peers.map(color=>mapped.get(color))));
    }
    assert.equal(cs.base_color,expected(theme.base));assert.equal(cs.plate_color,expected(theme.plate));
    assert.equal(f.color,body);
    for(const [role,hex] of Object.entries(f.accents))assert.equal(hex,expected(theme.frame[role]));
    for(const hex of [cs.base_color,cs.plate_color,f.color,...Object.values(f.accents)])checkAssigned(c,side,hex);
    checkKeySlots(c,side,theme.keycaps,expected);
   }
  }
  await p.click('#editor-tabs [data-panel=keycaps]');
  const tune=p.locator('#panel-keycaps .tune[aria-expanded=false]');if(await tune.count())await tune.click();
  for(const palette of require('../design/keycap-themes.json').palettes){
   await p.click('[data-cap-palette="'+palette.id+'"]');const c=await snap();
   for(const side of ['left','right'])checkKeySlots(c,side,palette,hex=>closest(hex));
  }
  await p.click('#editor-tabs [data-panel=themes]');await p.click('[data-theme="flan"]');
  const preset=await snap();await p.click('#nav-files');await p.selectOption('#print-method','ams');
  await p.selectOption('#print-printer','X2D');
  assert.equal(await p.inputValue('#print-nozzle'),'0.4');
  assert(await p.locator('#print-bed-field').isHidden());
  const presetFile=path.join(out,'Flan-complete.3mf');await save('#print-project',presetFile);
  const machine=JSON.parse(read(presetFile,'Metadata/project_settings.config'));
  assert.equal(machine.printer_settings_id,'Bambu Lab X2D 0.4 nozzle');assert.equal(machine.print_settings_id,'0.20mm Standard @BBL X2D');
  assert.deepEqual(machine.nozzle_diameter,['0.4','0.4']);assert.equal(machine.printable_height,'261');
  const official=['Bambu PLA Matte','Bambu PLA Basic','Generic PLA','Generic PLA'];
  assert.deepEqual(machine.filament_settings_id,official.map(name=>name+' @BBL X2D 0.4 nozzle'));
  await p.selectOption('#print-nozzle','0.6');await p.selectOption('#print-printer','A1 mini');
  assert.deepEqual((await snap()).print_setup,{mode:'ams',bed:180,printer:'A1 mini',nozzle:'0.6'});
  await p.selectOption('#print-printer','');assert(await p.locator('#print-bed-field').isVisible());
  const presetRows=read(presetFile,'Metadata/Flan/Filaments.csv').trim().split('\n').slice(1);
  const actual=new Set(presetRows.map(row=>row.split(',').slice(-2).join(',')));
  const expected=new Set(Object.entries(preset.filaments.left).map(([hex,id])=>id.replace('/',' · ')+','+hex.toUpperCase()));
  assert.deepEqual(actual,expected,'preset spool identity reaches the complete 3MF without a matching step');
  await p.click('#filament-guide summary');
  await p.getByRole('button',{name:'Choose spools and substitutes'}).click();
  assert(await p.locator('#theme-filaments').evaluate(el=>el.open));
  await p.locator('#theme-spool-list .theme-spool').nth(1).waitFor();
  const spacing=await p.locator('#theme-spool-list').evaluate(list=>{
    const [first,second]=list.children;
    const row=first.getBoundingClientRect(),label=first.querySelector('.filament-label').getBoundingClientRect();
    return {gap:second.getBoundingClientRect().top-row.bottom,above:label.top-row.top,below:row.bottom-label.bottom};
  });
  assert(spacing.gap>=6 && spacing.above>=8 && spacing.below>=8,'Filament rows and their labels need visible space');
  assert(await p.locator('#match-theme-spools').isHidden());
  await p.click('#editor-tabs [data-panel=cases]');
  const caseControls=p.locator('#panel-cases .tune[aria-expanded=false]');if(await caseControls.count())await caseControls.click();
  await p.locator('#case-base_color').evaluate(input=>{input.value='#ede0be';input.dispatchEvent(new Event('input',{bubbles:true}));});
  await p.click('#editor-tabs [data-panel=themes]');
  await p.click('#match-theme-spools');assert(await p.locator('#match-theme-spools').isHidden());const matched=await snap();assert(Object.keys(matched.filaments.left).length>=3);
  await p.click('#theme-spool-list button:first-child');const dlg=p.locator('dialog.filament-picker');
  const choices=dlg.locator('button[data-spool]');
  assert(await choices.count()>100);
  assert.equal(await choices.locator('.filament-reel').count(),await choices.count());
  assert.equal(await dlg.locator('[aria-pressed=true]').count(),1);
  await dlg.getByRole('combobox',{name:'Color family',exact:true}).selectOption('purple');
  await dlg.getByRole('combobox',{name:'Filament range',exact:true}).selectOption('Polymaker Panchroma Matte');
  assert(await dlg.locator('button[data-spool]').count()>=2);await dlg.getByRole('searchbox').fill('Lavender');
  await dlg.locator('[data-spool="Polymaker Panchroma Matte/Lavender Purple"]').click();
  assert.equal((await snap()).cases.left.base_color,'#9572bf');
  assert.equal(await p.locator(':focus').getAttribute('data-theme-color'),'#9572bf');
  await p.click('#editor-tabs [data-panel=cases]');const caseTune=p.locator('#panel-cases .tune[aria-expanded=false]');if(await caseTune.count())await caseTune.click();
  for(const [side,range,name] of [['left','Bambu PLA Matte','Ivory White'],['right','Bambu PLA Basic','Jade White']]){
   await p.click('#case-target [data-side='+side+']');await p.locator('.color-editor').filter({has:p.locator('#case-base_color')}).locator('.choose-spool').click();
   await dlg.getByRole('searchbox').fill('white Bambu Lab');
   for(const [finish,white] of [['matte','Ivory White'],['basic','Jade White']]){
    const option=choices.filter({hasText:white});assert.equal(await option.count(),1);
    assert.equal(await option.locator('.filament-reel').getAttribute('data-finish'),finish);
    assert.equal(await option.locator('code').textContent(),'#FFFFFF');
   }
   await dlg.getByRole('searchbox').fill(range+'/'+name);assert.equal(await choices.count(),1);
   await dlg.locator('[data-spool="'+range+'/'+name+'"]').click();
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
   // This generic bed has no machine-specific clearance for sequential printing.
   assert.equal((settings.match(/key="print_sequence" value="by layer"/g)||[]).length,slots.size);
   assert(!settings.includes('key="print_sequence" value="by object"'));
   const notes=read(file,'Metadata/Flan/Print-notes.txt');assert(notes.includes('Ø2.1 mm pilots')&&!/magnet|im[aá]n|glue|adhesiv/i.test(notes),'the print notes describe the screws and no magnets');
   const frames=[...settings.matchAll(/<object id="\d+"><metadata key="name" value="[^"]*-frame-[^"]*"\/>.*?<\/object>/g)];
   assert.equal(frames.length,2);assert(frames.every(m=>(m[0].match(/<part /g)||[]).length===(mode==='ams'?4:1)));
   await p.waitForFunction(()=>!document.querySelector('#print-plate-plan').hidden);
  }
  await p.reload();await p.waitForFunction(()=>window.flan36);const restored=await snap();assert.deepEqual(restored.print_setup,{mode:'manual',bed:180});assert.deepEqual(restored.filaments,custom.filaments);
  assert.deepEqual(errors,[]);console.log('PASS: every theme and keycap palette uses its nearest qualified colors, preset 3MF, real swatches, alternatives, same-HEX spools, theme round trip, all three 3MF modes, plate budgets and saved setup.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
