// Capture the README and guide images from the built site, so they always show the current design:
// renders from the explorer (transparent, with the contact shadow) and screenshots of the home page
// and the explorer as visitors see them. Serves docs/ like GitHub Pages; uses the GPU when present.
// FLAN36_PLAYWRIGHT_MODULE=/path/to/playwright-core FLAN36_BROWSER=/path/to/chromium node viewer/capture-readme.cjs
// FLAN_GL=software renders with SwiftShader instead.
// SPDX-License-Identifier: GPL-3.0-or-later
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{execFileSync}=require('child_process');
const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
const serve=require('./serve-docs.cjs');
const root=path.resolve(__dirname,'..'),images=path.join(root,'docs/images'),work=path.join(root,'build/readme-images');
fs.mkdirSync(work,{recursive:true});
const GL=process.env.FLAN_GL==='software'?['--use-angle=swiftshader','--enable-unsafe-swiftshader']:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'];
// renders: the canvas alone, on a transparent page
const bare='.bar,.stage > :not(canvas),#workspace{visibility:hidden!important}html,body{background:transparent!important}';
const settle=(page,ms=500)=>page.evaluate(ms=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,ms)))),ms);
const LOOK='size=flan36&theme=snes&keys=original&frame=snes';
const catalog=JSON.parse(fs.readFileSync(path.join(root,'keycaps/catalog.json'),'utf8'));
// Each case in its own suggested finish, as its thumbnail in the explorer shows it, loaded like a saved design.
function caseDesign(style){
  const c=JSON.parse(JSON.stringify(catalog.default_configuration)),spec=catalog.case_styles[style];
  for(const side of ['left','right'])Object.assign(c.cases[side],{style,base_color:spec.base_color,plate_color:spec.plate_color,match_frame:false});
  return {name:`flan36-${style}.json`,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(c))};
}

async function explorer(browser,site,{query,width=1600,height=1000,scale=2,mobile=false}){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:scale,isMobile:mobile,hasTouch:mobile});
  page.errors=[];page.on('pageerror',e=>page.errors.push(e.message));
  await page.addInitScript(()=>{try{localStorage.clear();}catch{}});
  await page.goto(`${site.base}explore/?${query}&diagnostics`);
  await page.waitForFunction(()=>window.flan36,null,{timeout:180000});await settle(page);
  return page;
}
// Fit with the panel hidden, capture the transparent canvas, then trim to the model and its shadow with an even margin.
async function render(page,file,{explode=0}={}){
  if(await page.locator('#workspace').isVisible())await page.click('#panel-close');
  await page.locator('#explode').evaluate((e,v)=>{e.value=String(v);e.dispatchEvent(new Event('input',{bubbles:true}));},explode);
  await page.click('#fit');await settle(page,700);
  const raw=path.join(work,path.basename(file));
  await page.locator('#canvas').screenshot({path:raw,style:bare,omitBackground:true});
  execFileSync('magick',[raw,'-trim','+repage','-bordercolor','none','-border','4%x6%','-resize','1600x>','-strip',file]);return file;
}
async function screenshot(page,file,{full=false}={}){
  const raw=path.join(work,path.basename(file,path.extname(file))+'.png');await page.screenshot({path:raw,fullPage:full});
  execFileSync('magick',[raw,'-resize','1600x>','-quality','86','-strip',file]);return file;
}

