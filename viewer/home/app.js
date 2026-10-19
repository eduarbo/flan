// SPDX-License-Identifier: GPL-3.0-or-later
// Flan Keyboard home: a live, simplified configurator that opens the explorer on the same look.
import finishes from '../../design/frame-finishes.json';
import {createModel} from './model.js';
import {pageTokens} from './tokens.js';

const data=JSON.parse(document.getElementById('home-data').textContent);
const $=id=>document.getElementById(id);
const themes=new Map(data.themes.map(t=>[t.id,t])),frameIds=data.frames.map(f=>f.id);
const CASES=[['rim','Color rim'],['solid','Solid'],['terrace','Terrace'],['level','Level']],KEYS=[['original','Original'],['normal','Sculpted'],['saddle','Saddle']];
const T={
  en:{'nav.explore':'Explore in 3D','nav.build':'Build guide','hero.eyebrow':'Open-source wireless keyboard','hero.title':'Low. Split. Yours.','hero.sub':'Four sizes, 28 themes and six magnetic frames. Turn it, take it apart, make it yours.',
    'stage.label':'3D keyboard','stage.canvas':'Drag to turn the keyboard','stage.poster':'Flan36 in the SNES theme, layers apart','stage.hint':'Drag to turn · pinch to zoom','stage.pause':'Pause the standby motion','stage.play':'Resume the standby motion','stage.reset':'Reset the view',
    'stage.nogl':'The live 3D view needs WebGL. The explorer shows every part.','stage.failed':'The 3D model could not load. Check the connection and reload.',
    'layers.apart':'Apart','layers.together':'Together','layers.label':'Separate the layers','rail.label':'Make it yours','g.size':'Size','g.theme':'Theme','g.case':'Case','g.keys':'Keycaps','g.frame':'Frame','g.frames':'Frames',
    'frame.browse':'Browse 6','frame.count':'· 6 magnetic designs','frame.cancel':'Cancel','frame.hover':'Hover a frame to preview it on the model','frame.apply':'Apply {name}','frame.from':'Colors from {theme}','frame.own':'Use {name}’s own palette','frame.ownOn':'Use the {theme} colors','frame.current':'Current','frame.previewing':'Previewing {name} · not applied yet',
    'side.both':'Both halves','side.left':'Left','side.right':'Right','cta.open':'Open this build in 3D','keys':'keys','specs.eyebrow':'Spec sheet','specs.title':'What’s under the frame',
    'f.parts':'Parts','f.pcbs':'Order PCBs','f.status':'Digital prototype · physical tests in progress','f.by':'by',
    'role.body':'Body','role.detail':'Detail','role.accent':'Accent','role.secondary':'Secondary'},
  es:{'nav.explore':'Explorar en 3D','nav.build':'Guía de armado','hero.eyebrow':'Teclado inalámbrico de código abierto','hero.title':'Bajo. Dividido. Tuyo.','hero.sub':'Cuatro tamaños, 28 temas y seis marcos magnéticos. Gíralo, sepáralo y hazlo tuyo.',
    'stage.label':'Teclado en 3D','stage.canvas':'Arrastra para girar el teclado','stage.poster':'Flan36 con el tema SNES, capas separadas','stage.hint':'Arrastra para girar · pellizca para acercar','stage.pause':'Pausar el movimiento en reposo','stage.play':'Reanudar el movimiento en reposo','stage.reset':'Restablecer la vista',
    'stage.nogl':'La vista 3D necesita WebGL. El explorador muestra cada pieza.','stage.failed':'No se pudo cargar el modelo 3D. Revisa la conexión y recarga.',
    'layers.apart':'Separado','layers.together':'Unido','layers.label':'Separar las capas','rail.label':'Hazlo tuyo','g.size':'Tamaño','g.theme':'Tema','g.case':'Caja','g.keys':'Keycaps','g.frame':'Marco','g.frames':'Marcos',
    'frame.browse':'Ver los 6','frame.count':'· 6 diseños magnéticos','frame.cancel':'Cancelar','frame.hover':'Pasa el cursor por un marco para verlo en el modelo','frame.apply':'Aplicar {name}','frame.from':'Colores de {theme}','frame.own':'Usar la paleta propia de {name}','frame.ownOn':'Usar los colores de {theme}','frame.current':'Actual','frame.previewing':'Vista previa: {name} · sin aplicar',
    'side.both':'Ambas mitades','side.left':'Izquierda','side.right':'Derecha','cta.open':'Abrir este teclado en 3D','keys':'teclas','specs.eyebrow':'Ficha técnica','specs.title':'Lo que hay bajo el marco',
    'f.parts':'Piezas','f.pcbs':'Pedir PCB','f.status':'Prototipo digital · pruebas físicas en curso','f.by':'por',
    'role.body':'Cuerpo','role.detail':'Detalle','role.accent':'Acento','role.secondary':'Secundario'},
};
const SHAPES={
  talavera:['Four teardrop petals in quadrants around a concave star.','Cuatro pétalos en gota alrededor de una estrella cóncava.'],
  gameboy:['Pocket-console bezel, cross pad and two buttons.','Bisel de consola portátil, cruceta y dos botones.'],
  snes:['Console face with a cross pad and four round buttons.','Frente de consola con cruceta y cuatro botones redondos.'],
  phone:['Faceplate with a full keypad and call key.','Carcasa con teclado completo y tecla de llamada.'],
  ipod:['A complete click wheel and a continuous screen border.','Click wheel completa y un marco continuo de pantalla.'],
  hanafuda:['Lacquer-card landscape: sun, mountain, snowcap and foothills.','Paisaje de carta lacada: sol, montaña, nieve y faldas.'],
};
// label (en, es), value (one, or en and es), note (en, es); ART names each card's illustration, in order
const ART=[['profile',300,128],['layout',250,128],['controller',230,128],['display',210,128],['sizes'],['stack',250,128],['frames'],['pcb',250,128]];
const SPECS=[
  ['Low profile','Perfil bajo','14.5 mm','Choc v1 hot-swap sockets under a flush magnetic frame.','Sockets hot-swap Choc v1 bajo un marco magnético al ras.'],
  ['Layout','Distribución','18 × 17 mm','Choc spacing, column stagger and three splayed thumb keys per half.','Espaciado Choc, columnas escalonadas y tres teclas de pulgar abiertas por mitad.'],
  ['Wireless','Inalámbrico','nice!nano v2','nRF52840 running ZMK: Bluetooth LE, five host profiles, USB-C.','nRF52840 con ZMK: Bluetooth LE, cinco perfiles de equipo, USB-C.'],
  ['Displays','Pantallas','2 × nice!view','Low-power memory LCD on each half, framed by the display cover.','LCD de memoria de bajo consumo en cada mitad, enmarcada por la cubierta.'],
  ['Sizes','Tamaños',['36–54 keys','36–54 teclas'],'Four sizes: add the outer column, the number row or both. Same thumbs.','Cuatro tamaños: suma la columna exterior, la fila de números o ambas. Mismos pulgares.'],
  ['Battery','Batería','100 mAh','1S LiPo per half, under the controller. A 110 mAh pack also fits.','LiPo 1S por mitad, bajo el controlador. También cabe una de 110 mAh.'],
  ['Looks','Estilos','28 · 6 · 4','Themes, magnetic display frames and case styles. Three KLP Lamé key shapes.','Temas, marcos magnéticos y estilos de caja. Tres formas de keycap KLP Lamé.'],
  ['Open hardware','Hardware abierto','GPL-3.0','KiCad, FreeCAD, Gerbers, STEP, STL and 3MF. Print it, order it, change it.','KiCad, FreeCAD, Gerbers, STEP, STL y 3MF. Imprímelo, pídelo, cámbialo.'],
];
let lang='en';
const t=(key,vars={})=>(T[lang][key]??T.en[key]??key).replace(/\{(\w+)\}/g,(_,k)=>vars[k]??'');
const store={get(k){try{return localStorage.getItem(k);}catch{return null;}},set(k,v){try{localStorage.setItem(k,v);}catch{}}};

