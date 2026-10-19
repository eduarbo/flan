// Functional acceptance: offline loading, layers, camera, full reset, GLB and narrow viewport.
// SPDX-License-Identifier: GPL-3.0-or-later
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const crypto=require('node:crypto');
const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
fs.mkdirSync(path.join(root,'build/case-variants'),{recursive:true});
const hash=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
const html=fs.readFileSync(path.join(root,'docs/explore/offline.html'),'utf8');
const scene=JSON.parse(require('node:zlib').gunzipSync(Buffer.from(html.match(/<script id="scene-data" type="application\/octet-stream">([\s\S]*?)<\/script>/)[1],'base64')));
for(const [alias,id] of Object.entries(scene.geometryAliases||{}))scene.geometries[alias]=scene.geometries[id];
const frameStyles=['talavera','gameboy','snes','phone','ipod','hanafuda'];
assert.deepEqual(Object.keys(scene.catalog.frame_styles),frameStyles);
const palettes=JSON.parse(fs.readFileSync(path.join(root,'design/frame-finishes.json')));
const expectedCount=scene.parts.filter(p=>!p.variants).length;   // a family variant's added keys and fasteners start hidden on Flan36
const coverCount=side=>scene.parts.filter(p=>!p.variants&&p.side===side&&p.group==='lid').length;
for(const side of ['left','right'])assert.equal(scene.parts.filter(p=>p.part_id===`${side}-display-socket`&&p.group==='connectors').length,1,'Retained J2 socket must be explicit');
const target=process.env.FLAN36_VIEWER_URL||pathToFileURL(path.join(root,'docs/explore/offline.html')).href;
const offline=target.startsWith('file:');
// WebGL-only captures: floating stage controls and the drawer keep their layout and hover/focus, but not their pixels.
// The page's themed gradient becomes one flat colour, and the contact shadow is off (ground(false) after load).
const bare='.stage > :not(canvas),#workspace{opacity:0!important}body{background:#eef0f3!important}';
const withDiagnostics=url=>url+(url.includes('?')?'&':'?')+'diagnostics';

// Touch pages tap; desktop pages click.
const press=(page,selector)=>page.touch?page.locator(selector).tap():page.click(selector);
const settle=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,60)))));
// Selecting the already-open destination closes the editor; open each panel only when needed.
async function panel(page,mode){if(await page.locator('body').getAttribute('data-panel-open')!=='true'||await page.locator('body').getAttribute('data-mode')!==mode||await page.locator('body').getAttribute('data-detail')==='true')await press(page,'#nav-'+mode);await settle(page);}
// A Design section, with its Fine-tune open so every control in it is reachable.
async function category(page,name){await panel(page,'customize');await press(page,`#editor-tabs [data-panel="${name}"]`);assert.equal(await page.locator('#panel-'+name).isVisible(),true);const tune=page.locator(`#panel-${name} .tune[aria-expanded=false]`);if(await tune.count()&&await tune.isVisible())await press(page,`#panel-${name} .tune`);}
async function close(page){if(await page.locator('#workspace').isVisible())await press(page,'#panel-close');await settle(page);}
async function recovery(page){await panel(page,'files');if(await page.locator('#recovery').getAttribute('open')===null)await press(page,'#recovery summary');}
// Installed display frames live in Parts → Frame; eyes, Solo and Show all never change them.
async function installFrames(page,sides){await panel(page,'inspect');await press(page,'#part-lid');for(const [side,on] of Object.entries(sides))await page.locator('#install-frame-'+side).setChecked(on);await press(page,'#panel-back');}
// Show all restores visibility and assembly; Reset restores the camera. Together they are the full reset.
async function restoreAll(page){await panel(page,'inspect');await press(page,'#show-all');await close(page);await press(page,'#reset');await settle(page);}
const canvasHash=async page=>{await settle(page);return hash(await page.locator('#canvas').screenshot({style:bare}));};

