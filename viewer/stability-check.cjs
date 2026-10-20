// Reproduce wrong-size exports under failed/delayed loading; verify actual downloaded print files.
// SPDX-License-Identifier: GPL-3.0-or-later
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'build/stability-check');fs.mkdirSync(out,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
  const server=process.env.FLAN36_VIEWER_URL?null:await require('./serve-docs.cjs')();
  const url=process.env.FLAN36_VIEWER_URL||server.base+'explore/';
  const browser=await chromium.launch({executablePath:process.env.FLAN36_BROWSER,args:process.env.FLAN36_BROWSER_ANGLE?['--use-angle='+process.env.FLAN36_BROWSER_ANGLE]:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    const {unzipSync}=await import('three/addons/libs/fflate.module.js');
    const page=await browser.newPage({viewport:{width:1366,height:900},acceptDownloads:true,reducedMotion:'reduce'});
    page.setDefaultTimeout(120000);
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    let fail=true,release;const delay=new Promise(r=>release=r);
    await page.route('**/variant-flan54-*.bin',r=>fail?r.abort('failed'):r.continue());
    await page.route('**/variant-flan42-*.bin',async r=>{await delay;await r.continue();});
    await page.goto(url+(url.includes('?')?'&':'?')+'diagnostics',{timeout:120000,waitUntil:'domcontentloaded'});console.log('document loaded');
    await page.waitForFunction(()=>window.flan36||!document.getElementById('error').hidden,null,{timeout:180000});
    assert(await page.evaluate(()=>Boolean(window.flan36)),await page.locator('#error').textContent());console.log('loaded');
    const base=await page.evaluate(()=>window.flan36.snapshot().configuration);
    const imported={...base,variant:'flan54'};
    await page.locator('#load-config').setInputFiles({name:'flan54.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(imported))});
    await page.waitForFunction(()=>document.getElementById('size-current').textContent==='Flan54');
    await page.waitForFunction(()=>document.getElementById('config-status').dataset.error==='true');
    assert(await page.locator('#print-kit').isDisabled());assert(await page.locator('#glb').isDisabled());
    assert.equal(await page.locator('#build-variant-status').getAttribute('hidden'),null);
    const links=await page.$$eval('#build-pcb-downloads a,#build-firmware a',xs=>xs.map(a=>a.href));
    assert.equal(links.length,5);assert(links.every(x=>x.includes('flan54')),links.join('\n'));
    // A failed resource is retryable; identity stays Flan54 throughout.
    fail=false;await page.locator('#nav-customize').click();await page.locator('[data-panel="size"]').click();
    await page.locator('[data-variant="flan54"]').click();
    await page.waitForFunction(()=>!document.getElementById('print-kit').disabled,null,{timeout:180000});
    assert.equal(await page.locator('#size-current').textContent(),'Flan54');
    // Rapid selection: an older response must not undo the latest explicit size choice.
    await page.locator('[data-variant="flan42"]').click();
    assert(await page.locator('#print-kit').isDisabled());
    await page.locator('[data-variant="flan36"]').click();release();
    await page.waitForTimeout(1800);
    assert.equal((await page.evaluate(()=>window.flan36.snapshot().configuration)).variant,'flan36');
    const kits={};
    for(const variant of ['flan36','flan54']){
      await page.locator('.app-nav [data-mode="customize"]').click();await page.locator('[data-panel="size"]').click();
      await page.locator(`[data-variant="${variant}"]`).click();
      await page.waitForFunction(()=>!document.getElementById('print-kit').disabled,null,{timeout:180000});
      await page.locator('#go-build').click();
      await page.locator('#print-scope [data-value="complete"]').click();
      const download=page.waitForEvent('download',{timeout:180000});await page.locator('#print-kit').click();
      const file=await download,destination=path.join(out,file.suggestedFilename());await file.saveAs(destination);
      const bytes=fs.readFileSync(destination),zip=unzipSync(bytes),manifest=JSON.parse(Buffer.from(zip['manifest.json']));
      assert.equal(manifest.configuration.variant,variant);assert.equal(manifest.keycaps.missing.length,0);
      assert.equal(manifest.keycaps.groups.reduce((n,g)=>n+g.count,0),Number(variant.slice(4)));
      for(const p of manifest.parts){assert.equal(sha(fs.readFileSync(path.join(root,p.source))),p.source_sha256);assert.equal(sha(zip[`STL/${p.id}.stl`]),p.source_sha256);}
      kits[variant]={file:path.relative(root,destination),sha256:sha(bytes),parts:manifest.parts.length,keycaps:manifest.keycaps.groups.reduce((n,g)=>n+g.count,0)};
    }
    await page.screenshot({path:path.join(out,'build-desktop.png')});
    await page.setViewportSize({width:390,height:844});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:path.join(out,'build-phone.png')});
    const glbDownload=page.waitForEvent('download',{timeout:180000});await page.locator('#glb').click();
    const glb=await glbDownload;assert.equal(glb.suggestedFilename(),'Flan54-revI-assembled.glb');
    const glbPath=path.join(out,glb.suggestedFilename());await glb.saveAs(glbPath);
    const binary=fs.readFileSync(glbPath);assert.equal(binary.toString('ascii',0,4),'glTF');
    const gltf=JSON.parse(binary.subarray(20,20+binary.readUInt32LE(12)).toString());
    const assembly=gltf.nodes.find(n=>n.extras?.configuration);
    assert.equal(assembly.extras.configuration.variant,'flan54');assert(assembly.name.startsWith('Flan54'));
    assert.deepEqual(errors,[]);
    const report={failed_variant_blocks_geometry_exports:true,pcb_and_firmware_match_requested_size:true,retry_succeeds:true,latest_size_wins:true,kits,glb:{file:path.relative(root,glbPath),sha256:sha(binary),variant:assembly.extras.configuration.variant},uncaught_errors:errors,physical_acceptance:false};
    fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n');console.log(report);
  }finally{await browser.close();server?.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
