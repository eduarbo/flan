// Real images for the explorer R1 mockups: the home's live option thumbnails and spec art, the explorer's
// PCB edition thumbnails, and the model alone (canvas only) in SNES and 2000s Phone, apart and assembled.
// FLAN36_PLAYWRIGHT_MODULE=… FLAN36_BROWSER=… node design/proposals/explorer-r1/src/capture.cjs
const fs=require('fs'),path=require('path'),serve=require('../../../../viewer/serve-docs.cjs');
const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
const out=path.resolve(__dirname,'../assets');fs.mkdirSync(out,{recursive:true});
const save=(name,dataUrl)=>fs.writeFileSync(path.join(out,name),Buffer.from(dataUrl.split(',')[1],'base64'));
(async()=>{
  const s=await serve(),b=await chromium.launch({executablePath:process.env.FLAN36_BROWSER,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
  const look=theme=>JSON.stringify({size:'flan36',theme,case:'rim',keys:'original',frame:theme==='phone'?{left:'phone',right:'phone'}:{left:'snes',right:'snes'},own:{left:false,right:false}});
  for(const theme of ['snes','phone']){
    const p=await b.newPage({viewport:{width:1440,height:900},deviceScaleFactor:2});
    await p.addInitScript(l=>{try{localStorage.setItem('flan.home.look',l);}catch{}},look(theme));
    await p.goto(s.base);await p.waitForSelector('#stage.live');
    await p.evaluate(()=>document.querySelector('.specs').scrollIntoView());
    await p.waitForFunction(()=>[...document.querySelectorAll('.opt img, .art img')].every(i=>i.src),null,{timeout:120000});
    // every thumbnail as a PNG, from its blob
    const imgs=await p.evaluate(()=>{const r=[];for(const img of document.querySelectorAll('.opt img, .art img')){
      const key=img.closest('[data-value]')?`${img.closest('[data-control],.opts,.sw')?.id||''}-${img.closest('[data-value]').dataset.value}`:'art-'+[...img.closest('.art').classList].join('-');
      // the page's CSP allows blob: images but not fetches: copy each through a canvas
      const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext('2d').drawImage(img,0,0);r.push([key,c.toDataURL('image/png')]);}return r;});
    for(const [k,v] of imgs)if(v.startsWith('data:image/png'))save(`${theme}-${k.replace(/^o-/,'').replace(/\s+/g,'-')}.png`,v);
    await p.evaluate(()=>scrollTo(0,0));
    // the model alone: apart (the standby pose, paused) and assembled
    await p.evaluate(()=>document.getElementById('standby').click());await p.waitForTimeout(2500);
    const only='html,body,.hero::before{background:transparent!important}.hero>*:not(.stage),.stage>*:not(canvas),.stage::before,main,footer{visibility:hidden!important}';
    const tag=await p.addStyleTag({content:only});
    await p.locator('#canvas').screenshot({path:path.join(out,`${theme}-model-apart.png`),omitBackground:true});
    await tag.evaluate(t=>t.remove());
    await p.focus('#explode');await p.keyboard.press('Home');await p.waitForTimeout(1500);
    await p.addStyleTag({content:only});await p.locator('#canvas').screenshot({path:path.join(out,`${theme}-model-together.png`),omitBackground:true});
    await p.close();
  }
  // the explorer's PCB edition thumbnails
  const e=await b.newPage({viewport:{width:1440,height:900}});await e.goto(s.base+'explore/');await e.waitForSelector('#loading',{state:'hidden',timeout:300000});
  const pcb=await e.$$eval('#pcb-grid img',imgs=>imgs.map(i=>[i.closest('[data-edition],[data-choice]')?.dataset.edition||i.closest('button')?.dataset.choice||i.alt,i.src]));
  for(const [k,v] of pcb)if(v.startsWith('data:image/png'))save(`pcb-${k}.png`,v);
  console.log(JSON.stringify({files:fs.readdirSync(out).length,pcb:pcb.map(x=>x[0])}));
  await b.close();s.close();
})().catch(e=>{console.error(e);process.exit(1);});
