// Home page configurator renders: every size × theme × keycap shape × case style, from the built
// offline viewer, with the viewer's own config and theme code. One camera and one crop per size, so
// swapping a theme, keycaps or case never moves the keyboard. Transparent WebP in docs/images/showcase/.
// FLAN36_PLAYWRIGHT_MODULE=/path/to/playwright-core FLAN36_BROWSER=/path/to/chromium node viewer/capture-showcase.cjs
// SPDX-License-Identifier: GPL-3.0-or-later
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/images/showcase'),work=path.join(root,'build/showcase',process.env.FLAN_SIZES||'all');
fs.mkdirSync(work,{recursive:true});
require('esbuild').buildSync({stdin:{contents:"export {normalize} from './config.js';export {applyTheme} from './appearance.js';",resolveDir:__dirname,loader:'js'},
  bundle:true,platform:'node',format:'cjs',outfile:path.join(work,'helpers.cjs'),logLevel:'error'});
const {normalize,applyTheme}=require(path.join(work,'helpers.cjs'));
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p)));
const catalog=read('keycaps/catalog.json'),themes=Object.fromEntries(read('design/themes.json').themes.map(t=>[t.id,t]));
const SIZES=['flan36','flan42','flan46','flan54'],THEMES=['snes','flan','talavera','gameboy','nes','walkman','phone','manga'];
const KEYCAPS={original:'default',normal:'normal-sculpted',saddle:'saddle-sculpted'},CASES=['rim','solid','terrace','level'];
const presets=Object.fromEntries(Object.entries(KEYCAPS).map(([k,f])=>[k,read(`design/configurations/${f}.json`)]));
function design(size,theme,keys,style){
  let c=normalize(structuredClone(catalog.default_configuration),catalog);c.variant=size;
  for(const side of ['left','right']){
    for(const ref of Object.keys(c.keycaps[side]))c.keycaps[side][ref]={...presets[keys].keycaps[side][ref],color:c.keycaps[side][ref].color};
    c.cases[side].style=style;c.frames[side].style=themes[theme].recommended_frame;
  }
  return applyTheme(c,themes[theme],['left','right']);
}
const hide='.stage > :not(canvas){visibility:hidden!important}body{background:#eef0f3!important}';
const settle=p=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,250)))));
(async()=>{
  const b=await chromium.launch({executablePath:process.env.FLAN36_BROWSER,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const p=await b.newPage({viewport:{width:1400,height:900},deviceScaleFactor:1.5});const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('file://'+path.join(root,'docs/explore/offline.html')+'?diagnostics');await p.waitForSelector('#loading',{state:'hidden',timeout:400000});await p.waitForFunction(()=>window.flan36);await p.evaluate(()=>window.flan36.ground(false));
  const load=async c=>{await p.setInputFiles('#load-config',{name:'showcase.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(c))});await settle(p);};
  const manifest={schema:'flan-showcase-1',sizes:SIZES,themes:THEMES.map(id=>({id,name:themes[id].name,swatch:[themes[id].base,themes[id].plate,themes[id].frame.accent]})),
    keycaps:Object.keys(KEYCAPS),cases:CASES,default:{size:'flan36',theme:'snes',keycaps:'original',case:'rim'},images:{}};
  for(const size of SIZES)for(const theme of THEMES)for(const keys of Object.keys(KEYCAPS))for(const style of CASES)
    manifest.images[`${size}/${theme}/${keys}/${style}`]=`${size}/${theme}-${keys}-${style}.webp`;
  fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,1)+'\n');
  // FLAN_SIZES=flan42,flan46 renders only those sizes, so sizes can run in parallel processes
  const mine=process.env.FLAN_SIZES?process.env.FLAN_SIZES.split(','):SIZES;
  let n=0;
  for(const size of mine){
    fs.mkdirSync(path.join(out,size),{recursive:true});
    // the size's camera: the default look, framed once
    await load(design(size,'snes','original','rim'));
    await p.waitForFunction(t=>document.getElementById('size-current').textContent===t,size.replace('flan','Flan'),{timeout:180000});
    await p.click('[data-view="iso"]');await p.click('#fit');await settle(p);
    let crop=null;
    for(const theme of THEMES)for(const keys of Object.keys(KEYCAPS))for(const style of CASES){
      const name=`${size}/${theme}-${keys}-${style}.webp`;
      if(crop&&fs.existsSync(path.join(out,name))){n++;continue;}      // resumable: the first view always sets the crop
      await load(design(size,theme,keys,style));
      const png=path.join(work,'shot.png');await p.locator('#canvas').screenshot({path:png,style:hide,timeout:180000});
      if(!crop){const [w,h,x,y]=execFileSync('magick',[png,'-fuzz','2%','-format','%@','info:']).toString().match(/\d+/g).map(Number);
        const m=Math.round(Math.max(w,h)*.04);crop=`${w+2*m}x${h+2*m}+${Math.max(0,x-m)}+${Math.max(0,y-m)}`;}
      execFileSync('magick',[png,'-crop',crop,'+repage','-alpha','set','-fuzz','2.5%','-fill','none','-draw','color 0,0 floodfill','-strip','-quality','86',path.join(out,name)]);
      n++;
      if(n%24===0)console.log(n,'renders');
    }
  }
  console.log(JSON.stringify({renders:n,errors}));await b.close();
  if(errors.length)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