async function checkDirectory(page){
  await panel(page,'inspect');
  assert.equal(await page.locator('.callout,#callouts,#part-link').count(),0,'No floating tags');
  // Every component row scrolls fully into view, unclipped and on top.
  const rows=page.locator('.part-item');assert.equal(await rows.count(),12);
  const entries=[];
  for(const row of await rows.all()){
    await row.scrollIntoViewIfNeeded();
    entries.push(await row.evaluate(e=>{
      const r=e.getBoundingClientRect(),name=e.querySelector('.part-name'),text=name?.getBoundingClientRect();
      const at=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
      return{id:e.id,visible:r.width>0&&r.height>0&&r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1&&!!at&&(e===at||e.contains(at)),textFits:!text||text.width>0&&name.scrollWidth<=name.clientWidth+1};
    }));
  }
  assert.ok(entries.every(e=>e.visible&&e.textFits),'All 12 component rows must be unclipped: '+JSON.stringify(entries.filter(e=>!e.visible||!e.textFits)));
  // Seven camera views, Fit and Separate layers float over the model and stay reachable; a narrow scene folds the views into one menu.
  if(await page.locator('#view-menu').isVisible()&&await page.locator('#camera-views').getAttribute('data-open')===null)await press(page,'#view-menu');
  const controls=await page.locator('.camera-widget [data-view],#fit,#explode').evaluateAll(nodes=>nodes.map(e=>{
    const r=e.getBoundingClientRect(),at=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    return {id:e.id||e.dataset.view,visible:r.width>0&&r.height>=25&&r.x>=0&&r.right<=innerWidth+1&&r.y>=0&&r.bottom<=innerHeight&&!!at&&(at===e||e.contains(at))};
  }));
  assert.equal(controls.length,9);assert.ok(controls.every(c=>c.visible),'Persistent view controls: '+JSON.stringify(controls));
  if(await page.locator('#camera-views').getAttribute('data-open')!==null)await press(page,'#view-menu');
  const height=await page.evaluate(()=>document.querySelector('#canvas').getBoundingClientRect().height);
  assert.ok(height>=120,'The drawer must leave a model region: '+height);
}
async function checkFramedPixels(page){
  const png=(await page.locator('#canvas').screenshot({style:bare})).toString('base64');
  const bounds=await page.evaluate(async png=>{
    const image=new Image();image.src='data:image/png;base64,'+png;await image.decode();
    const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);
    const {data}=ctx.getImageData(0,0,c.width,c.height),bg=[...data.slice(0,3)];let x0=c.width,y0=c.height,x1=0,y1=0;
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4;if(bg.reduce((s,v,j)=>s+Math.abs(v-data[i+j]),0)>35){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}}
    // Fit reserves the strip above the camera chip and the layers slider on the right (CSS pixels, scaled to the capture).
    const r=document.querySelector('#canvas').getBoundingClientRect(),scale=c.width/r.width,cam=document.querySelector('.camera-widget'),tools=document.querySelector('.stage-tools');
    const free={bottom:(cam.getClientRects().length?cam.getBoundingClientRect().top-r.top-12:r.height-8)*scale,right:(tools.getClientRects().length?tools.getBoundingClientRect().left-r.left-8:r.width-8)*scale};
    return{x0,y0,x1,y1,w:c.width,h:c.height,free,scale};
  },png);
  assert.ok(bounds.x1>bounds.x0&&bounds.y1>bounds.y0&&bounds.x0>5&&bounds.y0>5&&bounds.x1<bounds.w-6&&bounds.y1<bounds.h-6,'Fit view must contain the actually rendered assembly: '+JSON.stringify(bounds));
  assert.ok(bounds.y1<=bounds.free.bottom+3*bounds.scale&&bounds.x1<=bounds.free.right+3*bounds.scale,'View controls must not cover the fitted model: '+JSON.stringify(bounds));
}
// Direct canvas picking: hover the Frame row, and its x-ray marks the frame pixels to tap.
async function framePixel(page){
  await panel(page,'inspect');await page.click('[data-view=top]');await page.mouse.move(2,2);
  const plain=(await page.locator('#canvas').screenshot({style:bare})).toString('base64');
  await page.locator('.part-row[data-group=lid] .part-item').hover();await settle(page);
  const lit=(await page.locator('#canvas').screenshot({style:bare})).toString('base64');
  await page.mouse.move(2,2);await settle(page);
  const pixel=await page.evaluate(async([a,b])=>{
    const read=async png=>{const i=new Image();i.src='data:image/png;base64,'+png;await i.decode();const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const x=c.getContext('2d');x.drawImage(i,0,0);return x.getImageData(0,0,c.width,c.height);};
    const p=await read(a),q=await read(b),w=p.width,h=p.height,lit=(x,y)=>{const i=(y*w+x)*4;return Math.abs(p.data[i]-q.data[i])+Math.abs(p.data[i+1]-q.data[i+1])+Math.abs(p.data[i+2]-q.data[i+2])>60;};
    // A pixel deep inside the lit left frame body, not on its edge or the display window.
    for(let y=4;y<h-4;y++)for(let x=4;x<w/2;x++){let all=true;for(let dy=-4;dy<=4&&all;dy++)for(let dx=-4;dx<=4&&all;dx++)all=lit(x+dx,y+dy);if(all)return {x,y};}
    return null;
  },[plain,lit]);
  assert.ok(pixel,'Hovering the Frame row must light the frame through the x-ray');
  const box=await page.locator('#canvas').boundingBox();return {x:box.x+pixel.x,y:box.y+pixel.y};
}

