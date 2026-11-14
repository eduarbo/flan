// SPDX-License-Identifier: GPL-3.0-or-later
// Capture the real configured geometry before composing cover variants.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..'),serve=require('../serve-docs.cjs'),variants=require('./variants.json');
const out=path.join(root,'build/marketing/variants');fs.mkdirSync(out,{recursive:true});
(async()=>{const server=await serve();let browser;const receipts=[];
 try{browser=await chromium.launch({headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});const page=await browser.newPage({viewport:{width:1600,height:1000}});
 const parts=JSON.parse(fs.readFileSync(path.join(root,'build/viewer-scene.json'))).parts;
 for(const v of variants){
  await page.goto(`${server.base}explore/?size=flan36&theme=${v.id}&case=${v.case}&keys=original&frame=${v.frames}&diagnostics`);
  await page.waitForFunction(()=>window.flan36&&!document.getElementById('print-kit').disabled,null,{timeout:120000});
  await page.evaluate(()=>window.flan36.idle());
  if(await page.locator('#workspace').isVisible())await page.click('#panel-close');
  await page.locator('#explode').evaluate((e,value)=>{e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));},v.explode);
  await page.click('#fit');await page.waitForTimeout(900);
  const snap=await page.evaluate(()=>window.flan36.snapshot()),expectedFrames=v.frames.split(',');
  for(const [i,side] of ['left','right'].entries()){
   assert.equal(snap.configuration.cases[side].style,v.case);
   assert.equal(snap.configuration.frames[side].style,expectedFrames[i]||expectedFrames[0]);
   assert.equal(snap.visible.filter(n=>parts[n]?.group==='keycaps'&&parts[n].side===side).length,18);
  }
  const file=path.join(out,v.id+'.png');await page.locator('#canvas').screenshot({path:file,omitBackground:true,style:'.bar,.stage > :not(canvas),#workspace{visibility:hidden!important}html,body{background:transparent!important}'});
  receipts.push({id:v.id,configuration:snap.configuration,keys_per_half:18,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')});console.log('Captured',v.id,v.case,v.frames);
 }
 fs.writeFileSync(path.join(out,'captures.json'),JSON.stringify(receipts,null,2)+'\n');
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
