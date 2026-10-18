// SPDX-License-Identifier: GPL-3.0-or-later
// Capture the real configurator, with no image retouching or synthetic parts.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'build/keycolors');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,...(process.env.FLAN36_BROWSER?{executablePath:process.env.FLAN36_BROWSER}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:960}});
  await page.goto(process.env.FLAN36_VIEWER_URL||'file://'+path.join(root,'docs/explore/index.html'));
  await page.waitForSelector('[data-cap-key]',{state:'attached'});
  await page.click('#part-lid');await page.click('[data-style=cartridge]');await page.click('#theme-colors');
  await page.click('#part-keycaps');await page.click('[data-cap-palette=flan]');await page.mouse.move(10,20);
  await page.screenshot({path:path.join(out,'editor-desktop.png')});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:path.join(out,'editor-mobile.png')});
  console.log('Captured the actual key-color editor at 1440 and 390 px.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
