// SPDX-License-Identifier: GPL-3.0-or-later
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
// Run from the repository root; uses the same pinned Playwright runtime as the viewer checks.
const root=path.resolve(__dirname,'../..'),{chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
const serve=require(path.join(root,'viewer/serve-docs.cjs'));
(async()=>{
 fs.mkdirSync(path.join(root,'build/marketing'),{recursive:true});
 const site=await serve(); let browser;
 const parts=JSON.parse(fs.readFileSync(path.join(root,'build/viewer-scene.json'))).parts;
 const capturesVerified=[];
 try{
  browser=await chromium.launch({headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
  const p=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  const captures=[['hero','flan36','flan','talavera',0],['layers','flan36','flan','talavera',65],['talavera','flan36','talavera','talavera',0],['hanafuda','flan36','hanafuda','hanafuda',0],['flan42','flan42','flan','talavera',0],['flan46','flan46','flan','talavera',0],['flan54','flan54','flan','talavera',0]];
  for(const [name,size,theme,frame,explode] of captures){
   await p.goto(`${site.base}explore/?size=${size}&theme=${theme}&case=rim&keys=original&frame=${frame}&diagnostics`);
   await p.waitForFunction(()=>window.flan36,null,{timeout:120000});
   // Diagnostics is available before the first asynchronous variant has reached the scene.
   // Wait through its initial load before fitting the camera or capturing a different size.
   await p.waitForFunction(size=>window.flan36.snapshot().configuration.variant===size&&!document.getElementById('print-kit').disabled,size,{timeout:120000});
   await p.evaluate(()=>window.flan36.settled());await p.evaluate(()=>window.flan36.idle());
   const capIndices=parts.map((part,index)=>part.group==='keycaps'?index:-1).filter(i=>i>=0),expected=Number(size.slice(4));
   await p.waitForFunction(({capIndices,expected})=>window.flan36.snapshot().visible.filter(i=>capIndices.includes(i)).length===expected,{capIndices,expected},{timeout:120000});
   if(await p.locator('#workspace').isVisible())await p.click('#panel-close');
   await p.locator('#explode').evaluate((e,v)=>{e.value=String(v);e.dispatchEvent(new Event('input',{bubbles:true}));},explode);
   await p.click('#fit');await p.waitForTimeout(900);
   await p.locator('#canvas').screenshot({path:path.join(root,'build/marketing',name+'.png'),omitBackground:true,style:'.bar,.stage > :not(canvas),#workspace{visibility:hidden!important}html,body{background:transparent!important}'});
   const snapshot=await p.evaluate(()=>window.flan36.snapshot());
   const keys=Object.fromEntries(['left','right'].map(side=>[side,snapshot.visible.filter(i=>parts[i]?.group==='keycaps'&&parts[i].side===side).length]));
   assert.equal(keys.left,expected/2);assert.equal(keys.right,expected/2);
   capturesVerified.push({name,size,keys,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'build/marketing',name+'.png'))).digest('hex')});
   console.log('Captured',name,keys);
  }
  if(errors.length)throw Error(errors.join(';'));
  fs.writeFileSync(path.join(root,'build/marketing/captures.json'),JSON.stringify(capturesVerified,null,2)+'\n');
 }finally{if(browser)await browser.close();site.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
