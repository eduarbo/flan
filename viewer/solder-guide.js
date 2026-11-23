// SPDX-License-Identifier: GPL-3.0-or-later
import maps from '../design/solder-boards.json' with {type:'json'};
import {portableSolder} from './solder-portable.js';
import {solderPhoto} from './solder-photo.js';
import {guideCards,stepParts,inspectionParts,batteryId} from './guide-parts.js';
import {solderMotion} from './solder-motion.js';
import styles from './solder-guide-styles.js';
const steps=[
 ['D',true,['Diodos','Diodes'],['Empieza con un solo 1N4148W (SOD-123). Estaña un pad, sujeta el diodo con pinzas y calienta ese pad para fijarlo. Comprueba la banda y suelda el otro extremo. Repite por cada referencia D.','Start with one 1N4148W (SOD-123). Tin one pad, hold the diode with tweezers and reheat the pad to tack it down. Check the stripe, solder the opposite end, then repeat at each D reference.']],
 ['K',true,['Zócalos de teclas','Switch sockets'],['Asienta cada zócalo Kailh Choc en el reverso. Alinea sus dos terminales metálicos con los dos pads resaltados y comprueba el asiento antes de soldarlos. Los switches se insertan después desde la cara de teclas.','Seat each Kailh Choc socket on the underside. Align both metal tabs with the two highlighted pads and check that the socket sits flush before soldering. The switches plug in later from the key side.']],
 ['SW2',true,['Botón de reset','Reset button'],['Asienta el pulsador SW2 sobre sus cuatro pads. Fija una esquina, comprueba la alineación y suelda los terminales restantes.','Seat SW2 on its four pads. Tack one corner, check alignment and solder the remaining terminals.']],
 ['SW1',false,['Interruptor de encendido','Power switch'],['Coloca SW1 en su huella con el deslizador hacia el borde accesible. Alinea los contactos y las pestañas mecánicas antes de soldar.','Seat SW1 in its footprint with the slider facing the accessible edge. Align its contacts and mounting tabs before soldering.']],
 ['J1',false,['Conector de batería','Battery connector'],['Inserta el JST PH en J1 desde la cara de teclas y suelda los pines por el reverso. El pad 1 es BAT+ y el 2 es GND. Comprueba la polaridad del enchufe real con un multímetro antes de conectarlo.','Insert the JST PH at J1 from the key side and solder the pins on the underside. Pad 1 is BAT+ and pad 2 is GND. Check the actual battery plug polarity with a multimeter before connecting it.']],
 ['U1',false,['Zócalos del controlador','Controller sockets'],['Coloca dos tiras Mill-Max de 12 contactos en U1 por esta cara. Fija un extremo, comprueba que ambas tiras estén niveladas y suelda por el reverso. Para soldar los pines redondos al nice!nano usa el soporte impreso y deja 2.80 mm entre placas. Deja BOOST abierto.','Seat two 12-contact Mill-Max strips at U1 on this face. Tack one end, level the strips and solder from the underside. Support the nice!nano on its printed support when soldering its round pins and maintain a 2.80 mm board gap. Leave BOOST open.']],
 ['J2',false,['Zócalo de la pantalla','Display socket'],['Coloca el zócalo de cinco contactos en J2 por esta cara y suelda por el reverso. El par de conectores del nice!view deja 7.00 mm entre placas. Inserta las colas cortas del header en la pantalla y conserva los postes largos para el acoplamiento.','Seat the five-contact socket at J2 on this face and solder on the underside. The supplied nice!view connectors give a 7.00 mm board gap. Insert the short header tails into the display and keep the long posts for mating.']]
];
const ns='http://www.w3.org/2000/svg';

function draw(parent,tag,attrs,text){
 const node=document.createElementNS(ns,tag);
 for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);
 if(text)node.textContent=text;
 parent.append(node);return node;
}