// the look: what the rail shows and what the explorer opens
const DEFAULT={size:'flan36',theme:'snes',case:'rim',keys:'original',frame:{left:'snes',right:'snes'},own:{left:false,right:false}};
function valid(l){
  return l&&data.sizes.some(s=>s.id===l.size)&&themes.has(l.theme)&&CASES.some(c=>c[0]===l.case)&&KEYS.some(k=>k[0]===l.keys)
    &&['left','right'].every(s=>frameIds.includes(l.frame?.[s])&&typeof l.own?.[s]==='boolean');
}
let look=structuredClone(DEFAULT);
try{const saved=JSON.parse(store.get('flan.home.look'));if(valid(saved))look=saved;}catch{}
const theme=()=>themes.get(look.theme);
const sizeOf=id=>data.sizes.find(s=>s.id===id);
function exploreUrl(l=look){
  const q=new URLSearchParams({size:l.size,theme:l.theme,case:l.case,keys:l.keys,frame:l.frame.left===l.frame.right?l.frame.left:`${l.frame.left},${l.frame.right}`});
  if(l.own.left||l.own.right)q.set('palette',l.own.left===l.own.right?'frame':`${l.own.left?'frame':'theme'},${l.own.right?'frame':'theme'}`);
  return 'explore/?'+q;
}