(async()=>{
  const site=await serve(),browser=await chromium.launch({executablePath:process.env.FLAN36_BROWSER,args:GL});
  const written=[],errors=[];
  try{
    // 1. the hero: Flan36 in SNES with its layers apart, as the home page opens
    let page=await explorer(browser,site,{query:`${LOOK}&case=rim`});
    written.push(await render(page,path.join(images,'revI-assembled.png'),{explode:80}));
    // 2. the four cases, assembled, each in its suggested finish
    for(const style of ['level','solid','rim','terrace']){
      await page.setInputFiles('#load-config',caseDesign(style));await settle(page);
      written.push(await render(page,path.join(images,`revI-case-${style}.png`)));
    }
    errors.push(...page.errors);await page.close();
    // 3. the underside with the Asanoha edition on a black mask
    page=await explorer(browser,site,{query:`${LOOK}&case=rim`});
    await page.click('#editor-tabs [data-panel=pcb]');await page.locator('#panel-pcb .tune[aria-expanded=false]').click();
    await page.click('#pcb-grid [data-edition="asanoha"]');await page.click('#pcb-masks [data-mask="black"]');
    await page.waitForFunction(()=>document.querySelector('#pcb-status').textContent==='',null,{timeout:120000});await settle(page,900);
    written.push(await render(page,path.join(images,'revI-pcb-underside.png')));
    errors.push(...page.errors);await page.close();
    // 4. the explorer as visitors see it: Design, a theme's swatches, and painting single keys
    page=await explorer(browser,site,{query:`${LOOK}&case=rim`,width:1440,height:900});
    await page.locator('#explode').evaluate(e=>{e.value='45';e.dispatchEvent(new Event('input',{bubbles:true}));});await settle(page,700);
    written.push(await screenshot(page,path.join(images,'site-explorer.webp')));
    await page.click('#editor-tabs [data-panel=themes]');await page.click('#panel-themes .tune');await settle(page,900);
    written.push(await screenshot(page,path.join(images,'revI-themes.png')));
    errors.push(...page.errors);await page.close();
    // painting one key: the home row's middle key of the left half, in the frame's accent
    page=await explorer(browser,site,{query:`${LOOK}&case=rim`,width:1440,height:900});
    await page.locator('#explode').evaluate(e=>{e.value='45';e.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.click('#editor-tabs [data-panel=keycaps]');await page.click('#panel-keycaps .tune');await page.click('#cap-mode [data-value=key]');
    await page.locator('#cap-map .cap-key').nth(7).click();await page.fill('#cap-color-hex','#746198');await page.press('#cap-color-hex','Enter');
    await page.mouse.move(700,450);await settle(page,900);
    written.push(await screenshot(page,path.join(images,'revI-key-colors.png')));
    errors.push(...page.errors);await page.close();
    // 5. the home page, its intro finished and the standby motion paused
    page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:2});page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{try{localStorage.clear();}catch{}});
    await page.goto(site.base);await page.waitForSelector('#stage.live',{timeout:120000});await page.evaluate(()=>document.getElementById('standby').click());await settle(page,2500);
    written.push(await screenshot(page,path.join(images,'site-home.webp')));await page.close();
    // 6. both on a phone, side by side
    const phones=[];
    for(const [name,url,ready] of [['home',site.base,'#stage.live'],['explorer',`${site.base}explore/?${LOOK}&case=rim`,'#workspace:not([hidden])']]){
      const p=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});p.on('pageerror',e=>errors.push(e.message));
      await p.addInitScript(()=>{try{localStorage.clear();}catch{}});await p.goto(url);await p.waitForSelector(ready,{timeout:180000});
      if(name==='home')await p.evaluate(()=>document.getElementById('standby').click());else await p.tap('#editor-tabs [data-panel=themes]');
      await settle(p,2500);const f=path.join(work,`phone-${name}.png`);await p.screenshot({path:f});phones.push(f);await p.close();
    }
    const phone=path.join(images,'site-phone.webp');
    execFileSync('magick',[...phones,'-bordercolor','none','-border','24x0','+append','-resize','x1400','-quality','86','-strip',phone]);written.push(phone);
  }finally{await browser.close();site.close();}
  if(errors.length)throw Error('Page errors: '+errors.join('; '));
  const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  const receipt={schema:'flan36-readme-images-2',viewer_sha256:sha(path.join(root,'docs/explore/index.html')),home_sha256:sha(path.join(root,'docs/index.html')),capture_sha256:sha(__filename),
    renderer:process.env.FLAN_GL==='software'?'SwiftShader':'GPU',note:'Rendered from the built site served like GitHub Pages; supersedes the image hashes in earlier delivery receipts.',
    // a list of {path, sha256}: a file name next to its hash reads like a credential to secret scanners
    images:written.map(f=>({path:path.relative(root,f),sha256:sha(f)}))};
  fs.writeFileSync(path.join(root,'validation/revI-readme-images.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify(receipt.images.map(i=>i.path),null,1));
})().catch(e=>{console.error(e);process.exit(1);});
