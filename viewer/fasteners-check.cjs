// The optional common-M2 screw profile: selection, link, view, shopping list, guide and downloads all agree,
// and designs saved before the option still open on the reference screws.
// FLAN36_PLAYWRIGHT_MODULE=/path/to/playwright node viewer/fasteners-check.cjs
// SPDX-License-Identifier: GPL-3.0-or-later
const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'build/fasteners-check');fs.mkdirSync(out,{recursive:true});
const unzip=(zip,file)=>cp.execFileSync('unzip',['-p',zip,file],{maxBuffer:200e6});
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const profile=JSON.parse(fs.readFileSync(path.join(root,'design/fastener-profiles.json'))).profiles['common-m2'];
const receipt=JSON.parse(fs.readFileSync(path.join(root,profile.receipt)));
(async()=>{
 const server=await require('./serve-docs.cjs')(),browser=await chromium.launch({headless:true,executablePath:process.env.FLAN36_BROWSER,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
 const report={physical_acceptance:false};
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(60000);
  const ready=async(p=page)=>{await p.waitForFunction(()=>window.flan36,null,{timeout:180000});await p.evaluate(()=>window.flan36.idle());};
  const snap=(p=page)=>p.evaluate(()=>window.flan36.snapshot());
  const shown=(id,p=page)=>p.waitForFunction(id=>window.flan36.snapshot().fasteners.shown===id,id,{timeout:120000});
  const open=()=>page.click('#nav-files');
  const rows=()=>page.locator('#build-shopping [data-part]').evaluateAll(es=>Object.fromEntries(es.map(e=>[e.dataset.part,Number(e.dataset.required)])));
  const save=async(selector,timeout=240000)=>{const event=page.waitForEvent('download',{timeout});await page.click(selector);const d=await event,file=path.join(out,d.suggestedFilename());await d.saveAs(file);return file;};
  const load=async(config,name='design.json')=>page.locator('#load-config').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(config))});
  const expected=(config,side,group)=>group==='plate'?`${side}-case-${config.cases[side].style}-plate.stl`:`${side}-frame-${config.frames[side].style}.stl`;

  console.log('Reference screws by default');
  await page.goto(server.base+'explore/?diagnostics');await ready();await open();
  let s=await snap();const original=s.configuration;
  assert.equal('fasteners' in original,false,'designs without the key stay on the reference screws');assert.equal(s.fasteners.shown,'low-head');
  for(const [key,source] of Object.entries(s.fasteners.meshes))assert.match(source,/^mechanical\/revI\/[^/]+\.stl$/,key);
  let list=await rows();assert.equal(list.m6,6);assert.equal(list.m4,4);assert.equal('m6-common' in list,false);
  assert.equal(await page.locator('#fastener-options [aria-pressed=true]').getAttribute('data-value'),'low-head');
  assert.match(await page.locator('#fasteners-note').textContent(),/SLH-M2-6/);

  console.log('Choosing common M2 screws');
  await page.click('#fastener-options [data-value=common-m2]');await shown('common-m2');await ready();
  s=await snap();assert.equal(s.configuration.fasteners,'common-m2');assert.deepEqual({...s.configuration,fasteners:undefined},{...original,fasteners:undefined},'only the screws change');
  for(const side of ['left','right'])for(const [group,key] of [['plate',side+'-plate'],['lid',side+'-lid']])
   assert.equal(s.fasteners.meshes[key],profile.meshes+'/'+expected(s.configuration,side,group),'view shows the profile mesh: '+key);
  list=await rows();assert.equal(list['m6-common'],6);assert.equal(list['m4-common'],4);assert.equal('m6' in list,false);assert.equal('m4' in list,false);
  assert.match(await page.locator('[data-part="m6-common"] a').getAttribute('href'),/boltdepot\.com.*product=6363/);
  assert.match(await page.locator('[data-part="m4-common"] a').getAttribute('href'),/boltdepot\.com.*product=6358/);
  assert.match(await page.locator('#fasteners-note').textContent(),/Ø4 × 2 mm/);
  assert.match(await page.locator('#build-final').textContent(),/common M2 machine screws.*1\.5 mm hex key/);
  assert.match(await page.locator('#build-selection').textContent(),/Screws: Common M2/);
  await page.locator('#build-buy').evaluate(n=>n.scrollIntoView({block:'start'}));await page.screenshot({path:path.join(out,'common-m2-desktop.png')});

  console.log('Link and saved design');
  await page.waitForFunction(()=>document.querySelector('#share-link').value.includes('design='));
  const link=await page.locator('#share-link').inputValue();
  const other=await browser.newContext({viewport:{width:1280,height:900}}),visitor=await other.newPage();visitor.on('pageerror',e=>errors.push('link: '+e.message));
  await visitor.goto(link+'&diagnostics');await ready(visitor);await shown('common-m2',visitor);
  assert.deepEqual((await snap(visitor)).configuration,s.configuration,'the link reopens the same design');await other.close();
  await page.reload();await ready();await shown('common-m2');assert.equal((await snap()).configuration.fasteners,'common-m2','the choice is saved on this device');await open();

  console.log('Print kit');
  const kitZip=await save('#print-kit');assert.equal(path.basename(kitZip),'Flan36-common-m2-both-complete.zip');
  const kit=JSON.parse(unzip(kitZip,'manifest.json'));
  assert.equal(kit.configuration.fasteners,'common-m2');assert.match(kit.joining.case,/^Common-M2 variant/);assert.equal(kit.joining.profile.schema,'flan-common-fasteners-1');
  assert.match(unzip(kitZip,'READ-ME.txt').toString(),/Common-M2 variant: 3 M2x6 \+ 2 M2x4/);
  let swapped=0,kept=0;
  for(const part of kit.parts){
   const changes=/-case-[a-z]+-plate$|-frame-/.test(part.id),bytes=unzip(kitZip,`STL/${part.id}.stl`);
   assert.equal(part.source.startsWith(profile.meshes+'/'),changes,part.id+' source '+part.source);
   assert.equal(sha(bytes),part.source_sha256,part.id);assert.equal(sha(fs.readFileSync(path.join(root,part.source))),part.source_sha256,'repository file: '+part.source);
   if(changes){assert.equal(receipt.files[part.source],part.source_sha256,'bound to the delivery receipt: '+part.source);swapped++;}else kept++;
   for(const m of part.material_parts){
    if(m.source===part.source)continue;
    const material=unzip(kitZip,`Materials/${part.id}/${m.role}.stl`);assert.equal(sha(material),m.source_sha256);assert.equal(sha(fs.readFileSync(path.join(root,m.source))),m.source_sha256,m.source);
    if(m.source.startsWith(profile.meshes+'/'))assert.equal(receipt.files[m.source],m.source_sha256);else assert(receipt.unchanged.includes(path.basename(m.source,'.stl')),'unchanged by the profile: '+m.source);
   }
  }
  assert.equal(swapped,4,'two plates and two frames come from the profile');assert.equal(kit.parts.length,swapped+kept);assert.equal(kit.keycaps.groups.reduce((n,g)=>n+g.count,0),36);
  report.print_kit={file:path.basename(kitZip),parts:kit.parts.length,profile_parts:swapped,keycaps:36};

  console.log('Complete build');
  const buildZip=await save('#download-build',400000);assert.equal(path.basename(buildZip),'Flan36-complete-build.zip');
  const manifest=JSON.parse(unzip(buildZip,'manifest.json'));assert.equal(manifest.fasteners,'common-m2');assert.equal(manifest.configuration.fasteners,'common-m2');
  assert.equal(JSON.parse(unzip(buildZip,'Configuration.json')).fasteners,'common-m2');
  for(const entry of manifest.files){const bytes=unzip(buildZip,entry.path);assert.equal(bytes.length,entry.bytes,entry.path);assert.equal(sha(bytes),entry.sha256,entry.path);}
  const csv=unzip(buildZip,'Shopping.csv').toString();assert.match(csv,/"Bolt Depot","6","6"/);assert.match(csv,/"Bolt Depot","4","4"/);assert.doesNotMatch(csv,/NBK|SLH-M2-6|SSH-M2-4/);
  const guide=unzip(buildZip,'Guide.html').toString();assert.match(guide,/common M2 machine screws/);assert.match(guide,/Screws: Common M2/);assert.match(guide,/deeper head pockets/);assert.match(guide,/product=6363/);assert.doesNotMatch(guide,/SLH-M2-6 low-head screws/);
  const inner=path.join(out,'build-Print-kit.zip');fs.writeFileSync(inner,unzip(buildZip,'Print-kit.zip'));
  const innerKit=JSON.parse(unzip(inner,'manifest.json'));assert.match(innerKit.joining.case,/^Common-M2 variant/);
  assert.deepEqual(innerKit.parts.map(p=>[p.id,p.source_sha256]),kit.parts.map(p=>[p.id,p.source_sha256]),'the build carries the same print files');
  report.complete_build={file:path.basename(buildZip),files:manifest.files.length};

  // The kit Codex checked natively for one design (ignored build output, when present) must match byte for byte.
  const privateKit=path.join(root,'build/common-fasteners/Print-kit.zip');
  if(fs.existsSync(privateKit)){
   console.log('Same files as the natively checked kit');
   const reference=JSON.parse(unzip(privateKit,'manifest.json')),design={...reference.configuration,fasteners:'common-m2'};
   await load(design,'native-kit-design.json');await page.waitForFunction(style=>window.flan36.snapshot().configuration.frames.left.style===style,design.frames.left.style);await shown('common-m2');await ready();
   const again=await save('#print-kit'),mine=JSON.parse(unzip(again,'manifest.json'));
   assert.deepEqual(mine.parts.map(p=>p.id),reference.parts.map(p=>p.id));
   for(const part of reference.parts){
    assert(unzip(again,`STL/${part.id}.stl`).equals(unzip(privateKit,`STL/${part.id}.stl`)),'identical STL: '+part.id);
    for(const m of part.material_parts)if(m.source!==part.source)assert(unzip(again,`Materials/${part.id}/${m.role}.stl`).equals(unzip(privateKit,`Materials/${part.id}/${m.role}.stl`)),'identical material: '+part.id+' '+m.role);
   }
   report.native_kit_parity={parts:reference.parts.length,design:'rim + '+design.frames.left.style};
  }

  console.log('Earlier designs and other sizes');
  await load(original,'earlier-design.json');await shown('low-head');await ready();
  s=await snap();assert.equal('fasteners' in s.configuration,false);for(const source of Object.values(s.fasteners.meshes))assert.doesNotMatch(source,/common-m2/);
  list=await rows();assert.equal(list.m6,6);assert.equal('m6-common' in list,false);
  await page.click('#fastener-options [data-value=common-m2]');await shown('common-m2');
  await page.click('#nav-customize');await page.click('[data-panel="size"]');await page.click('#size-grid [data-variant="flan42"]');
  await page.waitForFunction(()=>window.flan36.snapshot().configuration.variant==='flan42');await ready();
  s=await snap();assert.equal('fasteners' in s.configuration,false,'a size without the profile returns to the reference screws');
  assert.match(await page.locator('#size-note').textContent(),/low-head reference/);
  await open();assert.equal(await page.locator('#fastener-options [data-value=common-m2]').isDisabled(),true);assert.match(await page.locator('#fasteners-note').textContent(),/only available for Flan36/);
  list=await rows();assert.equal(list.m6,8);
  await load({...s.configuration,fasteners:'common-m2'},'unsupported.json');
  await page.waitForFunction(()=>document.querySelector('#config-status').dataset.error==='true');assert.match(await page.locator('#config-status').textContent(),/only available for Flan36/);
  assert.equal('fasteners' in (await snap()).configuration,false);
  await load({...original,fasteners:'hex'},'unknown.json');await page.waitForFunction(()=>/Unknown screw option/.test(document.querySelector('#config-status').textContent));

  console.log('Spanish and a phone');
  await load({...original,fasteners:'common-m2'},'common.json');await shown('common-m2');await ready();
  await page.click('[data-lang="es"]');await page.setViewportSize({width:390,height:844});await open();
  assert.match(await page.locator('#fasteners-note').textContent(),/Tornillos de máquina M2 ordinarios/);assert.equal(await page.locator('#fastener-options [aria-pressed=true]').textContent(),'M2 comunes');
  assert.match(await page.locator('#build-final').textContent(),/tornillos de máquina M2 comunes/);
  await page.locator('#build-buy').evaluate(n=>n.scrollIntoView({block:'start'}));await page.screenshot({path:path.join(out,'common-m2-phone-es.png')});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no horizontal overflow');
  assert.deepEqual(await page.locator('#panel-files').evaluate(node=>[...node.querySelectorAll('*')].filter(e=>e.getClientRects().length&&!e.closest('.build-jumps')&&e.getBoundingClientRect().right>innerWidth+1).map(e=>e.id||e.className)),[]);
  await page.click('[data-lang="en"]');

  console.log('Offline copy');
  const offline=await browser.newContext({viewport:{width:1280,height:900}}),copyPage=await offline.newPage();copyPage.on('pageerror',e=>errors.push('offline: '+e.message));
  let fetched=0;copyPage.on('request',r=>{if(/fasteners-.*\.bin/.test(r.url()))fetched++;});
  await copyPage.goto(server.base+'explore/offline.html?diagnostics',{timeout:300000});await ready(copyPage);
  await copyPage.click('#nav-files');await copyPage.click('#fastener-options [data-value=common-m2]');await shown('common-m2',copyPage);
  assert.equal(fetched,0,'the offline copy carries the profile');assert.match(Object.values((await snap(copyPage)).fasteners.meshes)[0],/common-m2/);await offline.close();

  assert.deepEqual(errors,[]);
  Object.assign(report,{passed:true,selection_link_storage:true,view_meshes:true,shopping_and_guide:true,earlier_designs_unchanged:true,other_sizes_fall_back:true,spanish_and_phone:true,offline_copy:true});
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(report);
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