// page colours follow the theme
function paint(){
  const k=pageTokens(theme()),root=document.documentElement;
  for(const name of ['bg0','bg1','bg2','glow','ink','muted','accent','on'])root.style.setProperty('--'+name,k[name]);
  root.dataset.scheme=k.scheme;document.querySelector('meta[name=theme-color]').content=k.bg1;
}

// rail
const el=(tag,props={},...kids)=>{const e=Object.assign(document.createElement(tag),props);for(const [k,v] of Object.entries(props.dataset||{}))e.dataset[k]=v;e.append(...kids);return e;};
const previews=new Map();
function option(group,value,inner,cls){
  const b=el('button',{type:'button',className:`opt ${cls}`});b.dataset.value=value;b.setAttribute('aria-pressed','false');
  const img=el('img',{alt:'',width:1,height:1});img.decoding='async';b.append(img,...inner);previews.set(`${group}:${value}`,img);
  b.addEventListener('click',()=>choose(group,value));return b;
}
function buildRail(){
  $('o-size').replaceChildren(...data.sizes.map(s=>option('size',s.id,[el('b',{textContent:String(s.keys)})],'size')));
  $('o-case').replaceChildren(...CASES.map(([id,name])=>option('case',id,[el('span',{textContent:name})],'case')));
  $('o-keys').replaceChildren(...KEYS.map(([id,name])=>option('keys',id,[el('span',{textContent:name})],'keys')));
  $('o-frame').replaceChildren(...data.frames.map(f=>{const b=option('frame',f.id,[],'frame');b.title=f.label;b.setAttribute('aria-label',f.label);return b;}));
  $('o-theme').replaceChildren(...data.themes.map(th=>{
    const b=el('button',{type:'button',title:th.name},el('span',{textContent:th.name}));b.dataset.value=th.id;b.setAttribute('aria-label',th.name);b.setAttribute('aria-pressed','false');
    b.style.cssText=`--a:${th.base};--b:${th.plate};--c:${th.frame.accent}`;b.addEventListener('click',()=>choose('theme',th.id));return b;}));
  // phone tabs
  $('tabs').replaceChildren(...['size','theme','case','keys','frame'].map(g=>{
    const b=el('button',{type:'button',role:'tab'});b.dataset.tab=g;b.addEventListener('click',()=>tab(g));return b;}));
  tab(store.get('flan.home.tab')||'theme');
}
function tab(g){
  for(const b of $('tabs').children)b.setAttribute('aria-selected',String(b.dataset.tab===g));
  for(const grp of document.querySelectorAll('.grp'))grp.classList.toggle('active',grp.dataset.group===g);
  store.set('flan.home.tab',g);reveal();
}
const caseName=id=>CASES.find(c=>c[0]===id)[1],keysName=id=>KEYS.find(k=>k[0]===id)[1],frameName=id=>data.frames.find(f=>f.id===id).label;
function syncRail(){
  const s=sizeOf(look.size),frames=look.frame.left===look.frame.right?frameName(look.frame.left):`${frameName(look.frame.left)} / ${frameName(look.frame.right)}`;
  $('v-size').innerHTML=`${s.title} <i>· ${s.grid}</i>`;$('v-theme').innerHTML=`${theme().name} <i>· 28</i>`;
  $('v-case').textContent=caseName(look.case);$('v-keys').innerHTML=`${keysName(look.keys)} <i>· KLP Lamé</i>`;$('v-frame').textContent=frames;
  const current={size:look.size,case:look.case,keys:look.keys,theme:look.theme};
  for(const [g,v] of Object.entries(current))for(const b of $('o-'+g).children)b.setAttribute('aria-pressed',String(b.dataset.value===v));
  for(const b of $('o-frame').children)b.setAttribute('aria-pressed',String(b.dataset.value===look.frame.left||b.dataset.value===look.frame.right));
  const small={size:s.keys,theme:theme().name,case:caseName(look.case).replace('Color r','R'),keys:keysName(look.keys),frame:frames};
  for(const b of $('tabs').children)b.replaceChildren(t('g.'+b.dataset.tab),el('small',{textContent:String(small[b.dataset.tab])}));
  $('open').href=exploreUrl();
}
// phones: keep the chosen option in the visible part of its strip
function reveal(){
  for(const b of document.querySelectorAll('.grp.active [aria-pressed=true]')){const strip=b.parentElement;if(strip.scrollWidth>strip.clientWidth)strip.scrollTo({left:b.offsetLeft-strip.clientWidth/2+b.offsetWidth/2,behavior:'smooth'});}
}
function choose(group,value){
  const next=structuredClone(look);
  if(group==='theme'){
    // a frame that came with the old theme follows the new one when that theme has an installed frame
    const old=theme().recommended_frame,rec=themes.get(value).recommended_frame;
    for(const s of ['left','right'])if(frameIds.includes(rec)&&(look.frame[s]===old||!frameIds.includes(old)))next.frame[s]=rec;
    next.theme=value;
  }else if(group==='frame'){next.frame={left:value,right:value};next.own={left:false,right:false};}
  else next[group]=value;
  commit(next);
}
let model=null,previewTimer=0;
function commit(next,{animate=true}={}){
  const themeChanged=next.theme!==look.theme;look=next;store.set('flan.home.look',JSON.stringify(look));
  if(themeChanged)paint();syncRail();
  model?.apply(look,theme(),{animate}).catch(failed);
  clearTimeout(previewTimer);previewTimer=setTimeout(renderPreviews,themeChanged?650:120);
}
// previews in the current colours; a size's own pack may still be arriving
let previewSeq=0;
async function renderPreviews(){
  if(!model)return;const seq=++previewSeq;
  const jobs=[...data.sizes.map(s=>['size',s.id,{width:128,height:88}]),...CASES.map(c=>['case',c[0],{width:140,height:92}]),
    ...KEYS.map(k=>['keys',k[0],{width:184,height:88}]),...frameIds.map(f=>['frame',f,{width:68,height:168}])];
  // the spec sheet's own renders wait until it is about to be read
  if(specsNear){
    const ink=getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
    await document.fonts?.load('500 11px "JetBrains Mono"').catch(()=>{});
    for(const [kind,w,h] of ART)if(w)jobs.push([kind,'spec',{width:w,height:h,ink}]);
  }
  for(const [kind,value,size] of jobs){
    try{const url=await model.preview(kind,value,size);if(seq!==previewSeq)return;previews.get(value==='spec'?'spec:'+kind:`${kind}:${value}`).src=url;}catch(e){console.warn(kind,value,e);}
    await new Promise(r=>setTimeout(r,0));
    if(kind==='frame'||kind==='size')for(const [img,key] of mirror)setSrc(img,previews.get(key).getAttribute('src'));
  }
  if(!$('browser').hidden)focusFrame(browsing.focus);
}

