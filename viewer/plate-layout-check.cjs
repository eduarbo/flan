// SPDX-License-Identifier: GPL-3.0-or-later
// Download through the editor and count physical pieces inside multipart print groups.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
const out=path.resolve(__dirname,'../build/plate-layout');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const server=await require('./serve-docs.cjs')(),browser=await chromium.launch({args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});
  page.setDefaultTimeout(40000);
  await page.goto((process.env.FLAN36_EXPLORER_URL||server.base+'explore/')+'?theme=flan&diagnostics');
  const idle=async()=>{await page.waitForFunction(()=>window.flan36);await page.evaluate(()=>window.flan36.idle());};
  await idle();await page.click('[data-lang=es]');await page.click('#nav-customize');await page.click('#quick-print-open');
  await page.selectOption('#print-printer','X2D');
  async function download(name,scope){
   await page.click('#print-scope [data-value='+scope+']');
   const wait=page.waitForEvent('download');await page.click('#print-project');
   const file=path.join(out,name+'.3mf');await (await wait).saveAs(file);
   const read=entry=>cp.execFileSync('unzip',['-p',file,entry],{encoding:'utf8',maxBuffer:80e6});
   const cfg=read('Metadata/model_settings.config'),table=read('Metadata/Flan/Filaments.csv');
   const plates=[...cfg.matchAll(/<plate>(.*?)<\/plate>/g)].map(m=>({
    name:m[1].match(/key="plater_name" value="([^"]+)"/)[1],
    sequence:m[1].match(/key="print_sequence" value="([^"]+)"/)[1],
    instances:[...m[1].matchAll(/key="object_id" value="(\d+)"/g)].map(x=>x[1])
   }));
   assert(plates.every(p=>p.instances.length),'empty plate');
   return {read,plates,table};
  }
  const caps=await download('Flan36-X2D-0.4-keycaps','caps');
  assert.equal(caps.plates.length,1);assert.equal(caps.plates[0].sequence,'by object');
  const mesh=caps.read('3D/3dmodel.model');
  const counts=caps.plates[0].instances.map(id=>{
   const obj=mesh.match(new RegExp('<object id="'+id+'"[^>]*><components>(.*?)</components>'))[1];
   return (obj.match(/<component /g)||[]).length;
  });
  assert.deepEqual(counts.sort((a,b)=>b-a),[30,2,2,2]);assert.equal(caps.read('Metadata/Flan/Keycaps.csv').trim().split('\n').length,37);
  await page.locator('#plate-content canvas').waitFor();
  assert.match(await page.locator('#quick-plan').innerText(),/Por objeto/);
  await page.locator('#quick-plan').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'keycaps-mobile.png')});
  await page.click('[data-quick-close]');await page.click('#nav-files');
  const archiveEvent=page.waitForEvent('download');await page.click('#print-kit');
  const archive=path.join(out,'keycaps.zip');await (await archiveEvent).saveAs(archive);
  const manifest=JSON.parse(cp.execFileSync('unzip',['-p',archive,'manifest.json'],{encoding:'utf8'}));
  assert.equal(manifest.scope,'caps');assert.equal(manifest.parts.length,0);assert.equal(manifest.plates[0].objects,36);
  assert.equal(manifest.keycaps.groups.reduce((sum,g)=>sum+g.count,0),36);
  const full=await download('Flan36-X2D-0.4-kit','complete');
  assert.deepEqual(full.plates.map(p=>p.sequence),['by layer','by layer','by object']);
  const conf=await page.evaluate(()=>window.flan36.snapshot().configuration);
  for(const side of ['left','right']){
   conf.cases[side].match_frame=false;conf.cases[side].base_color='#ffffff';conf.cases[side].plate_color='#1188ee';
   conf.frames[side].color='#ff5522';conf.frames[side].accents={detail:'#ff5522',accent:'#ff5522',secondary:'#ff5522'};
   for(const key of Object.values(conf.keycaps[side]))key.color='#ffffff';
  }
  delete conf.filaments;
  await page.locator('#load-config').setInputFiles({name:'spools.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(conf))});
  await idle();await page.selectOption('#print-method','object');await page.click('#print-half [data-value=left], #print-half [data-side=left]');
  const shell=await download('Three-colors-half-X2D','shells');
  assert(shell.plates.some(p=>p.sequence==='by object'));
  await page.click('#print-half [data-value=both]');const mono=await download('White-keys-X2D','caps');
  assert.equal(mono.plates.length,1);assert.equal(mono.plates[0].sequence,'by layer');assert.equal(mono.plates[0].instances.length,36);
  await page.selectOption('#print-printer','A1 mini');
  await page.selectOption('#print-method','manual');const mini=await download('Manual-A1-mini','complete');
  for(const [i,plate] of mini.plates.entries()){
   assert.equal(plate.sequence,'by layer');
   assert.equal(mini.table.trim().split('\n').filter(row=>row.startsWith((i+1)+',')).length,1);
  }
  await page.click('#nav-customize');await page.click('#editor-tabs [data-panel=size]');await page.click('#size-grid [data-variant=flan54]');
  await idle();await page.click('#editor-tabs [data-panel=themes]');await page.click('[data-theme=flan]');
  await page.click('#quick-print-open');await page.selectOption('#print-method','ams');
  const large=await download('Flan54-A1-mini','complete');
  assert.equal(large.read('Metadata/Flan/Keycaps.csv').trim().split('\n').length,55);
  assert(large.plates.every((plate,i)=>large.table.trim().split('\n').filter(row=>row.startsWith((i+1)+',')).length<=4));
  console.log('PASS: 36 physical caps in four color groups on one sequential plate, dense monochrome caps, mixed case sequences, single-spool mini, and mobile summary.');
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
