// The home page's poster (shown until the live model is ready) rendered from the
// built home itself so the swap to the live canvas is seamless. Then rebuild: node viewer/home-build.mjs
// FLAN36_PLAYWRIGHT_MODULE=/path/to/playwright-core FLAN36_BROWSER=/path/to/chromium node viewer/home-poster.cjs
// FLAN36_BROWSER_ANGLE=metal renders with the GPU, which the lit, shadowed look needs; software rendering shows the flat one.
// SPDX-License-Identifier: GPL-3.0-or-later
const path=require('path'),{execFileSync}=require('child_process'),serve=require('./serve-docs.cjs');
const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'home'),work=path.join(root,'build');
(async()=>{
  const server=await serve(),browser=await chromium.launch({executablePath:process.env.FLAN36_BROWSER,args:process.env.FLAN36_BROWSER_ANGLE?['--use-angle='+process.env.FLAN36_BROWSER_ANGLE,'--enable-gpu','--ignore-gpu-blocklist']:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  // the default look, layers apart, standby paused at rest
  const ready=async p=>{await p.addInitScript(()=>{try{localStorage.clear();}catch{}});await p.goto(server.base);await p.waitForSelector('#stage.live',{timeout:120000});
    await p.evaluate(()=>{document.getElementById('standby').click();scrollTo(0,0);});await p.waitForTimeout(4000);};
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:2});await ready(page);
  // the canvas fills the hero; the poster covers the stage area it frames the model in
  await page.addStyleTag({content:'html,body,.hero::before{background:transparent!important}.hero>*:not(.scene),.glow,main,footer{visibility:hidden!important}'});
  const clip=await page.locator('#stage').boundingBox();
  const raw=path.join(work,'home-poster.png');await page.screenshot({path:raw,clip,omitBackground:true});
  execFileSync('magick',[raw,'-resize','1600x>','-quality','84','-define','webp:alpha-quality=90',path.join(out,'home-poster.webp')]);
  // a phone's stage is at most 506 px wide and its live model is drawn at 1.5 to 1.75 device pixels per px: 800 is as sharp
  execFileSync('magick',[raw,'-resize','800x>','-quality','84','-define','webp:alpha-quality=90',path.join(out,'home-poster-800.webp')]);
  // Social artwork is generated separately by viewer/marketing/build.cjs.
  console.log(execFileSync('magick',['identify',path.join(out,'home-poster.webp'),path.join(out,'home-poster-800.webp'),path.join(out,'home-og.png')]).toString());
  await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1);});
