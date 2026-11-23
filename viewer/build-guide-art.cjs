// SPDX-License-Identifier: GPL-3.0-or-later
// After tools/build_viewer_revI.py, run node viewer/build-guide-art.cjs with the Playwright runtime.
const fs=require('node:fs'),path=require('node:path');
const {build}=require('esbuild'),{chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const scene=JSON.parse(fs.readFileSync(path.join(__dirname,'../build/viewer-scene.json'),'utf8'));
 const parts=scene.parts.filter(p=>p.geometry&&(p.part_id||p.name.endsWith(' K01'))&&!['base','lid'].includes(p.group));
 const shapes=Object.fromEntries([...new Set(parts.map(p=>p.geometry))].filter(id=>scene.geometries[id]).map(id=>[id,scene.geometries[id]]));
 const bundle=await build({entryPoints:[path.join(__dirname,'guide-art-render.js')],bundle:true,format:'iife',globalName:'GuideArt',minify:true,write:false});
 const browser=await chromium.launch({executablePath:process.env.FLAN36_BROWSER,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
 try{
  const page=await browser.newPage();await page.addScriptTag({content:bundle.outputFiles[0].text});
  const images=await page.evaluate(data=>GuideArt.render(data),{parts,shapes});
  for(const [id,uri] of Object.entries(images)){
   if(!uri.startsWith('data:image/webp;base64,'))throw Error('Missing WebP '+id);
   fs.writeFileSync(path.join(__dirname,'../docs/explore/assets/solder/part-'+id+'.webp'),Buffer.from(uri.split(',')[1],'base64'));
  }
  console.log(Object.keys(images).length+' guide illustrations');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
