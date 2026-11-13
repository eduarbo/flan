// The explorer fetches the meshes its design shows, not the others, and recovers when a mesh file does not
// arrive: the status says so, exports wait, and the file is asked for again. Serves docs/ with a switch that
// fails mesh files.
// FLAN36_PLAYWRIGHT_MODULE=/path/to/playwright-core FLAN36_BROWSER=/path/to/chromium node viewer/meshes-check.cjs
// SPDX-License-Identifier: GPL-3.0-or-later
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(__dirname,'..'),docs=path.join(root,'docs');
const receipt=JSON.parse(fs.readFileSync(path.join(root,'validation',fs.readdirSync(path.join(root,'validation')).filter(f=>/^rev[A-Z]+-viewer\.json$/.test(f)).sort().at(-1)))).geometry;
const tune=async(page,name)=>{const t=page.locator(`#panel-${name} .tune[aria-expanded=false]`);if(await t.count()&&await t.isVisible())await t.click();};
let failing=false;const asked=[];
const server=http.createServer((req,res)=>{
  let relative=decodeURIComponent(new URL(req.url,'http://x').pathname).replace(/^\//,'');if(relative.endsWith('/'))relative+='index.html';
  const file=path.resolve(docs,relative);
  if(!file.startsWith(docs+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}
  const mesh=path.basename(file).match(/^geometry-(.+)-[0-9a-f]{64}\.bin$/);
  if(mesh){asked.push(mesh[1]);if(failing){res.writeHead(503);res.end('test fault');return;}}
  res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.webp')?'image/webp':'application/octet-stream');res.end(fs.readFileSync(file));
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({executablePath:process.env.FLAN36_BROWSER}),errors=[],report={};
  try{
    const page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>errors.push(e.message));
    // a link's design: its own meshes, and nothing of the options it does not show
    await page.goto(`http://127.0.0.1:${server.address().port}/explore/?diagnostics&size=flan36&theme=eva-01&case=rim&keys=original&frame=snes%2Cphone`);
    assert.equal(await page.locator('#loading-still').isVisible(),true,'a link to the home look shows its picture while loading');
    await page.waitForSelector('#loading',{state:'hidden',timeout:120000});await page.evaluate(()=>window.flan36.settled());
    for(const name of ['core','case-rim','frame-snes','frame-phone','cap-choc_stem_choc_size_normal','pcb','battery-adafruit-1570'])assert.ok(asked.includes(name),'the design needs '+name);
    await page.evaluate(()=>window.flan36.idle());
    const unwanted=asked.filter(name=>name==='battery-301230'||/mx_size|_90deg/.test(name));assert.deepEqual(unwanted,[],'options not shown are not fetched');
    assert.equal(new Set(asked).size,asked.length,'each file is fetched once');
    const whole=await page.locator('#status').textContent();
    report.opening={files:asked.length,bytes:asked.reduce((n,name)=>n+receipt.chunks[name].bytes,0),of_bytes:receipt.bytes,of_files:Object.keys(receipt.chunks).length};
    assert.ok(report.opening.bytes<receipt.bytes*.7,'the opening design fetches a part of the meshes');
    assert.equal(await page.locator('#parts-status').isHidden(),true);assert.equal(await page.locator('#glb').isDisabled(),false);
    // a mesh file that does not arrive: the design is kept, the status says so, exports wait
    failing=true;await page.click('#editor-tabs [data-panel=battery]');await tune(page,'battery');await page.click('[data-battery="301230"]');
    await page.waitForFunction(()=>document.querySelector('#parts-status').dataset.error==='true',null,{timeout:20000});
    const during=await page.evaluate(()=>({batteries:window.flan36.snapshot().configuration.batteries,glb:document.querySelector('#glb').disabled,kit:document.querySelector('#print-kit').disabled,
      text:document.querySelector('#parts-status').textContent,awaited:window.flan36.meshes().awaited,status:document.querySelector('#status').textContent}));
    assert.deepEqual(during.batteries,{left:'301230',right:'301230'});assert.equal(during.glb,true);assert.equal(during.kit,true);assert.ok(during.awaited>0);
    assert.match(during.text,/could not be downloaded/);assert.equal(during.status,whole,'the earlier battery stays in view');
    // it is asked for again without the visitor doing anything, and the design completes
    failing=false;await page.waitForFunction(()=>window.flan36.meshes().awaited===0,null,{timeout:30000});
    assert.equal(await page.locator('#parts-status').isHidden(),true);assert.equal(await page.locator('#glb').isDisabled(),false);assert.equal(await page.locator('#print-kit').isDisabled(),false);
    assert.equal(await page.locator('#status').textContent(),whole);
    assert.ok(asked.filter(name=>name==='battery-301230').length>=2,'the failed file was requested again');
    report.recovery={failed_then_retried:'battery-301230',requests:asked.filter(name=>name==='battery-301230').length};
    // a mesh missing when the page opens: one reload, then a message rather than an endless wait
    failing=true;const second=await browser.newPage({viewport:{width:1280,height:900}});await second.goto(`http://127.0.0.1:${server.address().port}/explore/`);
    await second.waitForSelector('#error:not([hidden])',{timeout:60000});assert.match(await second.locator('#error').textContent(),/could not be downloaded/);
    assert.equal(await second.locator('#loading').isHidden(),true);report.opening_failure='reported after one reload';
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify(report,null,1));console.log('PASS: the opening design fetches its own meshes; a failed mesh file is reported, retried and recovered.');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
