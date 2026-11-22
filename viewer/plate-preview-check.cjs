// SPDX-License-Identifier: GPL-3.0-or-later
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
const out=path.resolve(__dirname,'../build/plate-preview');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const server=await require('./serve-docs.cjs')(),browser=await chromium.launch({args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
 try{
  const p=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'}),errors=[],requests=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push(r.url()));
  await p.goto((process.env.FLAN36_EXPLORER_URL||server.base+'explore/')+'?theme=flan&diagnostics');
  await p.waitForFunction(()=>window.flan36);await p.evaluate(()=>window.flan36.idle());
  await p.click('[data-lang=es]');await p.click('#nav-customize');await p.click('#quick-print-open');await p.selectOption('#print-printer','X2D');
  const visible=()=>p.locator('#plate-content canvas').waitFor();
  await p.click('#print-scope [data-value=caps]');await visible();
  const capture=async name=>{await p.locator('#quick-print .dialog-body').evaluate(n=>n.scrollTop=0);await p.screenshot({path:path.join(out,name+'.png')});};
  const figure=p.locator('.pp-figure canvas'),part=p.locator('.pp-part').first();
  const unselected=await figure.evaluate(n=>n.toDataURL());await part.click();
  assert.equal(await part.getAttribute('aria-pressed'),'true');assert.notEqual(await figure.evaluate(n=>n.toDataURL()),unselected);
  await part.click();assert.equal(await figure.evaluate(n=>n.toDataURL()),unselected);
  await capture('auto-mobile');assert.equal(await p.locator('.pp-nav button').count(),1);
  assert.match(await p.locator('.pp-facts').textContent(),/36 piezas/);
  assert.match(await p.locator('.pp-seq').textContent(),/Por objeto/);
  assert(!requests.some(url=>/\/printing-[a-f\d]+\.bin/.test(url)),'preview loaded print meshes');
  async function verify(name){
   await visible();
   const before=[];
   for(const tab of await p.locator('.pp-nav button').all()){
    await tab.click();
    before.push(await p.locator('.pp-card').evaluate(card=>({
     count:[...card.querySelectorAll('.pp-parts li small')].reduce((n,el)=>n+Number(el.textContent.slice(1)),0),
     names:[...card.querySelectorAll('.pp-palette strong')].map(e=>e.textContent),
     sequence:card.querySelector('.pp-seq').textContent
    })));
   }
   const promise=p.waitForEvent('download');await p.click('#print-project');const file=path.join(out,name+'.3mf'),download=await promise;
   assert.equal(download.suggestedFilename().includes('-by-spool'),name==='split');await download.saveAs(file);
   const read=key=>cp.execFileSync('unzip',['-p',file,key],{encoding:'utf8',maxBuffer:80e6});
   const csv=read('Metadata/Flan/Filaments.csv').trim().split('\n').slice(1).map(l=>l.split(','));
   const xml=read('Metadata/model_settings.config'),model=read('3D/3dmodel.model');
   const plates=[...xml.matchAll(/<plate>(.*?)<\/plate>/g)];
   assert.equal(plates.length,before.length);
   for(const [i,[,plate]] of plates.entries()){
    const names=csv.filter(r=>+r[0]===i+1).map(r=>r[3].split(' · ').at(-1));
    assert.deepEqual(before[i].names,names);
    assert.equal(before[i].sequence,plate.includes('value="by object"')?'Por objeto':'Por capa');
    let count=0;
    for(const [,id] of plate.matchAll(/key="object_id" value="(\d+)"/g)){
     const object=model.match(new RegExp('<object id="'+id+'" type="model" name="([^"]+)"><components>(.*?)</components>'));
     count+=object[1].startsWith('Keycaps · ')?(object[2].match(/<component /g)||[]).length:1;
    }
    assert.equal(before[i].count,count);
   }
   return before;
  }
  await verify('auto');await p.click('[data-split=true]');await visible();
  assert.equal(await p.locator('.pp-nav button').count(),4);assert(!/\.3mf/i.test(await p.locator('#print-status').innerText()));await capture('split-mobile');
  assert.deepEqual((await verify('split')).map(b=>b.count).sort((a,b)=>b-a),[30,2,2,2]);
  await p.click('[data-quick-close]');await p.setViewportSize({width:1440,height:960});await p.click('#nav-files');
  await p.click('#print-scope [data-value=complete]');await p.click('[data-split=false]');await visible();
  await p.locator('.pp-nav button').first().click();const preview=p.locator('#print-plate-plan');
  await preview.evaluate(n=>n.scrollIntoView({block:'center',behavior:'instant'}));
  await p.waitForFunction(()=>{const n=document.querySelector('.pp-figure canvas'),r=n.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===n;});
  await preview.screenshot({path:path.join(out,'kit-desktop.png')});await verify('kit');
  const custom=await p.evaluate(()=>window.flan36.snapshot().configuration);
  custom.fasteners='common-m2';custom.cases.left.match_frame=false;custom.cases.left.base_color='#1942f0';delete custom.filaments;
  await p.locator('#load-config').setInputFiles({name:'my-case.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(custom))});
  await p.waitForFunction(()=>window.flan36.snapshot().configuration.cases.left.base_color==='#1942f0');
  await p.evaluate(()=>window.flan36.idle());await p.click('#print-half [data-value=left]');await p.click('#print-scope [data-value=shells]');await visible();
  assert((await verify('custom')).some(plate=>plate.names.includes('#1942F0')));
  assert(await p.locator('#plate-policy').isHidden());
  await p.click('[data-lang=en]');await p.locator('.pp-card').waitFor();assert.match(await p.locator('.pp-seq').textContent(),/By layer|By object/);
  assert.deepEqual(errors,[]);console.log('PASS: mobile and desktop previews before download match exported plate count, pieces, spools and sequences for grouped keys, separated keys and complete kit.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
