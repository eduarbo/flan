// The home page's poster (shown until the live model is ready) and its social image, rendered from the
// built home itself so the swap to the live canvas is seamless. Then rebuild: node viewer/home-build.mjs
// FLAN36_PLAYWRIGHT_MODULE=/path/to/playwright-core FLAN36_BROWSER=/path/to/chromium node viewer/home-poster.cjs
// SPDX-License-Identifier: GPL-3.0-or-later
const path=require('path'),{execFileSync}=require('child_process'),serve=require('./serve-docs.cjs');
const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'home'),work=path.join(root,'build');
(async()=>{
  const server=await serve(),browser=await chromium.launch({executablePath:process.env.FLAN36_BROWSER,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  // the default look, layers apart, standby paused at rest
  const ready=async p=>{await p.addInitScript(()=>{try{localStorage.clear();}catch{}});await p.goto(server.base);await p.waitForSelector('#stage.live',{timeout:120000});
    await p.evaluate(()=>{document.getElementById('standby').click();scrollTo(0,0);});await p.waitForTimeout(4000);};
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:2});await ready(page);
  // the canvas fills the hero; the poster covers the stage area it frames the model in
  await page.addStyleTag({content:'html,body,.hero::before{background:transparent!important}.hero>*:not(.scene),.glow,main,footer{visibility:hidden!important}'});
  const clip=await page.locator('#stage').boundingBox();
  const raw=path.join(work,'home-poster.png');await page.screenshot({path:raw,clip,omitBackground:true});
  execFileSync('magick',[raw,'-resize','1600x>','-quality','84','-define','webp:alpha-quality=90',path.join(out,'home-poster.webp')]);
  // the desktop layout at 1200 × 630
  const og=await browser.newPage({viewport:{width:1440,height:756},deviceScaleFactor:1200/1440});await ready(og);
  // title on the left, the keyboard filling the right
  await og.addStyleTag({content:'.rail,.layers,.stagebar,nav{visibility:hidden!important}.hero{min-height:756px!important;height:756px}.stage{grid-row:2/4!important;grid-column:1/-1!important;margin:20px -40px 0 34%!important}'});await og.waitForTimeout(1500);
  await og.screenshot({path:path.join(out,'home-og.png')});
  console.log(execFileSync('magick',['identify',path.join(out,'home-poster.webp'),path.join(out,'home-og.png')]).toString());
  await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1);});