(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.FLAN36_BROWSER?{executablePath:process.env.FLAN36_BROWSER}:{})});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:960},acceptDownloads:true});
  const requests=[],errors=[];
  if(offline)await context.route(/^https?:/,route=>{requests.push(route.request().url());return route.abort();});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(withDiagnostics(target));
  if(!offline){
    // Hash the actual loaded scene in the browser. Large document responses can
    // be evicted from Chromium's inspector cache; DOM data remains available.
    const delivered=await page.evaluate(async()=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(document.querySelector('#scene-data').textContent)))).map(n=>n.toString(16).padStart(2,'0')).join(''));
    const embedded=html.match(/<script id="scene-data" type="application\/octet-stream">([\s\S]*?)<\/script>/)[1];
    assert.equal(delivered,hash(Buffer.from(embedded)),'Public browser must load the exact current CAD scene');
  }
  await page.waitForFunction(n=>document.querySelector('#status').textContent.includes(`${n} visible components`),expectedCount,{timeout:60000});await page.evaluate(()=>window.flan36.ground(false));
  for(const [key,value] of Object.entries(scene.measurements))if(['bay_width_mm','cover_top_mm','plate_top_mm'].includes(key))assert.equal(await page.locator(`[data-measurement=${key}]`).textContent(),String(value));
  await checkFramedPixels(page);
  await checkDirectory(page);
  // Case choices change native meshes; absent covers differ from eye visibility.
  assert.equal(await page.locator('#case-grid button').count(),4);
  assert.equal(new Set(await page.locator('#case-grid img').evaluateAll(nodes=>nodes.map(n=>n.src))).size,4);
  for(const style of ['level','solid','rim','terrace']){
    await category(page,'cases');await page.locator(`[data-case=${style}]`).focus();await page.keyboard.press('Enter');
    assert.equal(await page.locator(`[data-case=${style}]`).getAttribute('aria-pressed'),'true');
    await page.mouse.move(10,20);await page.keyboard.press('Escape');await settle(page);assert.equal(await page.locator('#workspace').isVisible(),false,'Escape closes the editor');
    await page.locator('#canvas').screenshot({path:path.join(root,`build/case-variants/${style}.png`),style:bare});
  }
  await category(page,'cases');await page.click('#case-target [data-side=left]');await page.click('[data-case=rim]');await installFrames(page,{left:false});
  await page.click('#reset');assert.match(await page.locator('#status').textContent(),new RegExp(`${expectedCount-coverCount('left')} visible`),'Open cover omits its three frame magnets and cover, preserves display');
  await category(page,'cases');await page.click('#case-target [data-side=both]');assert.equal(await page.locator('#case-current').textContent(),'Mixed cases');
  // Mixed installation stays explicit per half.
  await panel(page,'inspect');await page.click('#part-lid');
  assert.deepEqual([await page.locator('#install-frame-left').isChecked(),await page.locator('#install-frame-right').isChecked()],[false,true]);await page.click('#panel-back');
  await panel(page,'files');
  let savedPromise=page.waitForEvent('download');await page.click('#save-config');let saved=await savedPromise;
  const casesPath=path.join(root,'build/case-variants/selected.json');await saved.saveAs(casesPath);
  const caseConfig=JSON.parse(fs.readFileSync(casesPath));assert.deepEqual(Object.fromEntries(Object.entries(caseConfig.cases).map(([side,c])=>[side,{style:c.style,cover:c.cover}])),{left:{style:'rim',cover:false},right:{style:'terrace',cover:true}});
  const badCase=JSON.parse(JSON.stringify(caseConfig));badCase.cases.right.style='unknown';
  await page.locator('#load-config').setInputFiles({name:'bad-case.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(badCase))});
  await page.waitForFunction(()=>document.querySelector('#config-status').dataset.error==='true');
  savedPromise=page.waitForEvent('download');await page.click('#glb');saved=await savedPromise;
  const caseGlbPath=path.join(root,'build/case-variants/selected.glb');await saved.saveAs(caseGlbPath);const caseGlb=fs.readFileSync(caseGlbPath),caseJsonLength=caseGlb.readUInt32LE(12),caseGLTF=JSON.parse(caseGlb.toString('utf8',20,20+caseJsonLength));
  assert.equal(caseGLTF.nodes.filter(n=>n.mesh!==undefined).length,expectedCount-coverCount('left'));
  for(const side of ['left','right'])assert.equal(caseGLTF.nodes.filter(n=>n.extras?.part_id===`${side}-display-socket`&&n.extras?.group==='connectors').length,1,'Removing frame must retain J2');
  assert.equal(caseGLTF.nodes.filter(n=>n.extras?.group==='lid'&&n.extras?.side==='left').length,0);
  assert.equal(caseGLTF.nodes.filter(n=>n.extras?.group==='display').length,4);
  assert.deepEqual(caseGLTF.nodes.find(n=>n.name==='Flan36 revI · nominal').extras.configuration,caseConfig,'Invalid case must leave configuration untouched');
  for(const [side,style] of [['left','rim'],['right','terrace']])for(const group of ['base','plate']){
    const node=caseGLTF.nodes.find(n=>n.extras?.side===side&&n.extras?.group===group),primitive=caseGLTF.meshes[node.mesh].primitives[0],a=caseGLTF.accessors[primitive.attributes.POSITION],v=caseGLTF.bufferViews[a.bufferView];
    const at=20+caseJsonLength+8+(v.byteOffset||0)+(a.byteOffset||0);
    assert.equal(node.extras.case_style,style);
    assert.deepEqual(caseGlb.subarray(at,at+a.count*12),Buffer.from(scene.geometries[`mechanical/revI/${side}-case-${style}-${group}.stl`].positions,'base64'),'Case export must match selected native STL exactly');
  }
  const legacy=JSON.parse(JSON.stringify(scene.catalog.default_configuration));delete legacy.cases;
  await page.locator('#load-config').setInputFiles({name:'legacy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});
  assert.equal(await page.locator('#config-status').getAttribute('data-error'),'false');
  await page.click('#reset');assert.match(await page.locator('#status').textContent(),new RegExp(`${expectedCount} visible`));
  await category(page,'cases');await page.click('[data-case=rim]');await installFrames(page,{left:false,right:false});await close(page);await page.mouse.move(10,20);
  await page.click('[data-view=top]');await settle(page);
  await page.locator('#canvas').screenshot({path:path.join(root,'build/case-variants/rim-open-top.png'),style:bare});
  await recovery(page);await page.click('#default-config');await page.keyboard.press('Escape');await page.click('#reset');
  await panel(page,'inspect');
  const row=await page.locator('.part-row[data-group=plate]').boundingBox();
  await page.mouse.move(row.x+3,row.y+row.height/2);
  assert.equal(await page.locator('.part-row[data-group=plate]').evaluate(e=>e.matches(':hover')),true);
  await page.locator('#layer-plate').hover();
  assert.equal(await page.locator('.part-row[data-group=plate]').evaluate(e=>e.classList.contains('is-highlighted')),true);
  assert.equal(await page.locator('#layer-plate').isChecked(),true,'Hover never changes visibility');
  await page.mouse.move(10,20);await page.keyboard.press('Escape');
  await page.mouse.move(400,350);await page.mouse.wheel(0,-700);await page.waitForTimeout(150);
  await page.click('#fit');assert.match(await page.locator('#view-feedback').textContent(),/centered and fitted/);await settle(page);await checkFramedPixels(page);
  await panel(page,'inspect');for(const group of new Set(scene.parts.map(p=>p.group)))await page.locator('#layer-'+group).uncheck();
  await page.click('#fit');assert.match(await page.locator('#view-feedback').textContent(),/Nothing visible/);await page.click('#show-all');
  assert.match(await page.locator('#status').textContent(),new RegExp(`${expectedCount} visible`));
  await page.click('#part-base');
  assert.equal(await page.locator('[data-object-visibility]').count(),2);
  await page.locator('[data-object-visibility]').first().uncheck();
  assert.match(await page.locator('#status').textContent(),new RegExp(`${expectedCount-1} visible`));
  assert.equal(await page.locator('#layer-base').evaluate(e=>e.indeterminate),true);
  await page.locator('[data-object-visibility]').first().check();
  await page.locator('[data-solo-object]').first().click();
  assert.match(await page.locator('#status').textContent(),/1 visible/);
  await page.click('#show-all');assert.match(await page.locator('#status').textContent(),new RegExp(`${expectedCount} visible`));
  await page.click('#panel-back');await page.click('#part-mcu');await page.click('#selection-solo');
  assert.match(await page.locator('#status').textContent(),/2 visible/);
  await page.locator('#selection-visible').uncheck();assert.match(await page.locator('#status').textContent(),/0 visible/);
  await page.locator('#selection-visible').check();assert.match(await page.locator('#status').textContent(),/2 visible/);
  await page.click('#show-all');await page.click('[data-view=top]');await page.click('#panel-back');await page.mouse.move(10,20);
  const beforeXray=await canvasHash(page);
  await page.locator('#part-mcu').hover();
  const duringXray=await canvasHash(page);
  assert.notEqual(duringXray,beforeXray,'Hover must reveal the controller through the assembled display/frame');
  assert.match(await page.locator('#status').textContent(),new RegExp(`${expectedCount} visible`),'X-ray hover never changes visibility');
  await page.mouse.move(10,20);
  assert.equal(await canvasHash(page),beforeXray,'Leaving hover restores the original assembly');
  await restoreAll(page);
  await page.screenshot({path:path.join(root,'build/viewer-desktop.png')});
  // Compare WebGL output without the overlaid DOM controls.
  // Opacity keeps hover/focus active; the separate full-page captures include UI.
  const baseline=await canvasHash(page);
  const count=async()=>Number((await page.locator('#status').textContent()).match(/(\d+) visible components/)[1]);
  assert.equal(await count(),expectedCount);
  await category(page,'battery');
  await page.click('#battery-options [data-battery="301230"]');
  assert.equal(await page.locator('#battery-options [data-battery="301230"]').getAttribute('aria-pressed'),'true');
  await page.click('#battery-options [data-battery="adafruit-1570"]');
  await page.keyboard.press('Escape');
  await panel(page,'inspect');
  for(const group of new Set(scene.parts.map(p=>p.group))){
    await page.locator('#layer-'+group).uncheck();
    assert.equal(await count(),expectedCount-scene.parts.filter(p=>!p.variants&&p.group===group).length,group);
    await page.locator('#layer-'+group).check();
  }
  await page.click('#stack');assert.equal(await page.locator('#explode').inputValue(),'55');
  await page.screenshot({path:path.join(root,'build/viewer-stack.png')});
  await page.click('[data-view=bottom]');await settle(page);await page.screenshot({path:path.join(root,'build/viewer-bottom.png')});
  await restoreAll(page);assert.equal(await count(),expectedCount);
  assert.equal(await page.locator('#explode').inputValue(),'0');
  assert.equal(await canvasHash(page),baseline,'Full reset must restore the original rendered assembly');
  const box=await page.locator('#canvas').boundingBox();
  await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();
  await page.mouse.move(box.x+box.width*.65,box.y+box.height*.65,{steps:8});await page.mouse.up();
  assert.notEqual(await canvasHash(page),baseline,'Orbit drag must change view');
  assert.equal(await page.locator('#selection').isVisible(),false,'Orbit drag must not select a component');
  await page.click('#reset');
  // Per-key shapes come from a design file; export it with an actual alternate mesh and orientation.
  const keyed=JSON.parse(JSON.stringify(scene.catalog.default_configuration));Object.assign(keyed.keycaps.left.K30,{variant:'choc_stem_mx_size_normal_90deg',rotation_deg:90}); // gitleaks:allow -- public upstream STL variant ID, not a credential
  await panel(page,'files');await page.locator('#load-config').setInputFiles({name:'keyed.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(keyed))});
  assert.equal(await page.locator('#config-status').getAttribute('data-error'),'false');
  await category(page,'frames');await page.click('#frame-target [data-side=left]');
  assert.deepEqual(await page.locator('#frame-grid button').evaluateAll(nodes=>nodes.map(n=>n.dataset.style)),frameStyles);
  assert.equal(new Set(await page.locator('#frame-grid img').evaluateAll(imgs=>imgs.map(i=>i.src))).size,frameStyles.length,'All approved previews use distinct actual geometries');
  const themePixels=[];
  for(const theme of frameStyles){
    await page.click(`[data-style=${theme}]`);
    assert.equal(await page.locator(`[data-style=${theme}]`).getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('#config-status').getAttribute('data-error'),'false');
    themePixels.push(await canvasHash(page));
  }
  assert.equal(new Set(themePixels).size,frameStyles.length,'Every approved cover must change actual rendered geometry');
  await page.locator('#frame-color').fill('#ad7656');
  await page.click('#frame-target [data-side=right]');await page.click('[data-color="#ded8c6"]');
  await page.click('#frame-target [data-side=both]');
  assert.equal(await page.locator('#frame-current').textContent(),'Mixed styles');
  assert.equal(await page.locator('#color-current').textContent(),'Mixed colors');
  assert.equal(await page.locator('#frame-grid [aria-pressed=true]').count(),0);
  // Keyboard activation changes shape without erasing custom colors; restore explicitly selects its design palette.
  await page.locator('[data-style=phone]').focus();await page.keyboard.press('Enter');
  assert.equal(await page.locator('#color-current').textContent(),'Mixed colors');await page.click('#theme-colors');
  assert.equal(await page.locator('#frame-color').inputValue(),palettes.styles.phone.colors.body.toLowerCase());
  await page.click('#frame-target [data-side=left]');await page.locator('#frame-link-colors').uncheck();await page.click('[data-style=hanafuda]');
  assert.equal(await page.locator('#frame-color').inputValue(),palettes.styles.hanafuda.colors.body.toLowerCase(),'An uncustomized, unlinked frame adopts the newly selected palette');
  await page.locator('#frame-color').fill('#ad7656');
  await page.click('#frame-target [data-side=right]');await page.click('[data-color="#ded8c6"]');
  await page.click('#frame-target [data-side=left]');
  await category(page,'battery');await page.click('[data-battery="301230"]');await panel(page,'files');
  const configDownload=page.waitForEvent('download');await page.click('#save-config');
  const downloadedConfig=await configDownload;const configPath=path.join(root,'build/revI/viewer-config.json');await downloadedConfig.saveAs(configPath);
  const config=JSON.parse(fs.readFileSync(configPath));
  assert.equal(config.keycaps.left.K30.variant,'choc_stem_mx_size_normal_90deg');assert.equal(config.keycaps.left.K30.rotation_deg,90);
  assert.deepEqual({style:config.frames.left.style,color:config.frames.left.color},{style:'hanafuda',color:'#ad7656'});
  assert.equal(Object.keys(config.frames.left.accents).length,3);
  assert.deepEqual({style:config.frames.right.style,color:config.frames.right.color},{style:'phone',color:'#ded8c6'});
  assert.equal(Object.keys(config.frames.right.accents).length,3);
  assert.deepEqual(config.batteries,{left:'301230',right:'301230'});
  await recovery(page);await page.click('#default-config');await page.locator('#load-config').setInputFiles(configPath);
  await page.waitForFunction(()=>document.querySelector('[data-style=hanafuda]').getAttribute('aria-pressed')==='true');
  assert.equal(await page.locator('[data-style=hanafuda]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#frame-color').inputValue(),'#ad7656');
  await close(page);await page.click('#reset');
  assert.notEqual(await canvasHash(page),baseline,'Custom configuration changes the actual assembly');
  // An incompatible mixed configuration must not replace the current one.
  const invalid=JSON.parse(JSON.stringify(config));invalid.keycaps.left.K01={variant:'choc_stem_mx_size_normal',rotation_deg:0};
  await page.locator('#load-config').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(invalid))});
  await page.waitForFunction(()=>document.querySelector('#config-status').dataset.error==='true');
  // Rows open part pages and Customize this part; highlights never enter the export.
  await panel(page,'inspect');
  const frameLabel=page.locator('#part-lid');
  assert.equal(await frameLabel.isVisible(),true);
  await page.mouse.move(10,20);
  const withoutHighlight=await canvasHash(page);
  await frameLabel.hover();
  assert.notEqual(await canvasHash(page),withoutHighlight,'Sidebar hover highlights geometry');
  await frameLabel.click();
  assert.equal(await page.locator('#selection-title').textContent(),'Display frame');
  assert.equal(await page.locator('#part-lid').getAttribute('aria-expanded'),'true');
  await page.click('#edit-selection');assert.equal(await page.locator('#panel-frames').isVisible(),true);
  assert.equal(await page.locator('#frame-target [data-side=both]').getAttribute('aria-pressed'),'true');
  await panel(page,'files');
  const downloadPromise=page.waitForEvent('download');await page.click('#glb');const download=await downloadPromise;
  const glbPath=path.join(root,'build/viewer-export.glb');await download.saveAs(glbPath);const glb=fs.readFileSync(glbPath);
  assert.equal(glb.toString('ascii',0,4),'glTF');assert.equal(glb.readUInt32LE(4),2);assert.equal(glb.readUInt32LE(8),glb.length);
  const jsonLength=glb.readUInt32LE(12),gltf=JSON.parse(glb.toString('utf8',20,20+jsonLength));
  assert.equal(gltf.nodes.filter(n=>n.mesh!==undefined).length,expectedCount);
  assert.equal(gltf.nodes.filter(n=>n.name.includes('KLP ')).length,36);
  const assembly=gltf.nodes.find(n=>n.name==='Flan36 revI · nominal');assert.deepEqual(assembly.matrix.slice(0,3),[.001,0,0]);
  assert.ok(assembly.extras.attribution.includes('braindefender'));
  assert.deepEqual(assembly.extras.configuration,config);
  const customCap=gltf.nodes.find(n=>n.name==='left · KLP K30');assert.equal(customCap.extras.variant,config.keycaps.left.K30.variant);
  const customFrame=gltf.nodes.find(n=>n.extras?.side==='left'&&n.extras?.group==='lid'&&n.extras?.frame_style);assert.equal(customFrame.extras.frame_style,'hanafuda');
  const frameMaterial=gltf.materials[gltf.meshes[customFrame.mesh].primitives[0].material];
  const linear=n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;};
  const expected=[173,118,86].map(linear);
  frameMaterial.pbrMetallicRoughness.baseColorFactor.slice(0,3).forEach((n,i)=>assert.ok(Math.abs(n-expected[i])<1e-5,'Highlight must not affect exported frame color'));
  for(const node of gltf.nodes.filter(n=>n.extras?.group==='lid'&&n.extras?.frame_style)){
    const primitives=gltf.meshes[node.mesh].primitives,style=node.extras.frame_style;
    assert.equal(primitives.length,4,'Themed GLB retains four surface colors');
    for(const [i,role] of palettes.roles.entries()){
      const hex=role==='body'?config.frames[node.extras.side].color:palettes.styles[style].colors[role];
      const expected=[1,3,5].map(at=>linear(parseInt(hex.slice(at,at+2),16)));
      const actual=gltf.materials[primitives[i].material].pbrMetallicRoughness.baseColorFactor;
      expected.forEach((n,j)=>assert.ok(Math.abs(n-actual[j])<1e-5,'GLB '+style+' '+role+' color'));
    }
  }
  assert.equal(download.suggestedFilename(),'Flan36-revI-assembled.glb');
  function positionBytes(node){
    const primitive=gltf.meshes[node.mesh].primitives[0],a=gltf.accessors[primitive.attributes.POSITION],v=gltf.bufferViews[a.bufferView];
    assert.equal(a.componentType,5126);assert.equal(a.type,'VEC3');assert.ok(!v.byteStride||v.byteStride===12);
    const binStart=20+jsonLength+8,at=binStart+(v.byteOffset||0)+(a.byteOffset||0);
    return glb.subarray(at,at+a.count*12);
  }
  for(const side of ['left','right']){
    const battery=gltf.nodes.find(n=>n.extras?.side===side&&n.extras?.group==='battery');
    assert.equal(battery.extras.battery_profile,'301230');
    assert.deepEqual(positionBytes(battery),Buffer.from(scene.geometries[`mechanical/revI/${side}-battery-301230.stl`].positions,'base64'));
    const frameMagnets=gltf.nodes.filter(n=>n.extras?.side===side&&n.name.includes('Captive frame magnet'));
    assert.equal(frameMagnets.length,3);
    for(const [i,magnet] of frameMagnets.entries())assert.deepEqual(positionBytes(magnet),Buffer.from(scene.geometries[`mechanical/revI/${side}-frame-target-${i}.stl`].positions,'base64'),'Frame selection preserves captive frame magnets');
  }
  const capPath=scene.catalog.variants.find(v=>v.id===config.keycaps.left.K30.variant).path;
  assert.deepEqual(positionBytes(customCap),Buffer.from(scene.geometries[capPath].positions,'base64'),'GLB must contain selected cap vertices');
  assert.deepEqual(positionBytes(customFrame),Buffer.from(scene.geometries['mechanical/revI/left-frame-hanafuda.stl'].positions,'base64'),'GLB must contain selected frame vertices');
  await recovery(page);await page.click('#default-config');await page.keyboard.press('Escape');await page.click('#reset');
  assert.equal(await canvasHash(page),baseline,'Default config plus reset restores exact rendered assembly');
  await category(page,'keycaps');
  await page.click('[data-preset=saddle-sculpted]');assert.equal(await page.locator('#config-status').getAttribute('data-error'),'false');
  await recovery(page);await page.click('#default-config');
  // Design edits preserve the inspection: separation and a hidden cover survive frame changes.
  await panel(page,'inspect');await page.click('#stack');
  await page.locator('#part-mcu').hover();
  await page.click('[data-view=front]');
  await category(page,'frames');await page.click('[data-style=gameboy]');
  assert.equal(await page.locator('#layer-lid').isChecked(),false,'Changing a frame preserves a hidden cover');
  assert.equal(await page.locator('#explode').inputValue(),'55');
  await page.click('#frame-target [data-side=both]');await page.click('[data-style=phone]');
  assert.equal(await page.locator('#layer-lid').isChecked(),false,'Editing both halves preserves the inspection');assert.equal(await page.locator('#explode').inputValue(),'55');
  await restoreAll(page);await panel(page,'inspect');await page.locator('#part-lid').focus();await page.keyboard.press('Enter');
  assert.equal(await page.locator('#selection-title').textContent(),'Display frame');
  await page.click('#panel-back');await checkDirectory(page);
  await page.screenshot({path:path.join(root,'build/viewer-sidebar/desktop-linked.png')});
  await page.evaluate(()=>document.querySelector('#inspector').scrollTop=10000);await checkDirectory(page);
  // Tap the left frame in the model itself.
  const pick=await framePixel(page);
  await page.mouse.click(pick.x,pick.y);assert.equal(await page.locator('#selection-title').textContent(),'Display frame');
  assert.match(await page.locator('#selection-meta').textContent(),/^left half/);
  await page.click('#edit-selection');assert.equal(await page.locator('#frame-target [data-side=left]').getAttribute('aria-pressed'),'true');
  await page.keyboard.press('Escape');
  const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  if(offline)await mobile.route(/^https?:/,route=>{requests.push(route.request().url());return route.abort();});
  const phone=await mobile.newPage();phone.touch=true;phone.on('pageerror',e=>errors.push(e.message));await phone.goto(withDiagnostics(target));
  await phone.waitForFunction(n=>document.querySelector('#status').textContent.includes(`${n} visible components`),expectedCount);await phone.evaluate(()=>window.flan36.ground(false));
  await checkFramedPixels(phone);
  assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal overflow');
  await category(phone,'cases');await phone.locator('[data-case=rim]').tap();await checkDirectory(phone);
  await category(phone,'frames');await phone.locator('[data-style=gameboy]').tap();
  assert.equal(await phone.locator('[data-style=gameboy]').getAttribute('aria-pressed'),'true');
  assert.ok((await phone.locator('#canvas').boundingBox()).y>=0,'Model stays visible while browsing cards');
  await panel(phone,'inspect');await phone.locator('#part-lid').tap();
  assert.equal(await phone.locator('#selection-title').textContent(),'Display frame');
  await phone.locator('#edit-selection').tap();assert.equal(await phone.locator('#frame-target [data-side=both]').getAttribute('aria-pressed'),'true');
  await checkDirectory(phone);

  await phone.locator('#inside').tap();assert.ok((await phone.locator('#status').textContent()).includes('components'));
  await phone.locator('#layer-display').uncheck();
  await phone.locator('#part-display').tap();
  assert.equal(await phone.locator('#selection-visible').isChecked(),false);assert.equal(await phone.locator('#selection-view .view-label').textContent(),'Hidden','A hidden selection says so on its page');
  await phone.locator('#reset').tap();assert.equal(await phone.locator('#explode').inputValue(),'0');
  await phone.locator('#panel-back').tap();await phone.locator('#part-lid').tap();
  assert.equal(await phone.locator('#selection-title').textContent(),'Display frame');await phone.locator('#panel-back').tap();await checkDirectory(phone);
  await phone.evaluate(()=>{document.querySelector('#inspector').scrollTop=0;scrollTo(0,0);});await phone.evaluate(()=>new Promise(requestAnimationFrame));
  await phone.screenshot({path:path.join(root,'build/viewer-mobile.png'),fullPage:true,animations:'disabled'});
  // Actual touch events: a one-finger orbit and two-finger gesture must not select.
  const cdp=await mobile.newCDPSession(phone),rect=await phone.locator('#canvas').boundingBox();
  const cx=rect.x+rect.width*.5,cy=rect.y+rect.height*.48;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx,y:cy,id:1}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx+35,y:cy+20,id:1}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.equal(await phone.locator('#selection').isVisible(),false,'Touch orbit does not select');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx-30,y:cy,id:1},{x:cx+30,y:cy,id:2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx-45,y:cy+6,id:1},{x:cx+45,y:cy+6,id:2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.equal(await phone.locator('#selection').isVisible(),false,'Pinch/pan does not select');
  await phone.setViewportSize({width:320,height:568});await phone.locator('#reset').tap();
  assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No overflow at 320px');
  await category(phone,'frames');await phone.locator('[data-style=phone]').tap();await checkDirectory(phone);
  await phone.locator('#part-lid').tap();assert.equal(await phone.locator('#selection-title').textContent(),'Display frame');
  await phone.locator('#panel-back').tap();await checkDirectory(phone);
  const stage=await phone.locator('.stage').boundingBox();assert.ok(stage.y>=0&&stage.y+stage.height<568,'3D view stays visible at the smallest tested viewport');
  await phone.screenshot({path:path.join(root,'build/viewer-ux/mobile-small.png'),animations:'disabled'});
  await phone.setViewportSize({width:844,height:390});await checkDirectory(phone);
  // Capture the actual designs and readable palette cards, including mobile.
  fs.mkdirSync(path.join(root,'build/viewer-multicolor'),{recursive:true});
  await page.click('#reset');await category(page,'frames');await page.click('#frame-target [data-side=both]');
  for(const style of frameStyles){
    await page.click(`[data-style=${style}]`);await page.click('#theme-colors');await page.mouse.move(10,100);
    assert.equal(await page.locator('#frame-color').inputValue(),palettes.styles[style].colors.body.toLowerCase());
    await page.screenshot({path:path.join(root,`build/viewer-multicolor/${style}.png`)});
  }
  await page.locator('#frame-color').fill('#ad7656');await page.click('#theme-colors');
  assert.equal(await page.locator('#frame-color').inputValue(),palettes.styles.hanafuda.colors.body.toLowerCase());
  await page.locator('#frame-grid').screenshot({path:path.join(root,'build/viewer-multicolor/previews.png')});
  await phone.setViewportSize({width:390,height:844});await phone.locator('#reset').tap();await category(phone,'frames');await phone.locator('[data-style=hanafuda]').tap();
  await phone.evaluate(()=>document.querySelector('#inspector').scrollTop=0);
  await phone.screenshot({path:path.join(root,'build/viewer-multicolor/mobile.png')});await checkDirectory(phone);
  await recovery(page);await page.click('#default-config');await page.click('#reset');await category(page,'cases');await page.click('#case-target [data-side=both]');await page.click('[data-case=rim]');await page.mouse.move(10,20);await page.evaluate(()=>document.querySelector('#inspector').scrollTop=0);
  assert.equal(await page.locator('#case-grid').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),4);
  await page.screenshot({path:path.join(root,'build/viewer-cases-desktop.png')});await checkDirectory(page);
  await category(phone,'cases');await phone.locator('[data-case=rim]').tap();await phone.evaluate(()=>document.querySelector('#inspector').scrollTop=0);
  await phone.screenshot({path:path.join(root,'build/viewer-cases-mobile.png')});await checkDirectory(phone);
  assert.deepEqual(errors,[]);if(offline)assert.deepEqual(requests,[],'Offline viewer must not request network resources');
  const receipt={viewer_sha256:hash(Buffer.from(html)),checker_sha256:hash(fs.readFileSync(__filename)),about_measurements_match_model:true,target:offline?'local file with all HTTP(S) requests blocked':'public URL',
    browser:await browser.version(),desktop:true,narrow_viewport_emulation:true,physical_phone_tested:false,public_embedded_scene_matches_current:!offline,
    all_12_layer_filters:true,individual_visibility:true,individual_and_group_solo:true,selection_visible_toggle:true,show_all_recovery:true,occluded_hover_xray_pixel_verified:true,floating_view_controls_clear_of_fitted_model:true,fit_actual_pixels_after_zoom:true,fit_empty_feedback:true,full_row_hover:true,orbit_drag:true,bottom_view:true,full_reset_pixel_identical:true,
    component_rows_reachable:true,keyboard_component_selection:true,direct_canvas_picking:true,frame_change_preserves_hidden_cover:true,orbit_does_not_select:true,touch_orbit_and_pinch_do_not_select:true,small_320px_viewport:true,
    approved_preview_cards:frameStyles.length,multicolor_glb_roles:true,one_click_frames:true,keyboard_frame_activation:true,mixed_style_and_color_state:true,theme_applies_palette_and_body_overrides_roundtrip:true,sidebar_hover_highlight:true,part_page_customizes_frame:true,touch_frame_cards_and_sidebar:true,hidden_selection_marked:true,highlight_excluded_from_glb:true,
    dual_battery_selection_and_exact_glb:true,captive_frame_magnets_preserved:true,keycap_variant_from_design_file:true,frame_style_and_color:true,distinct_themed_geometries:frameStyles.length,json_roundtrip:true,invalid_combination_rejected:true,glb_matches_custom_configuration:true,glb_selected_vertices_exact:true,glb_objects:expectedCount,glb_keycaps:36,glb_units:'metres',case_variants:Object.keys(scene.catalog.case_styles).length,case_previews_distinct:true,case_glb_meshes_exact:true,open_cover_configuration:true,legacy_case_default:true,runtime_errors:errors,offline_network_requests:requests.length};
  // Case captures stay under build/; capture-readme.cjs owns the README images.
  const caseImages={};for(const [name,source] of [['level','level'],['solid','solid'],['rim','rim'],['terrace','terrace'],['rim-open','rim-open-top']])caseImages[name]=hash(fs.readFileSync(path.join(root,`build/case-variants/${source}.png`)));
  fs.writeFileSync(path.join(root,'build/case-variants/render.json'),JSON.stringify({viewer_sha256:hash(Buffer.from(html)),checker_sha256:hash(fs.readFileSync(__filename)),images:caseImages,source:'Unretouched screenshots of the actual selected native STL meshes in the viewer'},null,2)+'\n');
  fs.writeFileSync(path.join(root,'build/viewer-ui-check.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify(receipt,null,2));await mobile.close();await context.close();
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