const setSrc=(img,src)=>{if(src)img.src=src;else img.removeAttribute('src');};
// frame browser: hover previews on the model, nothing changes until Apply
const browsing={focus:'snes',sides:'both',own:false,before:null};
function openBrowser(){
  browsing.before=structuredClone(look);browsing.sides='both';browsing.focus=look.frame.left;browsing.own=look.own.left;
  $('rail').hidden=true;$('browser').hidden=false;
  $('f-grid').replaceChildren(...data.frames.map(f=>{
    const b=el('button',{type:'button',className:'opt'});b.dataset.value=f.id;
    const img=el('img',{alt:''});setSrc(img,previews.get('frame:'+f.id).getAttribute('src'));
    b.append(img,el('span',{textContent:f.label}));
    if(f.id===look.frame.left||f.id===look.frame.right)b.append(el('span',{className:'cur',textContent:t('frame.current')}));
    b.addEventListener('pointerenter',()=>focusFrame(f.id,true));b.addEventListener('focus',()=>focusFrame(f.id,true));
    b.addEventListener('click',()=>focusFrame(f.id,true));return b;}));
  syncSides();focusFrame(browsing.focus);$('back').focus();
}
function browseLook(){
  const l=structuredClone(browsing.before),sides=browsing.sides==='both'?['left','right']:[browsing.sides];
  for(const s of sides){l.frame[s]=browsing.focus;l.own[s]=browsing.own;}return l;
}
function focusFrame(id,show=false){
  browsing.focus=id;const f=data.frames.find(x=>x.id===id),th=theme(),own=browsing.own,colors=own?finishes.styles[id].colors:th.frame;
  setSrc($('f-img'),previews.get('frame:'+id).getAttribute('src'));
  for(const b of $('f-grid').children)setSrc(b.querySelector('img'),previews.get('frame:'+b.dataset.value).getAttribute('src'));$('f-name').textContent=f.label;$('f-desc').textContent=SHAPES[id]?.[lang==='es'?1:0]||'';
  $('f-from').textContent=own?finishes.styles[id].label:t('frame.from',{theme:th.name});
  $('f-pal').replaceChildren(...finishes.roles.map(r=>el('span',{},el('i',{style:`background:${colors[r]}`}),own?finishes.styles[id].labels[r]:t('role.'+r))));
  $('f-own').textContent=own?t('frame.ownOn',{theme:th.name}):t('frame.own',{name:f.label});$('f-own').setAttribute('aria-pressed',String(own));
  $('f-apply').textContent=t('frame.apply',{name:f.label});
  for(const b of $('f-grid').children)b.classList.toggle('hover',b.dataset.value===id);
  if(show&&model){const l=browseLook();model.apply(l,th,{animate:false}).catch(failed);tag(l.frame.left===look.frame.left&&l.frame.right===look.frame.right&&l.own.left===look.own.left&&l.own.right===look.own.right?'':t('frame.previewing',{name:f.label}));}
}
function syncSides(){for(const b of $('sides').children)b.setAttribute('aria-pressed',String(b.dataset.side===browsing.sides));}
function closeBrowser(apply){
  if($('browser').hidden)return;
  $('browser').hidden=true;$('rail').hidden=false;tag('');
  if(apply)commit(browseLook(),{animate:true});else model?.apply(look,theme(),{animate:false}).catch(failed);
  $('browse').focus();
}
let tagEl=null;
function tag(text){
  if(!text){tagEl?.remove();tagEl=null;return;}
  tagEl??=$('stage').appendChild(el('span',{className:'chip preview-tag'}));tagEl.textContent=text;
}