function options(select,rows,value){
 select.replaceChildren(...rows.map(([key,label])=>new Option(label,key)));
 select.value=value;
}

function boxFor(points){
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 return {left:Math.min(...xs),right:Math.max(...xs),top:Math.min(...ys),bottom:Math.max(...ys)};
}

function label(svg,x,y,text,scale,extra={}){
 return draw(svg,'text',{x,y,'font-size':scale,'font-weight':650,'text-anchor':'middle',
  'paint-order':'stroke','stroke-linejoin':'round',stroke:'#172623','stroke-width':scale*.27,fill:'white',...extra},text);
}

function ring(svg,x,y,r){
 draw(svg,'circle',{cx:x,cy:y,r,fill:'none',stroke:'#182625','stroke-width':r*.40});
 draw(svg,'circle',{cx:x,cy:y,r,fill:'none',stroke:'#ffcd70','stroke-width':r*.19});
}

export function mountSolderGuide(host,sizeId,initialLanguage,initialSide='left',embedded=false,settings={}){
 const root=host.attachShadow({mode:'open'});
 root.innerHTML=`<style>${styles}</style><main>
 <header><h1 id="title"></h1><select aria-label="Idioma / Language" id="language"><option value="es">Español</option><option value="en">English</option></select></header>
 <p id="intro"></p><div class="tools"><label id="size-field"><span id="sizeLabel"></span><select id="size"></select></label><label><span id="sideLabel"></span><select id="side"></select></label></div>
 <nav id="controls"><button id="prev">←</button><div class="step-choice"><select id="step"></select><span id="progress" aria-hidden="true"></span></div><button id="next"></button></nav>
 <article class="stage"><div class="step-head" aria-live="polite" aria-atomic="true"><p id="face"></p><h2 id="heading" tabindex="-1"></h2></div>
 <figure class="board-figure"><svg id="map" role="img"></svg><figcaption id="caption" class="meta"></figcaption></figure>
 <div class="part-step"><h3 id="parts-title"></h3><div id="part"></div><div id="instruction"></div></div><div id="motion"></div>
 <div class="pad-detail"><div class="reference"><h3 id="zoom-title"></h3><button id="overview-link"></button><label id="ref-field"><span id="ref-label"></span><select id="reference"></select></label></div><div id="detail" class="detail"></div>
 <p role="status" id="status"></p><button id="retry" hidden></button></div></article>
 <div id="workbench-tools"></div><h3 id="bench" tabindex="-1"></h3><div id="inspection"></div><ol id="checks"></ol><div class="finish"><button id="other-side"></button><button id="firmware" hidden></button></div><p id="origin" class="meta"></p><button id="portable"></button></main>`;
 host.toggleAttribute('data-embedded',embedded);
 const $=id=>root.getElementById(id);
 let lang=initialLanguage==='en'?'en':'es',index=Number(settings.step)||0,selectedRef=settings.ref;
 if(globalThis.flanSolderBuild)$('size-field').hidden=true;
 if(!Number.isInteger(index)||!steps[index])index=0;
 const tr=(es,en)=>lang==='es'?es:en;
 let visible=!embedded,observer,revision=0,photoRequest,photoKey;
 const optionsFor=side=>settings[side]||{};
 const getState=()=>({side:$('side').value,step:index,ref:selectedRef});
 host.solderState=getState;

 // The build panel has its own scroller and sticky section tabs. Scroll it once,
 // after the new step's height is known, leaving both sets of controls visible.
 function reveal(element){
  const panel=embedded?host.closest('#inspector'):null;
  const scroller=panel||document.scrollingElement;
  const inset=panel?panel.getBoundingClientRect().top+host.closest('#build-workflow').querySelector('#build-nav').offsetHeight:0;
  const top=$('controls').getBoundingClientRect().top;
  const heading=element.getBoundingClientRect().top;
  // At the start of the guide, leave the surrounding build page in place.
  if(heading<inset+$('controls').offsetHeight||heading>inset+$('controls').offsetHeight+16||top>inset+1)
   scroller.scrollBy({top:heading-inset-$('controls').offsetHeight-8,behavior:'instant'});
  if(root.activeElement?.disabled)$(index===0?'next':'prev').focus({preventScroll:true});
 }

 function changeStep(next){
  if(!steps[next])return;
  const wasPrevious=root.activeElement===$('prev');
  index=next;selectedRef=null;render();reveal($('heading').parentElement);
  if(wasPrevious&&index===0)$('next').focus({preventScroll:true});
 }

 host.showSolderStep=ref=>{
  const step=steps.findIndex(([prefix])=>prefix===ref);if(step>=0)changeStep(step);
 };

 function render(){
  const size=$('size').value,side=$('side').value,board=maps[size][side],[prefix,back,names,copy]=steps[index];
  host.lang=lang;
  $('title').textContent=tr('Guía de soldadura Flan','Flan soldering guide');
  $('intro').textContent=tr('Desconecta el USB y ambas baterías. Orienta la PCB por su contorno y los agujeros de montaje.','Disconnect USB and both batteries. Orient the PCB by its outline and mounting holes.');
  $('sizeLabel').textContent=tr('Tamaño','Size');$('sideLabel').textContent=tr('Mitad','Half');
  options($('side'),[['left',tr('Izquierda','Left')],['right',tr('Derecha','Right')]],side);
  options($('step'),steps.map((s,i)=>[String(i),`${i+1}/${steps.length} · ${tr(...s[2])}`]),String(index));
  $('progress').textContent=tr('Paso '+(index+1)+' de '+steps.length,'Step '+(index+1)+' of '+steps.length);
  $('controls').setAttribute('aria-label',tr('Pasos de soldadura','Soldering steps'));
  $('step').setAttribute('aria-label',tr('Paso','Step'));
  $('prev').setAttribute('aria-label',tr('Anterior','Previous'));
  $('prev').title=tr('Anterior','Previous');$('next').textContent=index===steps.length-1?tr('Revisar →','Inspect →'):tr('Siguiente →','Next →');
  $('prev').disabled=index===0;$('other-side').textContent=tr('Soldar la otra mitad','Solder the other half');
  $('firmware').hidden=!settings.onFirmware;$('firmware').textContent=tr('Continuar a firmware →','Continue to firmware →');
  const face=back?tr('Reverso · vista desde abajo','Underside · viewed from below'):tr('Cara de teclas · vista desde arriba','Key side · viewed from above');
  const descriptor=[size.replace('flan','Flan'),$('side').selectedOptions[0].text,face].join(' · ');
  $('face').textContent=descriptor;$('heading').textContent=tr(...names);$('instruction').textContent=tr(...copy);
  const battery=batteryId(optionsFor(side).battery);
  $('parts-title').textContent=tr('Piezas de este paso','Parts for this step');
  $('part').replaceChildren(guideCards(stepParts(prefix,battery),lang,{quantity:prefix==='U1'?{strip:2,pins:24,riser:1,nano:1}:{}}));
  const instructions={
   U1:[tr('Pon las dos tiras de 12 contactos en U1, con las bocas hacia arriba. Fija un extremo de cada tira, nivélalas y suelda sus patillas por el reverso.','Place both 12-contact strips in U1, openings up. Tack one end of each, level them, then solder their tails on the underside.'),
    tr('Presenta el nice!nano en el soporte con el USB-C hacia la flecha del mapa. Deja libres B+ y B−, los dos orificios más próximos al USB-C.','Rest the nice!nano on its support with USB-C toward the arrow on the board map. Leave the two holes closest to USB-C, B+ and B−, empty.'),
    tr('Alinea los 24 pines redondos con los zócalos. Verifica la separación antes de soldar los pines al controlador. El puente de carga BOOST queda abierto.','Align the 24 round pins with the sockets. Check the gap before soldering the pins to the controller. Leave the BOOST charging jumper open.')],
   J2:[tr('Introduce el zócalo hembra en J2 desde la cara de teclas y suelda por el reverso.','Insert the female socket into J2 from the key side and solder on the underside.'),
    tr('Coloca las cinco colas cortas del conector macho en la pantalla y suéldalas allí. Conserva los postes largos para el acoplamiento.','Insert the five short header tails into the display and solder them there. Keep the long posts for mating.'),
    tr('Presenta la pantalla sobre su soporte, alinea el pin 1 con el detalle de J2 e introduce los cinco postes rectos en el zócalo.','Rest the display on its support, align pin 1 with the J2 close-up and guide all five posts straight into the socket.')]
  };
  if(instructions[prefix]){
   const ol=document.createElement('ol');for(const line of instructions[prefix]){const li=document.createElement('li');li.textContent=line;ol.append(li);}
   $('instruction').replaceChildren(ol);$('motion').replaceChildren(solderMotion(prefix,side,lang));
  }else $('motion').replaceChildren(...(prefix==='K'?[solderMotion(prefix,side,lang)]:[]));
  const toolsHeading=document.createElement('h3');toolsHeading.textContent=tr('Herramientas para soldar','Soldering tools');
  $('workbench-tools').replaceChildren(toolsHeading,guideCards(['iron','solder','tweezers'],lang));
  $('inspection').replaceChildren(guideCards(inspectionParts.map(id=>id==='battery'?battery:id),lang));
  const bounds=boxFor(board.outline),{left,right,top,bottom}=bounds,width=right-left,height=bottom-top;
  const X=x=>back?right+left-x:x;
  const refs=Object.keys(board.parts).filter(r=>prefix==='D'||prefix==='K'?r.startsWith(prefix):r===prefix);
  if(!refs.includes(selectedRef))selectedRef=refs[0];
  $('ref-field').hidden=refs.length<2;
  $('ref-label').textContent=tr('Posición','Position');
  options($('reference'),refs.map(ref=>[ref,ref]),selectedRef);
  const svg=$('map');svg.replaceChildren();svg.setAttribute('aria-label',descriptor+' · '+tr(...names));
  svg.setAttribute('viewBox',[left-2,top-4,width+4,height+6].join(' '));
  const photoAttrs={x:left,y:top,width,height,preserveAspectRatio:'none'};
  const overview=draw(svg,'image',photoAttrs);
  for(const ref of refs){
   const points=board.parts[ref].map(([x,y,n])=>[X(x),y,n]),b=boxFor(points),cx=(b.left+b.right)/2;
   const g=draw(svg,'g',{class:'photo-group','data-ref':ref});
   draw(g,'rect',{x:b.left-1.5,y:b.top-1.3,width:b.right-b.left+3,height:b.bottom-b.top+2.6,rx:1.2,fill:'transparent',stroke:'#182625','stroke-width':.85});
   draw(g,'rect',{x:b.left-1.5,y:b.top-1.3,width:b.right-b.left+3,height:b.bottom-b.top+2.6,rx:1.2,fill:'none',stroke:ref===selectedRef?'#ffcf70':'#fff8dc','stroke-width':.4});
   label(g,cx,b.top-1.9,ref,2.7);
   if(refs.length>1)g.onclick=()=>{
    selectedRef=ref;render();
    if(host.clientWidth<680)reveal($('zoom-title').parentElement);
   };
  }
  $('overview-link').textContent=tr('Ver placa','View board');
  $('caption').hidden=refs.length<2;
  $('caption').textContent=refs.length>1?tr('Toca una referencia para ampliar esas soldaduras.','Tap a reference to enlarge those joints.'):descriptor;
  const points=board.parts[selectedRef].map(([x,y,n])=>[X(x),y,n]),b=boxFor(points);
  const detail=$('detail');detail.replaceChildren();$('zoom-title').textContent=tr('Detalle','Close-up')+' · '+selectedRef;
  let zx=b.left-3.5,zy=b.top-3.5,zw=b.right-b.left+7,zh=b.bottom-b.top+7;
  if(prefix==='J1'){zx=b.left-7;zw=16;zy=b.top-4;zh=10;}
  if(prefix==='U1'){zx=b.left-3;zw=b.right-b.left+6;zy=b.top-5.5;zh=16;}
  const zoom=draw(detail,'svg',{viewBox:[zx,zy,zw,zh].join(' '),role:'img','aria-label':selectedRef+' · '+tr('Ampliación','Close-up')});
  const closeup=draw(zoom,'image',photoAttrs);
  for(const [x,y,n] of points){
   if(prefix==='D'||prefix==='J1'||prefix==='J2'){
    if(n==='1')ring(zoom,x,y,prefix==='D'?1.0:.80);
    if(prefix==='J1')label(zoom,x+1.4,y+.04,n==='1'?'1 BAT+':'2 GND',1.12,{'data-pin':n,'text-anchor':'start','dominant-baseline':'middle'});
    else label(zoom,x,y+2.05,prefix==='D'?(n==='1'?'K':'A'):n,1.2);
   }else if(prefix==='U1'&&['D1','RAW','RST','VCC'].includes(n)){
    if(n==='RAW')ring(zoom,x,y,.92);
    label(zoom,x+(n==='D1'?1.3:-1.3),y,n,1.25,{'text-anchor':n==='D1'?'start':'end','dominant-baseline':'middle'});
   }else if(prefix==='K'||prefix==='SW1'||prefix==='SW2'){
    ring(zoom,x,y,prefix==='K'?1.65:.66);
   }
  }
  if(prefix==='U1')label(zoom,(b.left+b.right)/2,b.top-2.5,'↑ USB-C',1.6);
 const descriptions={
  D:tr('K marca el pad 1 del render. Alinea aquí la banda del cátodo del diodo. El otro extremo es el ánodo (A).','K marks pad 1 on the render. Align the diode cathode stripe with this pad. The other end is the anode (A).'),
  J1:tr('Pin 1 positivo, pin 2 tierra. Con la placa sin energía, usa continuidad para identificar el contacto del jack que llega al pad 1. Mide aparte el voltaje y la polaridad del enchufe de la batería y haz coincidir su positivo con ese contacto.','Pin 1 positive, pin 2 ground. With the board unpowered, use continuity to locate the jack contact connected to pad 1. Separately measure the battery plug voltage and polarity, then match its positive contact to that jack contact.'),
  U1:tr('Antes de soldar los pines, presenta el nice!nano con el USB-C hacia el borde indicado. Haz coincidir RAW, RST y VCC con el mapa. Los dos orificios B+ y B− del extremo USB del módulo quedan libres.','Before soldering the pins, dry-fit the nice!nano with USB-C at the indicated edge. Match RAW, RST and VCC to the map. Leave the two B+ and B− holes at the USB end of the module free.'),
  J2:tr('Haz coincidir los cinco pines del nice!view con J2 antes de soldar el header. Del 1 al 5 son MOSI, SCK, VCC, GND y CS. El pin 1 está marcado en la ampliación.','Match all five nice!view pins to J2 before soldering the header. Pins 1 through 5 are MOSI, SCK, VCC, GND and CS. Pin 1 is marked in the close-up.')
 };
  if(descriptions[prefix]){const note=document.createElement('p');note.textContent=descriptions[prefix];detail.append(note);}
 $('bench').textContent=tr('Antes de conectar energía','Before applying power');$('checks').replaceChildren();
 for(const pair of [['Inspecciona ambos lados con lupa. Busca puentes de estaño, pines sin soldar y diodos invertidos.','Inspect both faces under magnification for solder bridges, unsoldered pins and reversed diodes.'],['Con baterías, USB y controladores desconectados, comprueba con el multímetro que no haya un corto sostenido entre alimentación y tierra. Si lo hay, localízalo antes de seguir.','With batteries, USB and controllers disconnected, use a meter to check for a sustained power-to-ground short. Resolve any short before proceeding.']]){const li=document.createElement('li');li.textContent=tr(...pair);$('checks').append(li);}
  $('origin').textContent=tr('Vistas de las PCB de fabricación. Montaje físico del prototipo pendiente de validación.','Fabrication PCB views. Physical assembly of the prototype awaits validation.');
  const credits=document.createElement('a');credits.href='https://github.com/eduarbo/flan/blob/main/components/README.md';
  credits.textContent=tr('Modelos y créditos','Models and credits');$('origin').append(' ',credits);
  $('portable').hidden=embedded||Boolean(globalThis.flanSolderBuild);
  $('portable').textContent=tr('Guardar guía sin conexión','Save guide offline');
  const token=++revision;
  const appearance=optionsFor(side),key=JSON.stringify([size,side,back,appearance]);
  const prepare=async()=>{
   if(!photoRequest||key!==photoKey){photoKey=key;photoRequest=solderPhoto(size,side,back,appearance);}
   try{
    const url=await photoRequest;
    if(token!==revision)return;
    for(const img of [overview,closeup])img.setAttribute('href',url);
    $('status').textContent='';$('retry').hidden=true;
   }catch(error){
    if(token===revision){
     photoRequest=null;$('status').textContent=tr('No se pudo cargar la vista de la PCB.','The PCB view could not load.');
     $('retry').textContent=tr('Reintentar','Retry');$('retry').hidden=false;
    }
    throw error;
   }
  };
  host.prepareSolderPhoto=prepare;
  if(visible)prepare().catch(()=>{});
  settings.onChange?.(getState());
 }
 options($('size'),Object.keys(maps).map(k=>[k,k.replace('flan','Flan')]),Object.hasOwn(maps,sizeId)?sizeId:'flan36');
 options($('side'),[['left',''],['right','']],initialSide==='right'?'right':'left');
 $('language').value=lang;$('language').onchange=e=>{lang=e.target.value;render();};
 $('size').onchange=$('side').onchange=()=>{render();};
 $('step').onchange=e=>changeStep(Number(e.target.value));
 $('reference').onchange=e=>{selectedRef=e.target.value;render();};
 $('prev').onclick=()=>changeStep(index-1);$('next').onclick=()=>{
  if(index<steps.length-1){changeStep(index+1);return;}
  reveal($('bench'));$('bench').focus({preventScroll:true});
 };
 $('other-side').onclick=()=>{$('side').value=$('side').value==='left'?'right':'left';changeStep(0);};
 $('firmware').onclick=()=>settings.onFirmware?.();
 $('overview-link').onclick=()=>reveal($('heading').parentElement);
 $('portable').onclick=async()=>{
  $('portable').disabled=true;
  try{
   const {html}=await portableSolder($('size').value,lang,getState(),settings);
   const url=URL.createObjectURL(new Blob([html],{type:'text/html'})),link=document.createElement('a');
   link.href=url;link.download=$('size').value+'-solder.html';link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
  }catch{$('status').textContent=tr('No se pudo guardar la guía. Inténtalo de nuevo.','The guide could not be saved. Try again.');}
  finally{$('portable').disabled=false;}
 };
 $('retry').onclick=()=>host.prepareSolderPhoto().catch(()=>{});
 render();
 if(embedded){
  observer=new IntersectionObserver(entries=>{
   if(!entries.some(e=>e.isIntersecting))return;
   visible=true;observer.disconnect();host.prepareSolderPhoto().catch(()=>{});
  },{rootMargin:'160px'});observer.observe(host);
 }
 host.disconnectSolder=()=>observer?.disconnect();
}
