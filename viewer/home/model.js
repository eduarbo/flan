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

export function createModel({canvas,packs,onChange=()=>{}}){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0,0);
  const scene=new THREE.Scene();lights(scene);
  const camera=new THREE.PerspectiveCamera(20,1,10,6000);
  const controls=new OrbitControls(camera,canvas);
  Object.assign(controls,{enablePan:false,enableZoom:false,enableDamping:true,dampingFactor:.08,rotateSpeed:.7,minPolarAngle:.18,maxPolarAngle:1.42});
  // vertical swipes keep scrolling the page; a horizontal drag turns the keyboard
  canvas.style.touchAction='pan-y';
  const turntable=new THREE.Group(),model=new THREE.Group();turntable.add(model);scene.add(turntable);
  const sizes={},state={onscreen:true,look:null,theme:null,explode:0,target:EXPLODED,standby:!reduced.matches,interacting:false,idle:0,amp:0,phase:0,ready:false};
  let common,objects=[],center=new THREE.Vector3(),tweens=[];

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
    await apply(look,theme,{animate:false});
    // the keyboard's own centre, fitted with its layers apart so the frame never jumps
    const box=bounds(EXPLODED);box.getCenter(center);model.position.sub(center);fitBox=box.translate(center.clone().negate());resetView();
    state.ready=true;state.explode=reduced.matches?EXPLODED:0;state.target=EXPLODED;place();
    // the other sizes in the background, so a size change is instant
    for(const id of Object.keys(packs))if(id!=='common')load(id).catch(()=>{});
    loop();
  }
  function bounds(explode){
    const box=new THREE.Box3();
    for(const o of objects)if(o.visible&&o.geometry){
      const y=o.position.y;o.position.y=o.userData.base[1]+o.userData.e*explode;o.updateMatrixWorld(true);
      box.expandByObject(o);o.position.y=y;
    }
    model.updateMatrixWorld(true);return box;
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
    tweenStart=performance.now();place();render();
  }
  let tweenStart=0;
  function place(){for(const o of objects)o.position.y=o.userData.base[1]+o.userData.e*state.explode;}
  function resize(){
    const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
    renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();frame();render();
  }
  // keep the whole keyboard in view at any aspect: the box's extent across the view sets the distance
  let zoom=1,fitBox=null;
  const VIEW=new THREE.Vector3(1.05,1.38,1.5).normalize();
  function frame(){
    if(!fitBox)return;
    const dir=camera.position.clone().sub(controls.target).normalize(),up=new THREE.Vector3(0,1,0);
    const right=new THREE.Vector3().crossVectors(up,dir).normalize(),top=new THREE.Vector3().crossVectors(dir,right);
    let w=0,h=0,d=0;
    for(const x of [fitBox.min.x,fitBox.max.x])for(const y of [fitBox.min.y,fitBox.max.y])for(const z of [fitBox.min.z,fitBox.max.z]){
      const v=new THREE.Vector3(x,y,z);w=Math.max(w,Math.abs(v.dot(right)));h=Math.max(h,Math.abs(v.dot(top)));d=Math.max(d,v.dot(dir));}
    const tan=Math.tan(THREE.MathUtils.degToRad(camera.fov)/2),distance=(Math.max(h/tan,w/(tan*camera.aspect))*1.06+d)/zoom;
    camera.position.copy(dir).multiplyScalar(distance).add(controls.target);camera.near=distance/20;camera.far=distance*20;camera.updateProjectionMatrix();
  }
  function resetView(){
    zoom=1.14;controls.target.set(0,0,0);camera.position.copy(VIEW);camera.up.set(0,1,0);frame();controls.update();state.idle=0;render();
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
    if(needs||moving){renderer.render(scene,camera);needs=false;}
    if((moving||state.standby)&&state.onscreen)frameId=requestAnimationFrame(tick);
  }
  controls.addEventListener('start',()=>{state.interacting=true;state.idle=0;render();});
  controls.addEventListener('end',()=>{state.interacting=false;state.idle=0;render();});
  controls.addEventListener('change',render);
  // zoom only on a pinch or ⌘/Ctrl + scroll, so the page still scrolls
  canvas.addEventListener('wheel',e=>{if(!(e.ctrlKey||e.metaKey))return;e.preventDefault();zoom=THREE.MathUtils.clamp(zoom*Math.exp(-e.deltaY*.01),.8,3.6);frame();state.idle=0;render();},{passive:false});
  new ResizeObserver(resize).observe(canvas);
  // nothing to draw while the hero is scrolled away
  new IntersectionObserver(([e])=>{state.onscreen=e.isIntersecting;if(state.onscreen)render();}).observe(canvas);
  document.addEventListener('visibilitychange',render);

  // option previews: a second small renderer, transparent PNGs in the current colours
  let previewRenderer;
  function preview(kind,value,{width=160,height=110}={}){
    previewRenderer??=new THREE.WebGLRenderer({canvas:document.createElement('canvas'),antialias:true,alpha:true,preserveDrawingBuffer:true});
    const r=previewRenderer;r.setPixelRatio(Math.min(devicePixelRatio,2));r.setSize(width,height,false);r.outputColorSpace=THREE.SRGBColorSpace;r.setClearColor(0,0);
    const look={...state.look,frame:{...state.look.frame}},theme=state.theme,s=new THREE.Scene();lights(s);
    if(kind==='size')look.size=value;else if(kind==='case')look.case=value;else if(kind==='keys')look.keys=value;else if(kind==='frame')look.frame.left=value;
    const pack=sizes[look.size];
    return Promise.resolve(pack).then(pack=>{
      const picked=[],made=[],mat=c=>{const m=surface(c);made.push(m);return m;},column=['K01','K11','K21'];
      for(const o of objects){
        const p=o.userData;if(p.side!=='left'||(p.v&&!p.v.includes(look.size)))continue;
        const keep={size:['case','frame','cap','screen'].includes(p.kind)||p.group==='display',
          case:['case','cap'].includes(p.kind)||p.group==='switches',
          keys:(p.kind==='cap'||p.group==='switches')&&column.includes(p.r),
          frame:['frame','screen'].includes(p.kind)||p.group==='display'}[kind];
        if(!keep)continue;
        let g=o.geometry,material=o.material,rot=o.rotation.y,y=p.base[1];
        if(p.kind==='case'){g=pack.mesh(`left-case-${look.case}-${p.group}`);material=mat(p.group==='base'?theme.base:look.case==='level'?theme.frame.body:theme.plate);}
        if(p.kind==='frame'){g=common.mesh(`left-frame-${look.frame.left}`);material=framePalette({...look,own:{left:kind==='frame'?false:look.own?.left}},theme,'left').map(mat);}
        if(p.kind==='cap'){const [variant,turn]=common.presets[look.keys].left[p.k],cap=common.caps[variant],key=common.layout.left[p.k];g=common.mesh(cap.mesh);rot=THREE.MathUtils.degToRad(key.angle+turn);y=cap.seat;material=mat(capColor(theme.keycaps,key));}
        const m=new THREE.Mesh(g,material);m.position.set(p.p[0],y,p.p[2]);m.rotation.y=rot;m.userData.kind=p.kind;s.add(m);picked.push(m);
      }
      // what each preview frames: the half from above, the pinky foot and thumb notch where the case styles
      // differ, one column of caps from the side, the frame from above
      let focus=new THREE.Box3();
      if(kind==='case')focus.set(new THREE.Vector3(8,-2,52),new THREE.Vector3(82,10,96));
      else for(const m of picked)if(kind!=='frame'||m.userData.kind==='frame')focus.expandByObject(m);
      const views={size:[0,1,.0001],case:[.35,1.6,1.75],keys:[-1,.06,0],frame:[0,1,.0001]};
      const c=focus.getCenter(new THREE.Vector3()),cam=new THREE.OrthographicCamera();
      cam.position.copy(c).add(new THREE.Vector3(...views[kind]).normalize().multiplyScalar(400));
      cam.up.set(0,1,0);if(kind==='size'||kind==='frame')cam.up.set(0,0,-1);
      cam.lookAt(c);cam.updateMatrixWorld();
      const right=new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld,0),up=new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld,1),aspect=width/height;
      let half=0;for(const x of [focus.min.x,focus.max.x])for(const y of [focus.min.y,focus.max.y])for(const z of [focus.min.z,focus.max.z]){const v=new THREE.Vector3(x,y,z).sub(c);half=Math.max(half,Math.abs(v.dot(right))/aspect,Math.abs(v.dot(up)));}
      half*=kind==='case'?.62:1.04;
      Object.assign(cam,{left:-half*aspect,right:half*aspect,top:half,bottom:-half,near:1,far:2000});cam.updateProjectionMatrix();
      r.render(s,cam);const url=r.domElement.toDataURL('image/png');
      for(const m of made)m.dispose();
      return url;
    });
  }
  return {
    init,apply,resize,resetView,preview,load,
    get explode(){return state.target;},
    setExplode(v,{immediate=false}={}){state.target=THREE.MathUtils.clamp(v,0,1);state.idle=0;state.intro=false;if(immediate){state.explode=state.target;place();}render();},
    // false with reduced motion: the layers are already apart
    intro(){if(reduced.matches)return false;state.intro=true;state.explode=0;state.target=EXPLODED;place();render();return true;},
    get standby(){return state.standby;},
    setStandby(on){state.standby=on;state.idle=on?3:0;render();},
  };
}
