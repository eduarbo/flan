// Home page frame pacing on the real GPU: load, intro, standby, a drag and a theme change, at a retina
// desktop size. Writes build/home-performance.json.
// FLAN36_PLAYWRIGHT_MODULE=/path/to/playwright-core FLAN36_BROWSER=/path/to/chromium [FLAN_GL=software] node viewer/home-performance.cjs [url]
// SPDX-License-Identifier: GPL-3.0-or-later
const fs=require('fs'),path=require('path'),serve=require('./serve-docs.cjs');
const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
(async()=>{
  const server=process.argv[2]?{base:process.argv[2],close(){}}:await serve();
  // FLAN_GL=software measures the worst case: a browser without hardware acceleration
  const gl=process.env.FLAN_GL==='software'?['--use-angle=swiftshader','--enable-unsafe-swiftshader']:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'];
  const browser=await chromium.launch({executablePath:process.env.FLAN36_BROWSER,args:gl});
  const out={};
  for(const [name,w,h,dpr] of [['desktop',1920,1080,2],['laptop',1440,900,2]]){
    const p=await browser.newPage({viewport:{width:w,height:h},deviceScaleFactor:dpr});const errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.addInitScript(()=>{window.__long=[];try{new PerformanceObserver(l=>{for(const e of l.getEntries())window.__long.push([Math.round(e.startTime),Math.round(e.duration)]);}).observe({type:'longtask',buffered:true});}catch{}});
    const t0=Date.now();await p.goto(server.base,{timeout:120000});await p.waitForSelector('#stage.live',{timeout:120000});const live=Date.now()-t0;
    const measure=ms=>p.evaluate(ms=>new Promise(r=>{const times=[];let last=performance.now();const end=last+ms;const f=n=>{times.push(n-last);last=n;if(n<end)requestAnimationFrame(f);else{const s=[...times].sort((a,b)=>a-b);r({fps:Math.round(times.length/(ms/1000)),median:+s[s.length>>1].toFixed(1),p95:+s[Math.floor(s.length*.95)].toFixed(1),max:+s.at(-1).toFixed(1)});}};requestAnimationFrame(f);}),ms);
    const r={live_ms:live,intro:await measure(2500)};await p.waitForTimeout(3000);r.standby=await measure(3000);
    const box=await p.locator('#canvas').boundingBox();
    const drag=(async()=>{await p.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await p.mouse.down();for(let i=0;i<60;i++){await p.mouse.move(box.x+box.width*(.5-i*.004),box.y+box.height*.5);}await p.mouse.up();})();
    r.drag=await measure(1500);await drag;
    await p.click('#o-theme [data-value=gameboy]');r.theme=await measure(3000);
    r.longtasks=await p.evaluate(()=>window.__long);r.canvas=await p.evaluate(()=>{const c=document.getElementById('canvas');return [c.width,c.height];});r.errors=errors;
    out[name]=r;await p.close();
  }
  fs.writeFileSync(path.resolve(__dirname,`../build/home-performance${process.env.FLAN_GL==='software'?'-software':''}.json`),JSON.stringify(out,null,1));console.log(JSON.stringify(out,null,1));
  await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1);});
