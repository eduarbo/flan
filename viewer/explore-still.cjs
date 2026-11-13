// The picture the explorer shows while a link to the home page's look loads its meshes: the explorer's own
// frame of that look, at a desktop and a phone size. Run after a build, then build again; the build leaves
// the picture out when the meshes, colours or lighting it was made from have changed.
// FLAN36_PLAYWRIGHT_MODULE=/path/to/playwright-core FLAN36_BROWSER=/path/to/chromium FLAN36_BROWSER_ANGLE=metal node viewer/explore-still.cjs
// FLAN36_BROWSER_ANGLE=metal renders with the GPU, which the lit, shadowed look needs.
// SPDX-License-Identifier: GPL-3.0-or-later
const fs=require('fs'),path=require('path'),serve=require('./serve-docs.cjs');
const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'stills');
(async()=>{
  const receipt=JSON.parse(fs.readFileSync(path.join(root,'validation',fs.readdirSync(path.join(root,'validation')).filter(f=>/^rev[A-Z]+-viewer\.json$/.test(f)).sort().at(-1)),'utf8')).still;
  const server=await serve(),browser=await chromium.launch({executablePath:process.env.FLAN36_BROWSER,args:process.env.FLAN36_BROWSER_ANGLE?['--use-angle='+process.env.FLAN36_BROWSER_ANGLE,'--enable-gpu','--ignore-gpu-blocklist']:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  fs.mkdirSync(out,{recursive:true});
  for(const [shape,viewport,scale] of [['wide',{width:1440,height:900},1],['tall',{width:412,height:823},2]]){
    const page=await browser.newPage({viewport,deviceScaleFactor:scale});await page.addInitScript(()=>{try{localStorage.clear();}catch{}});
    await page.goto(server.base+'explore/?diagnostics&'+new URLSearchParams(receipt.look));await page.waitForSelector('#loading',{state:'hidden',timeout:120000});
    await page.evaluate(()=>window.flan36.settled());await page.waitForTimeout(500);
    if(await page.evaluate(()=>new URLSearchParams(location.search).get('render')==='flat'||!document.querySelector('#canvas')))throw Error('No canvas to capture.');
    const url=await page.evaluate(()=>window.flan36.still());if(!url.startsWith('data:image/webp;base64,'))throw Error('The browser did not return a WebP picture.');
    fs.writeFileSync(path.join(out,shape+'.webp'),Buffer.from(url.split(',')[1],'base64'));await page.close();
    console.log(shape,fs.statSync(path.join(out,shape+'.webp')).size,'bytes');
  }
  fs.writeFileSync(path.join(out,'stills.json'),JSON.stringify({look:receipt.look,fingerprint:receipt.fingerprint},null,1)+'\n');
  await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1);});
