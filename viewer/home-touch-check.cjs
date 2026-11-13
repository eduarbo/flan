// Home page on a touch screen, with real multi-touch input: two fingers pinch the model's zoom without scrolling or
// zooming the page and without turning the model; one finger turns it sideways and still scrolls the page up and down.
// FLAN36_PLAYWRIGHT_MODULE=/path/to/playwright-core FLAN36_BROWSER=/path/to/chromium node viewer/home-touch-check.cjs [url]
// FLAN36_BROWSER_ANGLE=metal draws with the GPU; without it every step waits for slow frames. Chromium only: the fingers
// are the browser's own touch input, sent through its debugging protocol. With a url it reads that
// page (the published one, say) instead of serving docs/. It is not a test on a phone, and not on Safari.
// SPDX-License-Identifier: GPL-3.0-or-later
const assert=require('assert'),serve=require('./serve-docs.cjs');
const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
const out={};
(async()=>{
  const server=process.argv[2]?{base:process.argv[2],close(){}}:await serve();
  const browser=await chromium.launch({executablePath:process.env.FLAN36_BROWSER,args:process.env.FLAN36_BROWSER_ANGLE?['--use-angle='+process.env.FLAN36_BROWSER_ANGLE,'--enable-gpu','--ignore-gpu-blocklist']:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:412,height:823},deviceScaleFactor:2,isMobile:true,hasTouch:true}),page=await context.newPage(),cdp=await context.newCDPSession(page),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(server.base+'?diagnostics',{timeout:120000});await page.waitForSelector('#stage.live',{timeout:120000});
  // still model: the intro has finished and the standby motion is paused
  // (without a GPU the standby motion is already off: pressing the button there would start it)
  await page.evaluate(()=>{const b=document.getElementById('standby');if(b.getAttribute('aria-pressed')==='true')b.click();});await page.waitForTimeout(4000);
  const state=()=>page.evaluate(()=>({...window.flanHome.info().view,scroll:Math.round(scrollY),pageZoom:visualViewport.scale}));
  // what the page's script did with each move: with two fingers it must take the gesture itself (Safari zooms the page otherwise);
  // with one it must leave the move alone, so the page scrolls without waiting for it
  await page.evaluate(()=>{window.__moves={held:0,free:0,one:0,oneHeld:0};addEventListener('touchmove',e=>{const m=window.__moves;if(e.touches.length>=2)m[e.defaultPrevented?'held':'free']++;else{m.one++;if(e.defaultPrevented)m.oneHeld++;}},{passive:true});});
  const moves=()=>page.evaluate(()=>{const m=window.__moves;window.__moves={held:0,free:0,one:0,oneHeld:0};return m;});
  const box=await page.locator('#stage').boundingBox(),cx=box.x+box.width/2,cy=box.y+box.height/2;
  // fingers as [x, y, id]; a touchEnd names the fingers that lift, and an empty one lifts them all
  const touch=async(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y,id])=>({x:Math.round(x),y:Math.round(y),id,radiusX:6,radiusY:6,force:1}))});
  const glide=async(from,to,steps=14)=>{for(let i=1;i<=steps;i++){const t=i/steps;await touch('touchMove',from.map(([x,y,id],n)=>[x+(to[n][0]-x)*t,y+(to[n][1]-y)*t,id]));await page.waitForTimeout(16);}};
  // the turn eases out over some frames, and frames are slow without a GPU: wait until the view stands still
  const settle=async()=>{let last='',same=0;for(let i=0;i<120;i++){await page.waitForTimeout(250);const v=await state(),now=[v.azimuth,v.polar,v.zoom].map(n=>n.toFixed(4))+' '+v.scroll;same=now===last?same+1:0;if(same===3)return;last=now;}throw Error('the view never came to rest');};
  out.start=await state();assert.equal(out.start.zoom,1);
  // two fingers apart: the model grows; the page neither scrolls nor zooms, the model does not turn
  let a=[[cx-40,cy,0],[cx+40,cy,1]],b=[[cx-120,cy,0],[cx+120,cy,1]];
  await touch('touchStart',[a[0]]);await touch('touchStart',a);await glide(a,b);await touch('touchEnd',[]);await settle();out.pinchOut=await state();
  // three times the spread, held at the phone layout's limit so the model stays clear of the options under it
  assert.equal(out.pinchOut.zoom,2.5,'pinching apart zooms in, up to the phone limit: '+out.pinchOut.zoom);
  out.pinchMoves=await moves();assert(out.pinchMoves.held>5&&out.pinchMoves.free===0,'every two-finger move is taken by the model: '+JSON.stringify(out.pinchMoves));
  assert.equal(out.pinchOut.scroll,out.start.scroll);assert.equal(out.pinchOut.pageZoom,1);
  assert(Math.abs(out.pinchOut.azimuth-out.start.azimuth)<.02&&Math.abs(out.pinchOut.polar-out.start.polar)<.02,'a pinch does not turn the model');
  // together again, drifting down the screen as fingers do: the page stays where it is
  a=[[cx-120,cy-40,0],[cx+120,cy-40,1]];b=[[cx-45,cy+50,0],[cx+45,cy+50,1]];
  await touch('touchStart',[a[0]]);await touch('touchStart',a);await glide(a,b);await touch('touchEnd',[]);await settle();out.pinchIn=await state();
  assert(out.pinchIn.zoom<out.pinchOut.zoom*.5,'pinching together zooms out: '+out.pinchIn.zoom);assert.equal(out.pinchIn.scroll,out.start.scroll);assert.equal(out.pinchIn.pageZoom,1);
  assert(Math.abs(out.pinchIn.azimuth-out.start.azimuth)<.02,'a drifting pinch does not turn the model');
  // after a pinch, the finger that stays turns the model from where it is, without a jump
  a=[[cx-60,cy,0],[cx+60,cy,1]];b=[[cx-80,cy,0],[cx+80,cy,1]];
  await touch('touchStart',[a[0]]);await touch('touchStart',a);await glide(a,b,6);await touch('touchEnd',[b[1]]);await page.waitForTimeout(60);out.lifted=await state();
  assert(Math.abs(out.lifted.azimuth-out.start.azimuth)<.02,'lifting one finger does not turn the model');
  await glide([b[0]],[[cx+10,cy,0]]);await touch('touchEnd',[]);await settle();out.thenTurned=await state();
  assert(Math.abs(out.thenTurned.azimuth-out.start.azimuth)>.15,'the finger that stays turns the model');
  // a third finger joins and leaves: the page stays held, and the two that remain pinch again
  await moves();a=[[cx-50,cy,0],[cx+50,cy,1]];const third=[cx,cy+70,2];
  await touch('touchStart',[a[0]]);await touch('touchStart',a);await touch('touchStart',[...a,third]);await glide([...a,third],[[cx-50,cy+40,0],[cx+50,cy+40,1],[cx,cy+110,2]],6);
  out.three={...await state(),moves:await moves()};assert.equal(out.three.scroll,out.start.scroll);assert(out.three.moves.held>2&&out.three.moves.free===0,'three fingers do not scroll the page');assert.equal(out.three.zoom,out.thenTurned.zoom);
  await touch('touchEnd',[[cx,cy+110,2]]);b=[[cx-100,cy+40,0],[cx+100,cy+40,1]];await glide([[cx-50,cy+40,0],[cx+50,cy+40,1]],b,8);await touch('touchEnd',[]);await settle();out.twoAgain=await state();
  assert(out.twoAgain.zoom>out.three.zoom*1.5,'the two fingers that remain pinch again: '+out.twoAgain.zoom);
  // one finger sideways turns the model; the page stays
  const before=await state();
  await touch('touchStart',[[cx-70,cy,0]]);await glide([[cx-70,cy,0]],[[cx+80,cy+6,0]]);await touch('touchEnd',[]);await settle();out.turn=await state();
  assert(Math.abs(out.turn.azimuth-before.azimuth)>.2,'a sideways drag turns the model');assert.equal(out.turn.scroll,out.start.scroll);
  // so does a drag that starts on the hint under the model: the hint is not in the way
  const hint=await page.locator('.chip.hint').boundingBox(),hy=hint.y+hint.height/2;
  await touch('touchStart',[[hint.x+20,hy,0]]);await glide([[hint.x+20,hy,0]],[[hint.x+150,hy,0]]);await touch('touchEnd',[]);await settle();out.fromHint=await state();
  assert(Math.abs(out.fromHint.azimuth-out.turn.azimuth)>.2,'a drag from the hint turns the model');
  // one finger down the screen scrolls the page and leaves the model alone
  await touch('touchStart',[[cx,cy+60,0]]);await glide([[cx,cy+60,0]],[[cx+4,cy-180,0]]);await touch('touchEnd',[]);await settle();out.swipe=await state();
  assert(out.swipe.scroll>out.start.scroll+100,'a vertical swipe on the model scrolls the page: '+out.swipe.scroll);
  out.oneFinger=await moves();assert.equal(out.oneFinger.oneHeld,0,'one-finger moves are never held by the script');
  assert(Math.abs(out.swipe.azimuth-out.fromHint.azimuth)<.05,'a vertical swipe does not turn the model');
  // the buttons beside the hint still work
  await page.evaluate(()=>scrollTo(0,0));const paused=await page.getAttribute('#standby','aria-pressed');await page.tap('#standby');assert.notEqual(await page.getAttribute('#standby','aria-pressed'),paused,'the pause button takes a tap');
  // the cube puts the view back
  await page.evaluate(()=>scrollTo(0,0));await page.tap('#reset');await settle();out.reset=await state();assert.equal(out.reset.zoom,1);
  assert.deepEqual(errors,[]);
  await browser.close();server.close();console.log(JSON.stringify(out,null,1));console.log('home touch ok');
})().catch(e=>{console.error(e);console.error(JSON.stringify(out));process.exit(1);});
