// SPDX-License-Identifier: GPL-3.0-or-later
// Run against the local build, or set FLAN36_EXPLORER_URL to a staged or deployed explorer.
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');

(async()=>{
 const server=await require('./serve-docs.cjs')(),base=process.env.FLAN36_EXPLORER_URL||server.base+'explore/';
 const browser=await chromium.launch({executablePath:process.env.FLAN36_BROWSER,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
 const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'flan-owned-check-'));
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('flan.lang','es'));
  await page.goto(base+'?size=flan46&diagnostics#build-solder');
  await page.waitForFunction(()=>window.flan36?.settled);await page.evaluate(()=>flan36.settled());
  const guide=page.locator('#build-assembly .solder-map');
  assert.match(await guide.locator('#face').textContent(),/Flan46.*Izquierda.*Reverso/);
  assert.equal(await guide.locator('#map text').count(),23);
  await guide.locator('#side').selectOption('right');await guide.locator('#step').selectOption('4');
  assert.match(await guide.locator('#face').textContent(),/Derecha.*Cara de teclas/);
  assert.match(await guide.locator('#detail').textContent(),/Pin 1 positivo/);
  for(const half of ['left','right']){
   await guide.locator('#side').selectOption(half);
   const padLabels=await guide.locator('#detail [data-pin]').evaluateAll(labels=>labels.map(label=>({
    text:label.textContent,x:Number(label.getAttribute('x')),y:Number(label.getAttribute('y'))
   })));
   const pads=await guide.locator('#detail rect,#detail circle').evaluateAll(elements=>{
    const positive=elements.find(e=>e.getAttribute('fill')==='#fff8dc'),negative=elements.find(e=>e.getAttribute('fill')==='#ffbd65');
    return [[Number(positive.getAttribute('x'))+.75,Number(positive.getAttribute('y'))+.75],[Number(negative.getAttribute('cx')),Number(negative.getAttribute('cy'))]];
   });
   for(const [i,tag] of ['1 BAT+','2 GND'].entries()){
    const label=padLabels.find(l=>l.text===tag);assert(Math.abs(label.y-pads[i][1])<.1);assert(label.x>pads[i][0]+1);
   }
  }
  await page.click('#nav-customize');await page.click('#editor-tabs [data-panel=themes]');await page.click('#my-spools');
  const library=page.locator('dialog.spool-library'),search=library.getByRole('searchbox');
  await library.getByRole('button',{name:'Generar temas'}).click();assert.match(await library.innerText(),/Agrega una bobina/);
  await library.getByRole('button',{name:'Elegir bobinas'}).click();
  const codes={'11102':'Ash Gray','10402':'Sunflower Yellow','10200':'Red','10501':'Bambu Green','10603':'Cyan','10502':'Mistletoe Green','10100':'Jade White','10101':'Black','33102':'Black'};
  for(const [code,name] of Object.entries(codes)){
   await search.fill('('+code+')');const row=library.locator('button[data-owned-spool]');
   assert.equal(await row.count(),1);assert.equal(await row.locator('strong').innerText(),name);
   assert.match(await row.locator('.filament-series').innerText(),new RegExp(code));
   if(['33102','10101','10402','10501'].includes(code))await row.click();
  }
  for(const [brand,line] of [['SUNLU','PETG'],['Overture','PETG'],['ELEGOO','Rapid PETG'],['Bambu Lab','PETG HF']]){
   await search.fill('Black');await library.getByRole('combobox',{name:'Marca',exact:true}).selectOption(brand);
   await library.getByRole('combobox',{name:'Línea de filamento'}).selectOption({label:line});
   const row=library.locator('[data-owned-spool]').first();assert.match(await row.innerText(),/Black/);
   const badge=await row.locator('.filament-series b').evaluate(el=>getComputedStyle(el,'::before').backgroundImage);
   assert.match(badge,/data:image\/png/);
   await library.getByRole('button',{name:'Limpiar filtros'}).click();
  }
  await library.getByRole('button',{name:'Generar temas'}).click();
  assert.equal(await library.locator('[data-recipe=PLA]').count(),3);
  assert.equal(await library.locator('[data-recipe=PETG]').count(),1);
  await library.locator('[data-recipe=PETG]').click();
  const config=()=>page.evaluate(()=>flan36.snapshot().configuration);
  for(const half of ['left','right'])assert.deepEqual((await config()).filaments[half],{'#000000':'Bambu PETG HF/Black'});
  await page.click('#quick-print-open');await page.selectOption('#print-printer','X2D');await page.click('#print-scope [data-value=shells]');
  const download=page.waitForEvent('download');await page.click('#print-project');const file=path.join(scratch,'shells.3mf');
  await (await download).saveAs(file);
  const cfg=JSON.parse(cp.execFileSync('unzip',['-p',file,'Metadata/project_settings.config'],{encoding:'utf8'}));
  assert.deepEqual(cfg.filament_type,['PETG']);assert.deepEqual(cfg.filament_settings_id,['Bambu PETG HF @BBL X2D 0.4 nozzle']);
  await page.keyboard.press('Escape');
  if(!await page.locator('#theme-filaments').evaluate(el=>el.open))await page.click('#theme-filaments > summary');
  await page.click('#theme-spool-list button:first-child');const picker=page.locator('dialog.filament-picker');
  assert.equal((await picker.locator('h3').first().innerText()).toLowerCase(),'mis bobinas');
  const ids=await picker.locator('[data-spool]').evaluateAll(rows=>rows.map(r=>r.dataset.spool));
  assert.equal(ids.length,new Set(ids).size);assert.equal(await picker.locator('h3 + .spool-grid').first().locator('button').count(),4);
  await picker.getByRole('searchbox').fill('Black PETG HF');assert.equal(await picker.locator('[data-spool]').count(),1);
  await picker.locator('[data-spool]').click();
  await page.reload();await page.waitForFunction(()=>window.flan36?.settled);
  assert.equal((await config()).filaments.left['#000000'],'Bambu PETG HF/Black');
  assert.deepEqual(errors,[]);console.log('PASS: integrated solder maps, product codes, logos, owned filters and recipes, PETG HF X2D 3MF and reload.');
 }finally{await browser.close();server.close();fs.rmSync(scratch,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