// vertical layers slider
function slider(){
  const track=$('explode');let drag=false;
  const set=v=>{model?.setExplode(v);show(v);};
  const show=v=>{track.style.setProperty('--v',v);track.setAttribute('aria-valuenow',String(Math.round(v*100)));track.setAttribute('aria-valuetext',`${Math.round(v*100)} %`);};
  const at=e=>{const r=track.getBoundingClientRect();return Math.min(1,Math.max(0,(r.bottom-e.clientY)/r.height));};
  track.addEventListener('pointerdown',e=>{drag=true;track.setPointerCapture(e.pointerId);set(at(e));});
  track.addEventListener('pointermove',e=>{if(drag)set(at(e));});
  track.addEventListener('pointerup',()=>{drag=false;});track.addEventListener('pointercancel',()=>{drag=false;});
  track.addEventListener('keydown',e=>{
    const v=model?.explode??0,step={ArrowUp:.05,ArrowRight:.05,ArrowDown:-.05,ArrowLeft:-.05,PageUp:.2,PageDown:-.2}[e.key];
    if(step!==undefined){e.preventDefault();set(Math.min(1,Math.max(0,v+step)));}
    else if(e.key==='Home'){e.preventDefault();set(0);}else if(e.key==='End'){e.preventDefault();set(1);}
  });
  return show;
}

