// The optional common-M2 screw profile: selection, link, view, shopping list, guide and downloads all agree,
// a failed download says so and can be retried, and designs saved before the option still open on the reference screws.
// FLAN36_PLAYWRIGHT_MODULE=/path/to/playwright node viewer/fasteners-check.cjs
// SPDX-License-Identifier: GPL-3.0-or-later
const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'build/fasteners-check');fs.mkdirSync(out,{recursive:true});
const unzip=(zip,file)=>cp.execFileSync('unzip',['-p',zip,file],{maxBuffer:200e6});
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const read=file=>fs.readFileSync(path.join(root,file));
const profile=JSON.parse(read('design/fastener-profiles.json')).profiles['common-m2'];
const receipt=JSON.parse(read(profile.receipt)),model=JSON.parse(read('design/revI.json'));
// The receipt is only as current as the default CAD it was exported from.
assert.equal(sha(read('mechanical/revI/Flan36.FCStd')),receipt.native.source_sha256,'default CAD changed after the profile was exported: install and adopt it again');
for(const [file,digest] of Object.entries(receipt.files))assert.equal(sha(read(file)),digest,file);
for(const [stem,digest] of Object.entries(receipt.unchanged))assert.equal(sha(read('mechanical/revI/'+stem+'.stl')),digest,stem);
const stlTriangles=file=>read(file).readUInt32LE(80);
// The narrowest recorded gap beside a long screw's head for a design's cases; Infinity when no wall is near.
const tightGap=config=>Math.min(Infinity,...['left','right'].flatMap(side=>Object.values(receipt.long_heads.gap_mm[config.cases[side].style])).filter(g=>g!==null));
const tightNote=gap=>new RegExp('leaves only '+gap.toFixed(2).replace('.','\\.')+' mm around a Ø4 mm head');
const inProfile=file=>{const candidate=profile.meshes+'/'+path.basename(file);return receipt.files[candidate]?candidate:file;};
// What the model must be built from: the plate's STL, or the frame's material volumes, each from the profile when it changes them.
function expectedMesh(config,side,group,common){
 if(group==='plate'){const file=`mechanical/revI/${side}-case-${config.cases[side].style}-plate.stl`,source=common?inProfile(file):file;return {source,triangles:stlTriangles(source)};}
 const style=config.frames[side].style,file=`mechanical/revI/${side}-frame-${style}.stl`,parts=model.frameVariants[`${side}-${style}`].material_parts.map(p=>'mechanical/revI/'+p.stl);
 return {source:common?inProfile(file):file,triangles:parts.reduce((n,p)=>n+stlTriangles(common?inProfile(p):p),0)};
}
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
  const meshes=async(common,p=page)=>{const s=await snap(p);for(const side of ['left','right'])for(const [group,key] of [['plate',side+'-plate'],['lid',side+'-lid']])assert.deepEqual(s.fasteners.meshes[key],expectedMesh(s.configuration,side,group,common),'the model is built from the right files: '+key);return s;};
  const note=()=>page.locator('#fasteners-note').textContent();

  console.log('Reference screws by default');
  await page.goto(server.base+'explore/?diagnostics');await ready();await open();
  let s=await meshes(false);const original=s.configuration;
  assert.equal('fasteners' in original,false,'designs without the key stay on the reference screws');assert.equal(s.fasteners.shown,'low-head');
  let list=await rows();assert.equal(list.m6,6);assert.equal(list.m4,4);assert.equal('m6-common' in list,false);
  assert.equal(await page.locator('#fastener-options [aria-pressed=true]').getAttribute('data-value'),'low-head');
  assert.match(await note(),/SLH-M2-6/);

  console.log('A failed download says so and can be retried');
  await page.route('**/fasteners-*.bin',r=>r.abort());
  await page.click('#fastener-options [data-value=common-m2]');
  await page.waitForFunction(()=>document.querySelector('#fasteners-note').dataset.error==='true');
  assert.match(await note(),/could not be loaded.*Choose Common M2 again to retry/);
  s=await meshes(false);assert.equal(s.configuration.fasteners,'common-m2');assert.equal(s.fasteners.shown,'low-head');assert.equal(s.fasteners.failed,'common-m2');
  assert.equal(await page.locator('#glb').isDisabled(),true,'no GLB of the wrong plates');
  await page.click('#print-kit');await page.waitForFunction(()=>/could not be loaded/.test(document.querySelector('#print-status').textContent));
  await page.unroute('**/fasteners-*.bin');const undoable=(await snap()).undo;
  await page.click('#fastener-options [data-value=common-m2]');await shown('common-m2');await ready();
  assert.equal((await snap()).fasteners.failed,null);assert.equal(await page.locator('#fasteners-note').getAttribute('data-error'),'false');assert.equal((await snap()).undo,undoable,'a retry adds no undo step');

  console.log('Common M2 screws: view, list and guide');
  s=await meshes(true);assert.equal(s.configuration.fasteners,'common-m2');assert.deepEqual({...s.configuration,fasteners:undefined},{...original,fasteners:undefined},'only the screws change');
  for(const mesh of Object.values(s.fasteners.meshes))assert(mesh.source.startsWith(profile.meshes+'/'),mesh.source);
  list=await rows();assert.equal(list['m6-common'],6);assert.equal(list['m4-common'],4);assert.equal('m6' in list,false);assert.equal('m4' in list,false);
  assert.match(await page.locator('[data-part="m6-common"] a').getAttribute('href'),/boltdepot\.com.*product=6363/);
  assert.match(await page.locator('[data-part="m4-common"] a').getAttribute('href'),/boltdepot\.com.*product=6358/);
  assert.match(await note(),/Ø4 × 2 mm/);
  if(tightGap(s.configuration)<.3)assert.match(await note(),tightNote(tightGap(s.configuration)));else assert.doesNotMatch(await note(),/wall beside one long screw/);
  assert.match(await page.locator('#build-final').textContent(),/common M2 machine screws.*1\.5 mm hex key/);
  assert.match(await page.locator('#build-selection').textContent(),/Screws: Common M2/);
  await page.locator('#build-buy').evaluate(n=>n.scrollIntoView({block:'start'}));await page.screenshot({path:path.join(out,'common-m2-desktop.png')});

  console.log('Undo, redo and quick changes');
  await page.click('#undo');await shown('low-head');s=await meshes(false);assert.equal('fasteners' in s.configuration,false);
  await page.click('#redo');await shown('common-m2');await meshes(true);
  for(const id of ['low-head','common-m2','low-head','common-m2'])await page.click(`#fastener-options [data-value=${id}]`);
  await shown('common-m2');await ready();await meshes(true);

  console.log('Link and saved design');
  await page.waitForFunction(()=>document.querySelector('#share-link').value.includes('design='));
  const link=await page.locator('#share-link').inputValue();s=await snap();
  const other=await browser.newContext({viewport:{width:1280,height:900}}),visitor=await other.newPage();visitor.on('pageerror',e=>errors.push('link: '+e.message));
  await visitor.goto(link+'&diagnostics');await ready(visitor);await shown('common-m2',visitor);
  assert.deepEqual((await meshes(true,visitor)).configuration,s.configuration,'the link reopens the same design');await other.close();
  await page.reload();await ready();await shown('common-m2');assert.equal((await meshes(true)).configuration.fasteners,'common-m2','the choice is saved on this device');await open();

  console.log('Print kit');
  const kitZip=await save('#print-kit');assert.equal(path.basename(kitZip),'Flan36-common-m2-both-complete.zip');
  const kit=JSON.parse(unzip(kitZip,'manifest.json'));
  assert.equal(kit.configuration.fasteners,'common-m2');assert.match(kit.joining.case,/^Common-M2 variant/);assert.equal(kit.joining.profile.schema,'flan-common-fasteners-1');
  assert.match(unzip(kitZip,'READ-ME.txt').toString(),/Common-M2 variant: 3 M2x6 \+ 2 M2x4/);
  let swapped=0,kept=0;
  for(const part of kit.parts){
   const changes=/-case-[a-z]+-plate$|-frame-/.test(part.id),bytes=unzip(kitZip,`STL/${part.id}.stl`);
   assert.equal(part.source.startsWith(profile.meshes+'/'),changes,part.id+' source '+part.source);
   assert.equal(sha(bytes),part.source_sha256,part.id);assert.equal(sha(read(part.source)),part.source_sha256,'repository file: '+part.source);
   if(changes){assert.equal(receipt.files[part.source],part.source_sha256,'bound to the delivery receipt: '+part.source);swapped++;}else kept++;
   for(const m of part.material_parts){
    if(m.source===part.source)continue;
    const material=unzip(kitZip,`Materials/${part.id}/${m.role}.stl`);assert.equal(sha(material),m.source_sha256);assert.equal(sha(read(m.source)),m.source_sha256,m.source);
    if(m.source.startsWith(profile.meshes+'/'))assert.equal(receipt.files[m.source],m.source_sha256);else assert.equal(receipt.unchanged[path.basename(m.source,'.stl')],m.source_sha256,'unchanged by the profile: '+m.source);
   }
  }
  assert.equal(swapped,4,'two plates and two frames come from the profile');assert.equal(kit.parts.length,swapped+kept);assert.equal(kit.keycaps.groups.reduce((n,g)=>n+g.count,0),36);
  report.print_kit={file:path.basename(kitZip),parts:kit.parts.length,profile_parts:swapped,keycaps:36};

  console.log('Complete build and GLB');
  const buildZip=await save('#download-build',400000);assert.equal(path.basename(buildZip),'Flan36-common-m2-complete-build.zip');
  const manifest=JSON.parse(unzip(buildZip,'manifest.json'));assert.equal(manifest.fasteners,'common-m2');assert.equal(manifest.configuration.fasteners,'common-m2');
  assert.equal(JSON.parse(unzip(buildZip,'Configuration.json')).fasteners,'common-m2');
  for(const entry of manifest.files){const bytes=unzip(buildZip,entry.path);assert.equal(bytes.length,entry.bytes,entry.path);assert.equal(sha(bytes),entry.sha256,entry.path);}
  const csv=unzip(buildZip,'Shopping.csv').toString();assert.match(csv,/"Bolt Depot","6","6"/);assert.match(csv,/"Bolt Depot","4","4"/);assert.doesNotMatch(csv,/NBK|SLH-M2-6|SSH-M2-4/);
  const guide=unzip(buildZip,'Guide.html').toString();assert.match(guide,/common M2 machine screws/);assert.match(guide,/Screws: Common M2/);assert.match(guide,/deeper head pockets/);assert.match(guide,/product=6363/);assert.doesNotMatch(guide,/SLH-M2-6 low-head screws/);
  const inner=path.join(out,'build-Print-kit.zip');fs.writeFileSync(inner,unzip(buildZip,'Print-kit.zip'));
  const innerKit=JSON.parse(unzip(inner,'manifest.json'));assert.match(innerKit.joining.case,/^Common-M2 variant/);
  assert.deepEqual(innerKit.parts.map(p=>[p.id,p.source_sha256]),kit.parts.map(p=>[p.id,p.source_sha256]),'the build carries the same print files');
  const glb=fs.readFileSync(await save('#glb'));assert.equal(glb.subarray(0,4).toString(),'glTF');
  const scene=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());
  assert.equal(scene.nodes.filter(n=>n.extras?.mesh_source?.startsWith(profile.meshes+'/')).length,4,'the GLB carries the profile plates and frames');
  report.complete_build={file:path.basename(buildZip),files:manifest.files.length};report.glb={bytes:glb.length};

  // A kit checked natively against the CAD for one design (ignored build output, when present) must match byte for byte.
  const nativeKit=path.join(root,'build/common-fasteners/Print-kit.zip');
  if(fs.existsSync(nativeKit)){
   console.log('Same files as the natively checked kit');
   const reference=JSON.parse(unzip(nativeKit,'manifest.json')),design={...reference.configuration,fasteners:'common-m2'};
   await load(design,'native-kit-design.json');await page.waitForFunction(style=>window.flan36.snapshot().configuration.frames.left.style===style,design.frames.left.style);await shown('common-m2');await ready();
   const again=await save('#print-kit'),mine=JSON.parse(unzip(again,'manifest.json'));
   assert.deepEqual(mine.parts.map(p=>p.id),reference.parts.map(p=>p.id));
   for(const part of reference.parts){
    assert(unzip(again,`STL/${part.id}.stl`).equals(unzip(nativeKit,`STL/${part.id}.stl`)),'identical STL: '+part.id);
    for(const m of part.material_parts)if(m.source!==part.source)assert(unzip(again,`Materials/${part.id}/${m.role}.stl`).equals(unzip(nativeKit,`Materials/${part.id}/${m.role}.stl`)),'identical material: '+part.id+' '+m.role);
   }
   report.native_kit_parity={parts:reference.parts.length,design:design.cases.left.style+' + '+design.frames.left.style};
  }

  console.log('A case with a wall beside a long screw says so');
  const styled=style=>{const c=structuredClone(original);c.fasteners='common-m2';for(const side of ['left','right']){c.cases[side].style=style;c.cases[side].match_frame=false;}return c;};
  for(const style of ['level','rim']){
   await load(styled(style),style+'.json');await page.waitForFunction(style=>window.flan36.snapshot().configuration.cases.left.style===style,style);await shown('common-m2');await ready();await meshes(true);
   const gap=tightGap(styled(style));
   if(style==='level'){assert(gap>0&&gap<.3,'the receipt records a narrow gap for Level');assert.match(await note(),tightNote(gap));}
   else{assert.equal(gap,Infinity);assert.doesNotMatch(await note(),/wall beside one long screw/);}
  }

  console.log('Earlier designs and other sizes');
  await load(original,'earlier-design.json');await shown('low-head');await ready();
  s=await meshes(false);assert.equal('fasteners' in s.configuration,false);
  list=await rows();assert.equal(list.m6,6);assert.equal('m6-common' in list,false);
  await page.click('#fastener-options [data-value=common-m2]');await shown('common-m2');
  await page.click('#nav-customize');await page.click('[data-panel="size"]');await page.click('#size-grid [data-variant="flan42"]');
  await page.waitForFunction(()=>window.flan36.snapshot().configuration.variant==='flan42');await ready();
  s=await snap();assert.equal('fasteners' in s.configuration,false,'a size without the profile returns to the reference screws');
  assert.match(await page.locator('#size-note').textContent(),/low-head reference/);
  await open();assert.equal(await page.locator('#fastener-options [data-value=common-m2]').isDisabled(),true);assert.match(await note(),/only available for Flan36/);
  list=await rows();assert.equal(list.m6,8);
  await load({...s.configuration,fasteners:'common-m2'},'unsupported.json');
  await page.waitForFunction(()=>document.querySelector('#config-status').dataset.error==='true');assert.match(await page.locator('#config-status').textContent(),/only available for Flan36/);
  assert.equal('fasteners' in (await snap()).configuration,false);
  await load({...original,fasteners:'hex'},'unknown.json');await page.waitForFunction(()=>/Unknown screw option/.test(document.querySelector('#config-status').textContent));

  console.log('Spanish and a phone');
  await load({...original,fasteners:'common-m2'},'common.json');await shown('common-m2');await ready();
  await page.click('[data-lang="es"]');await page.setViewportSize({width:390,height:844});await open();
  assert.match(await note(),/Tornillos de máquina M2 ordinarios/);assert.equal(await page.locator('#fastener-options [aria-pressed=true]').textContent(),'M2 comunes');
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
  assert.equal(fetched,0,'the offline copy carries the profile');await meshes(true,copyPage);await offline.close();

  assert.deepEqual(errors,[]);
  Object.assign(report,{passed:true,failed_download_visible_and_retried:true,selection_link_storage:true,view_meshes_from_profile_files:true,undo_redo_and_quick_changes:true,shopping_and_guide:true,narrow_long_screw_gap_announced:true,earlier_designs_unchanged:true,other_sizes_fall_back:true,spanish_and_phone:true,offline_copy:true});
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(report);
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
