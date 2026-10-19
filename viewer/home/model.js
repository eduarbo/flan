// SPDX-License-Identifier: GPL-3.0-or-later
// The home page's live keyboard: packs from viewer/home-build.mjs, coloured by theme exactly as the
// explorer's applyTheme() does, with an intro that separates the layers and a gentle standby motion.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {toCreasedNormals} from 'three/addons/utils/BufferGeometryUtils.js';
import {gunzipSync} from 'three/addons/libs/fflate.module.js';
import {MeshoptDecoder} from 'meshoptimizer/decoder';
import finishes from '../../design/frame-finishes.json';

const SIDES=['left','right'],TAU=Math.PI*2,EXPLODED=.75;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
// keycap colours, as viewer/keycap-colors.js paletteColor()
export const capColor=(palette,key)=>key.row===3?palette.thumbs[key.col]:palette.pattern==='rows'?palette.colors[key.row]:palette.base;
export function framePalette(look,theme,side){
  const own=look.own?.[side]&&finishes.styles[look.frame[side]]?.colors;
  const p=own?Object.fromEntries(Object.entries(own).map(([k,v])=>[k,v.toLowerCase()])):{...theme.frame};
  return finishes.roles.map(role=>p[role]||p.body);
}

async function fetchPack(url){
  const response=await fetch(url);if(!response.ok)throw Error(`${url}: ${response.status}`);
  const bytes=gunzipSync(new Uint8Array(await response.arrayBuffer())),view=new DataView(bytes.buffer,bytes.byteOffset);
  const length=view.getUint32(0,true),header=JSON.parse(new TextDecoder().decode(bytes.subarray(4,4+length)));
  const blob=bytes.subarray(4+length),cache=new Map();
  header.mesh=id=>{
    if(cache.has(id))return cache.get(id);
    const m=header.meshes[id];if(!m)throw Error('Mesh unavailable: '+id);
    const vb=new Uint8Array(m.v*8),ib=new Uint8Array(m.i*m.s);
    MeshoptDecoder.decodeVertexBuffer(vb,m.v,8,blob.subarray(m.vb[0],m.vb[0]+m.vb[1]));
    MeshoptDecoder.decodeIndexBuffer(ib,m.i,m.s,blob.subarray(m.ib[0],m.ib[0]+m.ib[1]));
    const q=new Uint16Array(vb.buffer),p=new Float32Array(m.v*3);
    for(let i=0;i<m.v;i++)for(let a=0;a<3;a++)p[i*3+a]=m.b[a]+q[i*4+a]/65535*(m.b[a+3]-m.b[a]);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));
    g.setIndex(new THREE.BufferAttribute(m.s===2?new Uint16Array(ib.buffer):new Uint32Array(ib.buffer),1));
    for(const [start,count,material] of m.g||[])g.addGroup(start,count,material);
    // the explorer's normals: creased at 45°
    const geometry=toCreasedNormals(g,Math.PI/4);geometry.computeBoundingBox();g.dispose();
    cache.set(id,geometry);return geometry;
  };
  return header;
}
// the explorer's illustrative LCD content
function screenMesh(screen){
  const geometry=new THREE.PlaneGeometry(screen.size[0],screen.size[2]);geometry.rotateX(-Math.PI/2);
  const art=document.createElement('canvas');art.width=128;art.height=300;
  const ctx=art.getContext('2d');ctx.fillStyle=screen.color;ctx.fillRect(0,0,128,300);
  ctx.fillStyle='#294234';ctx.textAlign='center';ctx.font='23px monospace';
  screen.text.split(' / ').forEach((text,i)=>ctx.fillText(text,64,65+i*87));
  const texture=new THREE.CanvasTexture(art);texture.colorSpace=THREE.SRGBColorSpace;
  return new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map:texture}));
}
function lights(scene){
  scene.add(new THREE.HemisphereLight('#ffffff','#9cafa0',2));
  for(const [pos,power] of [[[20,250,160],2.4],[[-220,100,-180],1.1],[[360,30,20],.7],[[30,-300,60],1.9]]){
    const light=new THREE.DirectionalLight('#ffffff',power);light.position.fromArray(pos);scene.add(light);
  }
}
const surface=color=>new THREE.MeshStandardMaterial({color,roughness:.78,metalness:0});

