// Capture the README images from the built offline viewer, so they always show the current design.
// FLAN36_PLAYWRIGHT_MODULE=/path/to/playwright-core FLAN36_BROWSER=/path/to/chromium node viewer/capture-readme.cjs
// SPDX-License-Identifier: GPL-3.0-or-later
const fs=require('fs'),path=require('path'),{pathToFileURL}=require('url'),{execFileSync}=require('child_process');
const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),images=path.join(root,'docs/images');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'keycaps/catalog.json'),'utf8'));
const hide='.stage > :not(canvas){visibility:hidden!important}';

async function viewer(browser,{width,height}){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1.5});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(root,'docs/explore/offline.html')).href);
  await page.waitForSelector('#loading',{state:'hidden',timeout:180000});
  page.errors=errors;return page;
}
const settle=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,400)))));
async function open(page,panel){await page.click('.app-nav [data-mode="customize"]');await page.click(`[data-panel="${panel}"]`);await settle(page);}
async function close(page){if(await page.locator('#workspace').isVisible())await page.click('#panel-close');await settle(page);}
// Fit, capture the canvas without floating controls, then trim to the model with an even margin.
async function shot(page,file){
  await page.click('#fit');await settle(page);await page.locator('#canvas').screenshot({path:file,style:hide});
  execFileSync('magick',[file,'-fuzz','2%','-trim','+repage','-bordercolor','#eef0f3','-border','7%x10%','-strip',file]);return file;
}
// Each case with its own suggested finish, loaded through Files → Load JSON like a saved design.
function caseDesign(style){
  const c=JSON.parse(JSON.stringify(catalog.default_configuration)),spec=catalog.case_styles[style];
  if(style!=='level')for(const side of ['left','right'])Object.assign(c.cases[side],{style,base_color:spec.base_color,plate_color:spec.plate_color,match_frame:false});
  return {name:`flan36-${style}.json`,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(c))};
}

(async()=>{
  const browser=await chromium.launch({executablePath:process.env.FLAN36_BROWSER,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const written=[];
  // 1. the default design, as it opens
  let page=await viewer(browser,{width:1600,height:1060});
  written.push(await shot(page,path.join(images,'revI-assembled.png')));
  // 2. the other three cases (the default design above is Level)
  const cases=await page.$$eval('#case-grid [data-case]',b=>b.map(x=>[x.dataset.case,x.textContent.trim()]));
  for(const [id] of cases){if(id==='level')continue;await page.setInputFiles('#load-config',caseDesign(id));await settle(page);await close(page);written.push(await shot(page,path.join(images,`revI-case-${id}.png`)));}
  await page.close();
  // 3. the underside with a silkscreen edition and mask colour
  page=await viewer(browser,{width:1600,height:1060});
  await open(page,'pcb');await page.click('#pcb-grid [data-edition="asanoha"]');await page.click('#pcb-masks [data-mask="black"]');
  await page.waitForFunction(()=>document.querySelector('#pcb-status').textContent==='',null,{timeout:60000});await close(page);
  written.push(await shot(page,path.join(images,'revI-pcb-underside.png')));
  const errors=page.errors;await browser.close();
  if(errors.length)throw Error('Viewer errors: '+errors.join('; '));
  const sha=f=>require('crypto').createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  const receipt={schema:'flan36-readme-images-1',viewer_sha256:sha(path.join(root,'docs/explore/offline.html')),capture_sha256:sha(__filename),
    note:'Rendered from docs/explore/offline.html with SwiftShader; supersedes the case and assembled image hashes in earlier delivery receipts.',
    images:Object.fromEntries(written.map(f=>[path.relative(root,f),sha(f)]))};
  fs.writeFileSync(path.join(root,'validation/revI-readme-images.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify({cases,written:Object.keys(receipt.images)},null,1));
})().catch(e=>{console.error(e);process.exit(1);});
