// Check the contact edge at display resolution on a light background. Run against a built viewer.
// FLAN36_PLAYWRIGHT_MODULE=... FLAN36_BROWSER=... FLAN36_BROWSER_ANGLE=metal node viewer/floor-shadow-check.cjs
// SPDX-License-Identifier: GPL-3.0-or-later
const assert=require('node:assert/strict');
const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
const serve=require('./serve-docs.cjs');

function measure(){
  const api=window.flan36,canvas=document.getElementById('canvas');
  const copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;
  const ctx=copy.getContext('2d',{willReadFrequently:true});
  function pixels(ground){
    api.ground(ground);api.still();ctx.clearRect(0,0,copy.width,copy.height);ctx.drawImage(canvas,0,0);
    return ctx.getImageData(0,0,copy.width,copy.height).data;
  }
  const floor=pixels(true),model=pixels(false);api.ground(true);
  const w=copy.width,h=copy.height,edge=new Int32Array(w).fill(-1);
  let left=w,right=0;
  for(let x=Math.ceil(w/2);x<w;x++){
    for(let y=h-1;y>=0;y--)if(model[(y*w+x)*4+3]>127){edge[x]=y;left=Math.min(left,x);right=Math.max(right,x);break;}
  }
  // Follow two continuous arcs along the front of the right base, clear of the thumb notch and corners.
  let square=0,sum=0,count=0;
  const weights=Array.from({length:17},(_,i)=>Math.exp(-((i-8)**2)/32)),weight=weights.reduce((a,b)=>a+b);
  for(const [lo,hi] of [[.11,.42],[.84,.93]]){
    const start=Math.ceil(left+(right-left)*lo),end=Math.floor(left+(right-left)*hi);
    for(let dy=2;dy<=12;dy++){
      const profile=[];
      for(let x=start;x<=end;x++){
        const y=edge[x];if(y<0||y+dy+1>=h)throw Error('Contact contour is out of frame.');
        const i=4*(y*w+x)+3;
        const f=(model[i]-127.5)/Math.max(1,model[i]-model[i+4*w]);
        const j=i+4*w*dy;profile.push(floor[j]*(1-f)+floor[j+4*w]*f);
      }
      for(let i=8;i<profile.length-8;i++){
        let smooth=0;for(let j=0;j<weights.length;j++)smooth+=weights[j]*profile[i+j-8];
        square+=(profile[i]-smooth/weight)**2;sum+=profile[i];count++;
      }
    }
  }
  return {samples:count,roughness:Math.sqrt(square/count),opacity:sum/count};
}

(async()=>{
  const server=await serve();
  let browser;
  try{
    const angle=process.env.FLAN36_BROWSER_ANGLE;
    browser=await chromium.launch({executablePath:process.env.FLAN36_BROWSER,args:[...(angle?['--use-angle='+angle]:[]),'--enable-gpu','--ignore-gpu-blocklist']});
    const page=await browser.newPage({viewport:{width:1344,height:825},deviceScaleFactor:2,reducedMotion:'reduce'});
    // Seed the noise textures so repeated runs measure the same sampling pattern.
    await page.addInitScript(()=>{let seed=3041;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);});
    await page.goto(server.base+'explore/?theme=desert&size=flan36&case=rim&keys=original&diagnostics');
    await page.waitForFunction(()=>window.flan36?.settled,null,{timeout:120000});await page.evaluate(()=>flan36.settled());
    if(await page.locator('#panel-close').isVisible())await page.locator('#panel-close').click();
    await page.evaluate(async()=>{
      await Promise.all(document.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations===1).map(a=>a.finished.catch(()=>{})));
      await flan36.settled();
    });
    const initial=await page.evaluate(()=>flan36.snapshot().camera.zoom);
    for(const close of [false,true]){
      if(close){
        const box=await page.locator('#canvas').boundingBox();await page.mouse.move(box.x+box.width*.55,box.y+box.height*.58);
        await page.mouse.wheel(0,-270);await page.waitForFunction(start=>flan36.snapshot().camera.zoom>start,initial);
      }
      const result=await page.evaluate(measure);console.log(close?'Close':'Fitted',result);
      assert(result.samples>1000&&result.opacity>85,'The contact shadow must be present below the base.');
      assert(result.roughness<1.7,'The contact edge must fade smoothly along the base.');
    }
  }finally{await browser?.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