export function createModel({canvas,frame:area=canvas,packs,onChange=()=>{}}){
  // A browser without hardware acceleration renders on the CPU: find out before creating the context,
  // then skip antialiasing, render smaller and keep still until the reader moves the keyboard.
  const software=(()=>{try{const g=document.createElement('canvas').getContext('webgl2'),i=g?.getExtension('WEBGL_debug_renderer_info'),
    name=i?g.getParameter(i.UNMASKED_RENDERER_WEBGL):'';g?.getExtension('WEBGL_lose_context')?.loseContext();return /swiftshader|llvmpipe|software|basic render/i.test(name);}catch{return false;}})();
  const renderer=new THREE.WebGLRenderer({canvas,antialias:!software,alpha:true,powerPreference:'high-performance'});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0,0);
  // Resolution follows the frame rate: start sharp but not at full retina, step down while frames run
  // long, up once when there is room.
  const quality={max:Math.min(devicePixelRatio,software?.75:1.75),ratio:Math.min(devicePixelRatio,software?.6:1.5),min:software?.5:.75,samples:[],raised:false};
  renderer.setPixelRatio(quality.ratio);
  const scene=new THREE.Scene();lights(scene);
  const camera=new THREE.PerspectiveCamera(20,1,10,6000);
  const controls=new OrbitControls(camera,canvas);
  Object.assign(controls,{enablePan:false,enableZoom:false,enableDamping:true,dampingFactor:.08,rotateSpeed:.7,minPolarAngle:.18,maxPolarAngle:1.42});
  // vertical swipes keep scrolling the page; a horizontal drag turns the keyboard
  canvas.style.touchAction='pan-y';
  const turntable=new THREE.Group(),model=new THREE.Group();turntable.add(model);scene.add(turntable);
  const sizes={},state={onscreen:true,look:null,theme:null,explode:0,target:EXPLODED,standby:!reduced.matches&&!software,interacting:false,idle:0,amp:0,phase:0,ready:false};
  let common,objects=[],tweens=[];

  const load=id=>sizes[id]??=fetchPack(packs[id]);
  async function init(look,theme){
    await MeshoptDecoder.ready;
    [common]=await Promise.all([fetchPack(packs.common),load(look.size)]);
    for(const p of common.parts){
      const mesh=p.kind==='screen'?screenMesh(p.screen):new THREE.Mesh(undefined,p.kind==='fixed'&&p.c.length>1?p.c.map(surface):surface(p.c?.[0]||'#888'));
      mesh.position.fromArray(p.p);mesh.rotation.y=THREE.MathUtils.degToRad(p.a);mesh.userData={...p,base:[...p.p]};
      if(p.kind==='fixed'||p.kind==='battery')mesh.geometry=common.mesh(p.kind==='battery'?`${p.side}-battery`:p.mesh);
      if(p.kind==='frame')mesh.material=finishes.roles.map(()=>surface('#ffffff'));
      model.add(mesh);objects.push(mesh);
    }
    instance();
    await apply(look,theme,{animate:false});
    // the keyboard's own centre, fitted with its layers apart so the frame never jumps
    measure();resetView();
    await renderer.compileAsync(scene,camera).catch(()=>{});
    state.ready=true;state.explode=reduced.matches||software?EXPLODED:0;state.target=EXPLODED;place();
    // the other sizes in the background, so a size change is instant
    for(const id of Object.keys(packs))if(id!=='common')load(id).catch(()=>{});
    loop();
  }
  // Size, case style, keycap shape and frames swap geometry at once; colours ease when animate is set.
  async function apply(look,theme,{animate=true}={}){
    const pack=await load(look.size);
    state.look=look;state.theme=theme;const next=[];
    for(const o of objects){
      const p=o.userData;o.visible=!p.v||p.v.includes(look.size);
      let colors=null;
      if(p.kind==='case'){
        const style=look.case,group=p.group;o.geometry=pack.mesh(`${p.side}-case-${style}-${group}`);
        colors=[group==='base'?theme.base:style==='level'?theme.frame.body:theme.plate];
      }else if(p.kind==='pcb'){o.geometry=pack.mesh(`${p.side}-pcb`);colors=[common.masks.find(m=>m[0]==='green')[1]];}
      else if(p.kind==='frame'){o.geometry=common.mesh(`${p.side}-frame-${look.frame[p.side]}`);colors=framePalette(look,theme,p.side);}
      else if(p.kind==='cap'){
        const [variant,turn]=common.presets[look.keys][p.side][p.k],cap=common.caps[variant],key=common.layout[p.side][p.k];
        o.geometry=common.mesh(cap.mesh);o.rotation.y=THREE.MathUtils.degToRad(key.angle+turn);p.base[1]=cap.seat;
        colors=[capColor(theme.keycaps,key)];
      }
      if(colors)next.push([o,colors]);
    }
    tweens=[];
    for(const [o,colors] of next){
      const mats=Array.isArray(o.material)?o.material:[o.material];
      mats.forEach((m,i)=>{const to=new THREE.Color(colors[i]??colors[0]);if(animate&&state.ready)tweens.push({m,from:m.color.clone(),to});else m.color.copy(to);});
    }
    tweenStart=performance.now();place();
    if(state.ready&&state.size!==look.size){measure();frame();}state.size=look.size;
    render();
  }
  let tweenStart=0;
  function place(){for(const o of objects)o.position.y=o.userData.base[1]+o.userData.e*state.explode;syncInstances();}
  // Switch housings, stems and sockets repeat once per key: one instanced draw per mesh and material
  // instead of one per key. The per-key meshes stay as hidden proxies for fitting and previews.
  const instanced=[];
  function instance(){
    const groups=new Map();
    for(const o of objects)if(o.userData.kind==='fixed'){const id=o.userData.mesh;if(!groups.has(id))groups.set(id,[]);groups.get(id).push(o);}
    for(const list of groups.values())if(list.length>=8){
      const mesh=new THREE.InstancedMesh(list[0].geometry,list[0].material,list.length);mesh.frustumCulled=false;model.add(mesh);
      for(const o of list)o.layers.set(1);
      instanced.push({mesh,proxies:list});
    }
  }
  function syncInstances(){
    for(const {mesh,proxies} of instanced){let n=0;for(const o of proxies)if(o.visible){o.updateMatrix();mesh.setMatrixAt(n++,o.matrix);}mesh.count=n;mesh.instanceMatrix.needsUpdate=true;}
  }
  // The canvas fills the whole hero so the keyboard is never cut off where it passes under the text;
  // a view offset keeps it framed in the stage area.
  const view={w:1,h:1,sw:1,sh:1};
  function resize(){
    const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
    const c=canvas.getBoundingClientRect(),a=area.getBoundingClientRect();
    Object.assign(view,{w,h,sw:a.width||w,sh:a.height||h});
    renderer.setSize(w,h,false);camera.aspect=w/h;
    camera.setViewOffset(w,h,w/2-(a.left-c.left+view.sw/2),h/2-(a.top-c.top+view.sh/2),w,h);
    camera.updateProjectionMatrix();frame();render();
  }
  // keep the whole keyboard in view at any aspect: every part's box corner, with the layers apart, must
  // project inside the view; the model is centred on what is seen, not on its box
  let zoom=1,fitPoints=[];
  const VIEW=new THREE.Vector3(1.05,1.38,1.5).normalize();
  function measure(){
    const keep=[state.explode,turntable.rotation.y,turntable.position.y];
    state.explode=EXPLODED;place();turntable.rotation.y=0;turntable.position.y=0;model.position.set(0,0,0);scene.updateMatrixWorld(true);
    const points=[],box=new THREE.Box3();
    for(const o of objects)if(o.visible&&o.geometry){box.setFromObject(o);for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new THREE.Vector3(x,y,z));}
    const centre=new THREE.Box3().setFromPoints(points).getCenter(new THREE.Vector3());
    for(const p of points)p.sub(centre);model.position.copy(centre).negate();
    [state.explode,turntable.rotation.y,turntable.position.y]=keep;place();fitPoints=points;
  }
  function frame(){
    if(!fitPoints.length)return;
    const dir=camera.position.clone().sub(controls.target).normalize(),up=new THREE.Vector3(0,1,0);
    const right=new THREE.Vector3().crossVectors(up,dir).normalize(),top=new THREE.Vector3().crossVectors(dir,right);
    let r0=Infinity,r1=-Infinity,t0=Infinity,t1=-Infinity;
    for(const p of fitPoints){const r=p.dot(right),t=p.dot(top);r0=Math.min(r0,r);r1=Math.max(r1,r);t0=Math.min(t0,t);t1=Math.max(t1,t);}
    controls.target.copy(right).multiplyScalar((r0+r1)/2).addScaledVector(top,(t0+t1)/2);
    // fit the stage area, not the whole canvas: the vertical field spans the canvas height
    const tan=Math.tan(THREE.MathUtils.degToRad(camera.fov)/2),th=tan*view.sh/view.h,tw=tan*view.sw/view.h;let distance=0;
    for(const p of fitPoints){const v=p.clone().sub(controls.target),depth=v.dot(dir);distance=Math.max(distance,Math.abs(v.dot(top))/th+depth,Math.abs(v.dot(right))/tw+depth);}
    distance=distance*1.04/zoom;
    camera.position.copy(dir).multiplyScalar(distance).add(controls.target);camera.near=distance/20;camera.far=distance*20;camera.updateProjectionMatrix();
  }
  function resetView(){
    zoom=1;controls.target.set(0,0,0);camera.position.copy(VIEW);camera.up.set(0,1,0);frame();controls.update();state.idle=0;render();
  }
  const clock=new THREE.Clock();let frameId=0,needs=true;
  const render=()=>{needs=true;if(!frameId)frameId=requestAnimationFrame(tick);};
  function loop(){render();}
  function tick(){
    frameId=0;const dt=Math.min(clock.getDelta(),.05),now=performance.now();
    let moving=false;
    // the intro and the slider ease the layers
    if(Math.abs(state.target-state.explode)>.0005){state.explode+=(state.target-state.explode)*Math.min(1,dt*(state.intro?2.2:9));place();moving=true;if(state.intro)onChange({explode:state.explode});}
    else if(state.intro){state.intro=false;onChange({explode:state.target});}
    // standby: a slow turn and float, eased in after the reader lets go
    state.idle+=dt;
    const want=state.standby&&!state.interacting&&state.idle>2.5&&!document.hidden?1:0;
    state.amp+=(want-state.amp)*Math.min(1,dt*1.2);
    if(state.amp>.001){state.phase+=dt;turntable.rotation.y=state.amp*.12*Math.sin(state.phase*TAU/11);turntable.position.y=state.amp*1.6*Math.sin(state.phase*TAU/7);moving=true;}
    if(tweens.length){const t=Math.min(1,(now-tweenStart)/600),e=1-Math.pow(1-t,3);for(const x of tweens)x.m.color.copy(x.from).lerp(x.to,e);if(t>=1)tweens=[];moving=true;}
    if(controls.update())moving=true;
    // the standby motion alone draws every other frame; the intro, a drag and colour changes draw them all
    const full=needs||state.intro||state.interacting||tweens.length>0||Math.abs(state.target-state.explode)>.0005;
    state.skip=!full&&moving&&!state.skip;
    if((needs||moving)&&!state.skip){renderer.render(scene,camera);needs=false;pace(now,full);}
    // a 'change' from controls.update() may already have scheduled the next frame
    if((moving||state.standby)&&state.onscreen){if(!frameId)frameId=requestAnimationFrame(tick);}
    else quality.last=0;
  }
  function pace(now,full){
    const q=quality,gap=q.last?now-q.last:0;q.last=now;if(!gap||gap>250)return;
    q.samples.push(full?gap:gap/2);if(q.samples.length<40)return;
    const s=q.samples.sort((a,b)=>a-b),median=s[s.length>>1],best=s[2];q.samples=[];
    if(median>Math.max(best*1.6,21)&&q.ratio>q.min)q.ratio=Math.max(q.min,q.ratio-.25);
    else if(median<best*1.15&&!q.raised&&q.ratio<q.max){q.ratio=Math.min(q.max,q.ratio+.25);q.raised=true;}
    else return;
    renderer.setPixelRatio(q.ratio);resize();
  }
  controls.addEventListener('start',()=>{state.interacting=true;state.idle=0;render();});
  controls.addEventListener('end',()=>{state.interacting=false;state.idle=0;render();});
  controls.addEventListener('change',render);
  // zoom only on a pinch or ⌘/Ctrl + scroll, so the page still scrolls
  canvas.addEventListener('wheel',e=>{if(!(e.ctrlKey||e.metaKey))return;e.preventDefault();zoom=THREE.MathUtils.clamp(zoom*Math.exp(-e.deltaY*.01),.8,3.6);frame();state.idle=0;render();},{passive:false});
  const resizer=new ResizeObserver(resize);resizer.observe(canvas);if(area!==canvas)resizer.observe(area);
  // nothing to draw while the hero is scrolled away
  // scrolled away mid-intro: finish it at once, so nothing waits on motion no one sees
  new IntersectionObserver(([e])=>{state.onscreen=e.isIntersecting;if(state.onscreen)render();else if(state.ready&&Math.abs(state.target-state.explode)>.0005){state.explode=state.target;if(state.intro){state.intro=false;onChange({explode:state.target});}place();}}).observe(canvas);
  document.addEventListener('visibilitychange',render);

  // Option and spec previews: a second small renderer, transparent PNGs in the current colours.
  // Each kind picks parts of the left half, a direction and what it frames; specs may add dimensions.
  const COLUMN=['K01','K11','K21'],STACK=['battery','mcu','display','supports','connectors'];
  const KINDS={
    size:{keep:p=>['case','frame','cap','screen'].includes(p.kind)||p.group==='display',view:[0,1,.0001],up:[0,0,-1]},
    case:{keep:p=>['case','cap'].includes(p.kind)||p.group==='switches',view:[.35,1.6,1.75],focus:[[8,-2,52],[82,10,96]],tight:.62},
    keys:{keep:p=>(p.kind==='cap'||p.group==='switches')&&COLUMN.includes(p.r),view:[-1,.06,0]},
    frame:{keep:p=>['frame','screen'].includes(p.kind)||p.group==='display',view:[0,1,.0001],up:[0,0,-1],focusKind:'frame'},
    // specs
    profile:{keep:p=>!['connectors','supports'].includes(p.group),view:[0,.02,1],annotate:'height'},
    // the whole left half of the chosen size from above, thumbs included, like the size cards
    layout:{keep:p=>['case','frame','cap','screen'].includes(p.kind)||p.group==='display',view:[0,1,.0001],up:[0,0,-1],annotate:'pitch'},
    controller:{keep:p=>p.group==='mcu',view:[.55,1.25,.9]},
    display:{keep:p=>p.group==='display'||p.kind==='screen',view:[.25,1.5,.85]},
    stack:{keep:p=>STACK.includes(p.group)||p.kind==='battery'||p.kind==='screen',view:[1,.42,1.25],explode:1},
    pcb:{keep:p=>p.group==='pcb',view:[0,1,.0001],up:[0,0,-1]},
  };
  let target=null;
  async function preview(kind,value,{width=160,height=110,ink='#20212a'}={}){
    // dimensioned art follows a 3× phone screen too, so its labels stay sharp
    const spec=KINDS[kind],dpr=Math.min(devicePixelRatio,spec.annotate?3:2),W=Math.round(width*dpr),H=Math.round(height*dpr);
    const look={...state.look,frame:{...state.look.frame}},theme=state.theme,s=new THREE.Scene();lights(s);
    if(kind==='size')look.size=value;else if(kind==='case')look.case=value;else if(kind==='keys')look.keys=value;else if(kind==='frame')look.frame.left=value;
    const pack=await sizes[look.size],picked=[],made=[],mat=c=>{const m=surface(c);made.push(m);return m;};
    for(const o of objects){
      const p=o.userData;if(p.side!=='left'||(p.v&&!p.v.includes(look.size))||!o.geometry&&p.kind!=='case'||!spec.keep(p))continue;
      let g=o.geometry,material=o.material,rot=o.rotation.y,y=p.base[1]+(spec.explode?p.e*spec.explode:0);
      if(p.kind==='case'){g=pack.mesh(`left-case-${look.case}-${p.group}`);material=mat(p.group==='base'?theme.base:look.case==='level'?theme.frame.body:theme.plate);}
      if(p.kind==='pcb')g=pack.mesh('left-pcb');
      if(p.kind==='frame'){g=common.mesh(`left-frame-${look.frame.left}`);material=framePalette({...look,own:{left:kind==='frame'?false:look.own?.left}},theme,'left').map(mat);}
      if(p.kind==='cap'){const [variant,turn]=common.presets[look.keys].left[p.k],cap=common.caps[variant],key=common.layout.left[p.k];g=common.mesh(cap.mesh);rot=THREE.MathUtils.degToRad(key.angle+turn);y=cap.seat;material=mat(capColor(theme.keycaps,key));}
      const m=new THREE.Mesh(g,material);m.position.set(p.p[0],y,p.p[2]);m.rotation.y=rot;m.userData={kind:p.kind,group:p.group,k:p.k,r:p.r};s.add(m);picked.push(m);
    }
    const focus=new THREE.Box3();
    if(spec.focus)focus.set(new THREE.Vector3(...spec.focus[0]),new THREE.Vector3(...spec.focus[1]));
    else for(const m of picked)if(!spec.focusKind||m.userData.kind===spec.focusKind)focus.expandByObject(m);
    const body=focus.clone(),aspect=width/height,ahead=new THREE.Vector3(...spec.view).normalize(),cam=new THREE.OrthographicCamera();
    cam.up.set(...(spec.up||[0,1,0]));cam.position.copy(ahead);cam.lookAt(0,0,0);cam.updateMatrixWorld();
    const right=new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld,0),up=new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld,1);
    // Dimensions, in the model's own millimetres: each runs between visible edges, so its ends sit on what it measures.
    const dims=[],box=m=>new THREE.Box3().setFromObject(m),mmText=v=>`${+v.toFixed(1)} mm`;
    if(spec.annotate==='height'){
      // the case's lowest edge to the frame's top, at the right end of the half
      const frame=box(picked.find(m=>m.userData.kind==='frame')),low=Math.min(...picked.filter(m=>m.userData.kind==='case').map(m=>box(m).min.y));
      dims.push({side:'right',a:new THREE.Vector3(body.max.x,low,body.max.z),b:new THREE.Vector3(frame.max.x,frame.max.y,frame.max.z),label:mmText(frame.max.y-low)});
    }else if(spec.annotate==='pitch'){
      // the main grid by column (thumbs aside), each column's keys from the top
      const grid=new Map();for(const m of picked)if(m.userData.kind==='cap'&&m.userData.r[1]!=='3'){const col=+m.userData.r[2];if(!grid.has(col))grid.set(col,[]);grid.get(col).push(box(m));}
      for(const keys of grid.values())keys.sort((a,b)=>a.min.z-b.min.z);
      const cols=[...grid.keys()].sort((a,b)=>a-b),[a,b]=grid.get(cols[0]),p=grid.get(cols.at(-2))[0],q=grid.get(cols.at(-1))[0],y=body.max.y;
      // row pitch: top edge to top edge of the outer column's first two keys, on the left
      dims.push({side:'left',a:new THREE.Vector3(a.min.x,y,a.min.z),b:new THREE.Vector3(b.min.x,y,b.min.z),label:mmText(b.min.z-a.min.z)});
      // column pitch: left edge to left edge of the two inner columns' top keys, above
      dims.push({side:'top',a:new THREE.Vector3(p.min.x,y,p.min.z),b:new THREE.Vector3(q.min.x,y,q.min.z),label:mmText(q.min.x-p.min.x)});
    }
    // labels keep fixed room in CSS pixels; an annotated drawing sits at the bottom left of its box, like the card's text
    const fontPx=height>=110?11:10,font=k=>`500 ${fontPx*k}px "JetBrains Mono", ui-monospace, monospace`,GAP=7,TICK=3.5,SPACE=5;
    const meter=document.createElement('canvas').getContext('2d');meter.font=font(1);
    const room={left:3,right:3,top:3,bottom:3};
    for(const d of dims){const w=Math.ceil(meter.measureText(d.label).width);
      if(d.side==='left')room.left=Math.max(room.left,GAP+TICK+SPACE+w+2);if(d.side==='right')room.right=Math.max(room.right,GAP+TICK+SPACE+w+2);if(d.side==='top')room.top=Math.max(room.top,GAP+TICK+SPACE+fontPx+2);}
    const corners=[];for(const x of [body.min.x,body.max.x])for(const y of [body.min.y,body.max.y])for(const z of [body.min.z,body.max.z])corners.push(new THREE.Vector3(x,y,z));
    const along=axis=>[Math.min(...corners.map(v=>v.dot(axis))),Math.max(...corners.map(v=>v.dot(axis)))],[r0,r1]=along(right),[u0,u1]=along(up);
    let c,half;
    if(dims.length){
      const mm=Math.min((width-room.left-room.right)/(r1-r0),(height-room.top-room.bottom)/(u1-u0)),depth=body.getCenter(new THREE.Vector3()).dot(ahead);
      c=right.clone().multiplyScalar(r0-room.left/mm+width/mm/2).add(up.clone().multiplyScalar(u0-room.bottom/mm+height/mm/2)).add(ahead.clone().multiplyScalar(depth));half=height/mm/2;
    }else{
      c=focus.getCenter(new THREE.Vector3());half=0;
      for(const v of corners){const d=v.clone().sub(c);half=Math.max(half,Math.abs(d.dot(right))/aspect,Math.abs(d.dot(up)));}
      half*=spec.tight||1.04;
    }
    cam.position.copy(c).add(ahead.clone().multiplyScalar(400));cam.lookAt(c);cam.updateMatrixWorld();
    Object.assign(cam,{left:-half*aspect,right:half*aspect,top:half,bottom:-half,near:1,far:2000});cam.updateProjectionMatrix();
    target??=new THREE.WebGLRenderTarget(W,H,{samples:4,colorSpace:THREE.SRGBColorSpace});target.setSize(W,H);
    renderer.setRenderTarget(target);renderer.clear();renderer.render(s,cam);renderer.setRenderTarget(null);
    const px=new Uint8Array(W*H*4);await renderer.readRenderTargetPixelsAsync(target,0,0,W,H,px);
    // rows bottom-up and colours premultiplied by the antialiased edges' alpha
    const out=document.createElement('canvas');out.width=W;out.height=H;const ctx=out.getContext('2d'),img=ctx.createImageData(W,H);
    for(let y=0;y<H;y++){const from=(H-1-y)*W*4,to=y*W*4;for(let i=0;i<W*4;i+=4){const a=px[from+i+3];
      if(a){const k=255/a;img.data[to+i]=Math.min(255,px[from+i]*k);img.data[to+i+1]=Math.min(255,px[from+i+1]*k);img.data[to+i+2]=Math.min(255,px[from+i+2]*k);img.data[to+i+3]=a;}}}
    ctx.putImageData(img,0,0);
    if(dims.length){
      // drawn at 1:1 in device pixels: lines on the pixel grid, labels in the page's ink and type
      const lw=Math.max(1,Math.round(dpr)),snap=v=>Math.round(v)+(lw%2?.5:0),at=v=>{const n=v.clone().project(cam);return [(n.x+1)/2*W,(1-n.y)/2*H];};
      const edge={left:(r0-cam.position.dot(right))/half/aspect,right:(r1-cam.position.dot(right))/half/aspect,top:(u1-cam.position.dot(up))/half};
      const line=(x0,y0,x1,y1,alpha=1)=>{ctx.globalAlpha=alpha;ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();ctx.globalAlpha=1;};
      ctx.strokeStyle=ink;ctx.fillStyle=ink;ctx.lineWidth=lw;ctx.lineCap='butt';ctx.font=font(dpr);
      for(const d of dims){
        const [ax,ay]=at(d.a),[bx,by]=at(d.b),k=dpr;
        if(d.side==='top'){
          const y=snap((1-edge.top)/2*H-GAP*k),x0=snap(ax),x1=snap(bx);
          line(x0,ay-2*k,x0,y-TICK*k,.45);line(x1,by-2*k,x1,y-TICK*k,.45);
          line(x0,y,x1,y);line(x0,y-TICK*k,x0,y+TICK*k);line(x1,y-TICK*k,x1,y+TICK*k);
          ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.fillText(d.label,(x0+x1)/2,y-(TICK+SPACE)*k);
        }else{
          const toLeft=d.side==='left',x=snap(((toLeft?edge.left:edge.right)+1)/2*W+(toLeft?-GAP:GAP)*k),y0=snap(ay),y1=snap(by),from=toLeft?-1:1;
          line(ax+from*2*k,y0,x+from*TICK*k,y0,.45);line(bx+from*2*k,y1,x+from*TICK*k,y1,.45);
          line(x,y0,x,y1);line(x-TICK*k,y0,x+TICK*k,y0);line(x-TICK*k,y1,x+TICK*k,y1);
          ctx.textAlign=toLeft?'right':'left';ctx.textBaseline='middle';ctx.fillText(d.label,x+from*(TICK+SPACE)*k,(y0+y1)/2);
        }
      }
    }
    for(const m of made)m.dispose();
    // encoded off the main thread
    const blob=await new Promise(r=>out.toBlob(r,'image/png'));return URL.createObjectURL(blob);
  }
  // previews wait for a quiet moment: not while the layers move fast, during a drag or a colour change
  function quiet(){
    return new Promise(function check(resolve){
      // the intro's slow tail counts as still: its last few percent hardly move
      const busy=state.onscreen&&(state.interacting||tweens.length>0||Math.abs(state.target-state.explode)>.06);
      if(busy)setTimeout(()=>check(resolve),120);else if(window.requestIdleCallback)requestIdleCallback(()=>resolve(),{timeout:400});else setTimeout(resolve,30);
    });
  }
  if(new URLSearchParams(location.search).has('diagnostics'))window.flanHome={info:()=>({...renderer.info.render,ratio:quality.ratio,software})};
  return {
    init,apply,resize,resetView,preview,load,quiet,
    get explode(){return state.target;},
    setExplode(v,{immediate=false}={}){state.target=THREE.MathUtils.clamp(v,0,1);state.idle=0;state.intro=false;if(immediate){state.explode=state.target;place();}render();},
    // false with reduced motion: the layers are already apart
    intro(){if(reduced.matches||software)return false;state.intro=true;state.explode=0;state.target=EXPLODED;place();render();return true;},
    get standby(){return state.standby;},
    setStandby(on){state.standby=on;state.idle=on?3:0;render();},
  };
}