function buildSpecs(){
  $('specs').replaceChildren(...ART.map(([kind])=>{
    const art=el('div',{className:'art '+kind});
    if(kind==='sizes')art.append(...data.sizes.map(z=>{const img=el('img',{alt:''});mirror.push([img,'size:'+z.id]);return img;}));
    else if(kind==='frames')art.append(...frameIds.map(f=>{const img=el('img',{alt:''});mirror.push([img,'frame:'+f]);return img;}));
    else{const img=el('img',{alt:''});previews.set('spec:'+kind,img);art.append(img);}
    return el('div',{className:'spec'},art,el('span',{className:'lab'}),el('b'),el('p'));
  }));
}
// spec art that shows option thumbnails again
const mirror=[];
let specsNear=false;
new IntersectionObserver(([e],o)=>{if(e.isIntersecting){specsNear=true;o.disconnect();if(model)renderPreviews();}},{rootMargin:'600px 0px'}).observe(document.querySelector('.specs'));
function translate(){
  document.documentElement.lang=lang;
  for(const b of document.querySelectorAll('[data-lang]'))b.setAttribute('aria-pressed',String(b.dataset.lang===lang));
  for(const n of document.querySelectorAll('[data-t]'))n.textContent=t(n.dataset.t);
  for(const n of document.querySelectorAll('[data-t-label]'))n.setAttribute('aria-label',t(n.dataset.tLabel));
  for(const n of document.querySelectorAll('[data-t-title]'))n.title=t(n.dataset.tTitle);
  for(const n of document.querySelectorAll('[data-t-alt]'))n.alt=t(n.dataset.tAlt);
  const i=lang==='es'?1:0;
  for(const [n,card] of [...$('specs').children].entries()){const sp=SPECS[n];card.querySelector('.lab').textContent=sp[i];card.querySelector('b').textContent=Array.isArray(sp[2])?sp[2][i]:sp[2];card.querySelector('p').textContent=sp[3+i];}
  $('standby').title=model&&!model.standby?t('stage.play'):t('stage.pause');
  syncRail();if(!$('browser').hidden)focusFrame(browsing.focus);
}
function failed(error){console.error(error);const n=$('note');n.hidden=false;n.textContent=t('stage.failed');}

lang=store.get('flan.lang')==='es'?'es':'en';
buildRail();buildSpecs();paint();translate();reveal();
for(const b of document.querySelectorAll('[data-lang]'))b.addEventListener('click',()=>{lang=b.dataset.lang;store.set('flan.lang',lang);translate();});
$('browse').addEventListener('click',openBrowser);$('back').addEventListener('click',()=>closeBrowser(false));$('f-cancel').addEventListener('click',()=>closeBrowser(false));
$('f-apply').addEventListener('click',()=>closeBrowser(true));
$('f-own').addEventListener('click',()=>{browsing.own=!browsing.own;focusFrame(browsing.focus,true);});
for(const b of $('sides').children)b.addEventListener('click',()=>{browsing.sides=b.dataset.side;syncSides();focusFrame(browsing.focus,true);});
$('f-grid').addEventListener('pointerleave',()=>{if(!$('browser').hidden)focusFrame(browsing.focus,true);});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeBrowser(false);});
const showSlider=slider();

// the live model; without WebGL the poster and the rail still work
const probe=document.createElement('canvas');
if(!(probe.getContext('webgl2')||probe.getContext('webgl'))){$('note').hidden=false;$('note').textContent=t('stage.nogl');$('layers').hidden=true;document.querySelector('.stagebar').hidden=true;}
else{
  try{
    model=createModel({canvas:$('canvas'),packs:data.packs,onChange:({explode})=>showSlider(explode)});
    model.init(look,theme()).then(()=>{
      $('stage').classList.add('live');if(!model.intro())showSlider(model.explode);renderPreviews();
      $('standby').setAttribute('aria-pressed',String(model.standby));translate();
    }).catch(failed);
  }catch(e){failed(e);}
}
$('standby').addEventListener('click',()=>{if(!model)return;model.setStandby(!model.standby);$('standby').setAttribute('aria-pressed',String(model.standby));$('standby').title=model.standby?t('stage.pause'):t('stage.play');});
$('reset').addEventListener('click',()=>model?.resetView());
