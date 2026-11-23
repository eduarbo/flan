// SPDX-License-Identifier: GPL-3.0-or-later
import maps from '../design/solder-boards.json' with {type:'json'};

export function mountSolderGuide(host, sizeId, initialLanguage, initialSide='left', embedded=false, illustrate){
 const root=host.attachShadow({mode:'open'});
 root.innerHTML=`<style>
*{box-sizing:border-box}:host{display:block;margin:0;background:#faf7ef;color:#252c26;font:16px/1.5 system-ui,sans-serif}main{max-width:980px;margin:auto;padding:clamp(16px,4vw,44px)}header,.tools,.detail{display:flex;gap:16px;align-items:center;flex-wrap:wrap}header{justify-content:space-between}h1,h2{font-family:Georgia,serif;font-weight:500;line-height:1.12;margin:.5em 0}h1{font-size:clamp(30px,5vw,50px)}h2{font-size:26px}label{display:grid;font-weight:600;gap:4px}select,button{font:inherit;color:inherit;background:white;border:1px solid #8b9489;border-radius:6px;padding:8px;min-height:44px}select:focus-visible,button:focus-visible{outline:3px solid #397184}.tools{margin:20px 0}.stage{background:white;border:1px solid #c7cdc0;border-radius:12px;padding:clamp(12px,3vw,24px)}svg{width:100%;height:auto;display:block}.diagram{background:#e9eee5;border-radius:8px}.card{margin:1em 0}.detail{align-items:center}.detail svg{max-width:190px;background:#e9eee5;border-radius:6px}.detail p{flex:1;min-width:160px}.meta{color:#516152;font-size:.9em}.steps{padding-left:22px}.steps li{padding:.25em 0}.face{font-weight:650}nav{display:flex;gap:.5em;justify-content:space-between;margin-top:16px}button:disabled{opacity:.45}@media print{:host,main{background:white;padding:0}.tools,header select,nav,button{display:none!important}.stage{break-inside:avoid}h1{font-size:23pt}.diagram{max-height:105mm}*{print-color-adjust:exact}}

 .part-step{display:flex;align-items:center;gap:10px}.part-step #part:empty{display:none}.part-step img{display:block;width:76px;height:auto}.part-step p{flex:1}
 :host([data-embedded]) main{padding:0;background:transparent}
 :host([data-embedded]) header,:host([data-embedded]) label:has(#size){display:none}
 :host([data-embedded]) .tools{gap:8px;margin:12px 0}
 :host([data-embedded]) .tools label{flex:1;min-width:105px}
 :host([data-embedded]) .tools select{width:100%;min-width:0}
 :host([data-embedded]) .stage{padding:12px}
 </style><main><header><h1 id="title"></h1><select aria-label="Idioma / Language" id="language"><option value="es">Español</option><option value="en">English</option></select></header>
<p id="intro"></p><div class="tools"><label><span id="sizeLabel"></span><select id="size"></select></label><label><span id="sideLabel"></span><select id="side"></select></label><label><span id="stepLabel"></span><select id="step"></select></label></div>
<article class="stage" aria-live="polite"><p id="face" class="face"></p><h2 id="heading"></h2><div class="part-step"><div id="part"></div><p id="instruction"></p></div><svg id="map" class="diagram" role="img"></svg><p id="caption" class="meta"></p><div id="detail" class="detail"></div><nav><button id="prev"></button><button id="next"></button></nav></article>
<h2 id="bench"></h2><ol id="checks" class="steps"></ol><p id="origin" class="meta"></p></main>`;
 host.toggleAttribute('data-embedded',embedded);
 const $=id=>root.getElementById(id);
 let lang=initialLanguage==='en'?'en':'es',index=0;
const tr=(es,en)=>lang==='es'?es:en;
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
function draw(parent,tag,attrs,content){const n=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);if(content)n.textContent=content;parent.append(n);return n;}
function options(id,rows,value){const box=$(id);box.replaceChildren(...rows.map(([key,label])=>new Option(label,key)));box.value=value;}
function render(){
 const size=$('size').value,side=$('side').value,board=maps[size][side],[prefix,back,names,copy]=steps[index];
 host.lang=lang;$('title').textContent=tr('Guía de soldadura Flan','Flan soldering guide');
 $('intro').textContent=tr('Trabaja con una mitad a la vez. Desconecta el USB y ambas baterías. Orienta la placa por su contorno y los agujeros grandes. D, K, J, SW y U son referencias del diagrama.','Work on one half at a time. Unplug USB and both batteries. Orient the physical board by its outline and large mounting holes. D, K, J, SW and U are diagram references.');
 $('sizeLabel').textContent=tr('Tamaño','Size');$('sideLabel').textContent=tr('Mitad','Half');$('stepLabel').textContent=tr('Paso','Step');
 options('side',[['left',tr('Izquierda','Left')],['right',tr('Derecha','Right')]],side);
 options('step',steps.map((s,i)=>[String(i),(i+1)+'. '+tr(...s[2])]),String(index));
 const face=back?tr('Reverso · vista desde abajo','Underside · viewed from below'):tr('Cara de teclas · vista desde arriba','Key side · viewed from above');
 const descriptor=size.replace('flan','Flan')+' · '+$('side').selectedOptions[0].text+' · '+face;
 $('face').textContent=descriptor;$('heading').textContent=tr(...names);$('instruction').textContent=tr(...copy);
 const art=$('part');art.replaceChildren();
 if(illustrate){
  const component={D:'diode',K:'socket',SW2:'reset',SW1:'power',J1:'jack',U1:'nano',J2:'view'}[prefix];
  const img=document.createElement('img');img.alt=tr(...names);img.width=120;img.height=90;
  art.append(img);illustrate(img,component);
 }
 const svg=$('map');svg.replaceChildren();svg.setAttribute('aria-label',descriptor+' · '+tr(...names));
 const xs=board.outline.map(p=>p[0]),ys=board.outline.map(p=>p[1]),xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
 const X=x=>back?xmax+xmin-x:x;
 svg.setAttribute('viewBox',[xmin-4,ymin-4,xmax-xmin+8,ymax-ymin+8].join(' '));
 draw(svg,'polygon',{points:board.outline.map(([x,y])=>[X(x),y].join(',')).join(' '),fill:'#244b43',stroke:'#15372e','stroke-width':.6});
 for(const [x,y] of board.holes)draw(svg,'circle',{cx:X(x),cy:y,r:1.4,fill:'#e9eee5'});
 const matches=ref=>prefix==='D'||prefix==='K'?ref.startsWith(prefix):ref===prefix;
 const refs=Object.entries(board.parts).filter(([r])=>matches(r));
 function footprint(target,ref,pads,detail){
  const active=matches(ref);
  const xs=pads.map(p=>X(p[0])),ys=pads.map(p=>p[1]),cx=(Math.min(...xs)+Math.max(...xs))/2;
  if(active&&prefix==='J1'){
   const [x,y,width,height]=board.bodies.J1;
   draw(target,'rect',{x,y,width,height,fill:'none',stroke:'#b9d6c3','stroke-width':.25});
  }
  if(active&&prefix==='D')draw(target,'line',{x1:xs[0],y1:ys[0],x2:xs[1],y2:ys[1],stroke:'#e7ca89','stroke-width':1.5});
  pads.forEach(([x,y,num])=>{
   const mark=active&&((['D','J1','J2'].includes(prefix)&&num==='1')||(prefix==='U1'&&num==='RAW'));
   draw(target,mark?'rect':'circle',mark?{x:X(x)-.75,y:y-.75,width:1.5,height:1.5,fill:'#fff8dc',stroke:'#26281e','stroke-width':.15}:{cx:X(x),cy:y,r:active ? .75 : .35,fill:active?'#ffbd65':'#74968b'});
   if(!detail)return;
   const props={fill:'#fff','font-weight':650,'font-size':1.2};
   if(prefix==='J1'){
    draw(target,'text',{...props,x:X(x)+1.35,y:y+.04,'dominant-baseline':'middle','data-pin':num},num==='1'?'1 BAT+':'2 GND');
   }else if(prefix==='U1'){
    if(['D1','RAW','RST','VCC'].includes(num))draw(target,'text',{...props,x:X(x)+(num==='D1'?1.35:-1.35),y:y+.1,'text-anchor':num==='D1'?'start':'end','dominant-baseline':'middle'},num);
   }else{
    const labels=prefix==='D'?{'1':'K','2':'A'}:{'1':'1','2':'2','3':'3','4':'4','5':'5'};
    draw(target,'text',{...props,x:X(x),y:y+2.25,'text-anchor':'middle'},labels[num]);
   }
  });
  if(detail&&prefix==='U1')draw(target,'text',{x:cx,y:Math.min(...ys)-2.4,'text-anchor':'middle',fill:'#fff','font-size':1.6},'↑ USB-C');
  if(active&&!detail)draw(target,'text',{x:cx,y:Math.min(...ys)-1.55,'text-anchor':'middle','font-size':2.55,'font-weight':700,fill:'#fff'},ref);
 }
 for(const [ref,pads] of Object.entries(board.parts)){
  if(!matches(ref)&&((back&&ref==='SW1')||(!back&&(/^[DK]/.test(ref)||ref==='SW2'))))continue;
  footprint(svg,ref,pads,false);
 }
 $('caption').textContent=tr('Las marcas doradas señalan los pads de este paso. Los orificios grandes sirven de referencia para orientar la placa.','Gold marks show the pads for this step. Use the large mounting holes to orient the board.');
 const detail=$('detail');detail.replaceChildren();
 const descriptions={
  D:tr('El cuadrado claro marca el pad 1 (K). Alinea aquí la banda del cátodo del diodo. El otro extremo es el ánodo (A).','The light square marks pad 1 (K). Align the diode cathode stripe with this pad. The other end is the anode (A).'),
  J1:tr('Pin 1 positivo, pin 2 tierra. La línea verde dibuja el cuerpo del jack. Con la placa sin energía, usa continuidad para identificar el contacto del jack que llega al pad 1. Mide aparte el voltaje y la polaridad del enchufe de la batería y haz coincidir su positivo con ese contacto.','Pin 1 positive, pin 2 ground. The green outline shows the jack body. With the board unpowered, use continuity to locate the jack contact connected to pad 1. Separately measure the battery plug voltage and polarity, then match its positive contact to that jack contact.'),
  U1:tr('Antes de soldar los pines, presenta el nice!nano con el USB-C hacia el borde indicado. Haz coincidir RAW, RST y VCC con el mapa. Los dos orificios B+ y B− del extremo USB del módulo quedan libres.','Before soldering the pins, dry-fit the nice!nano with USB-C at the indicated edge. Match RAW, RST and VCC to the map. Leave the two B+ and B− holes at the USB end of the module free.'),
  J2:tr('Haz coincidir los cinco pines del nice!view con J2 antes de soldar el header. Del 1 al 5 son MOSI, SCK, VCC, GND y CS. El cuadrado claro marca MOSI.','Match all five nice!view pins to J2 before soldering the header. Pins 1 through 5 are MOSI, SCK, VCC, GND and CS. The light square marks MOSI.')
 };
 if(descriptions[prefix]){
  const [ref,pads]=refs[0],xs=pads.map(p=>X(p[0])),ys=pads.map(p=>p[1]);
  let bounds=[Math.min(...xs)-2.5,Math.min(...ys)-3,Math.max(...xs)+2.5,Math.max(...ys)+4];
  if(prefix==='J1'){
   const [x,y,w,h]=board.bodies.J1;
   bounds=[Math.min(x,xs[0]-2)-1,y-1,Math.max(x+w,xs[0]+7)+1,y+h+1];
  }
  if(prefix==='U1')bounds=[Math.min(...xs)-2,Math.min(...ys)-5.5,Math.max(...xs)+2,Math.min(...ys)+10];
  const [x,y,right,bottom]=bounds,width=right-x,height=bottom-y;
  const zoom=draw(detail,'svg',{viewBox:[x,y,width,height].join(' '),role:'img','aria-label':ref+' · '+tr('Detalle de orientación','Orientation detail')});
  draw(zoom,'rect',{x,y,width,height,fill:'#244b43'});footprint(zoom,ref,pads,true);
  const label=document.createElement('p');label.textContent=ref+' · '+descriptions[prefix];detail.append(label);
 }
 $('bench').textContent=tr('Antes de conectar energía','Before applying power');$('checks').replaceChildren();
 for(const pair of [['Inspecciona ambos lados con lupa. Busca puentes de estaño, pines sin soldar y diodos invertidos.','Inspect both faces under magnification for solder bridges, unsoldered pins and reversed diodes.'],['Con baterías, USB y controladores desconectados, comprueba con el multímetro que no haya un corto sostenido entre alimentación y tierra. Si lo hay, localízalo antes de seguir.','With batteries, USB and controllers disconnected, use a meter to check for a sustained power-to-ground short. Resolve any short before proceeding.']]){const li=document.createElement('li');li.textContent=tr(...pair);$('checks').append(li);}
 $('origin').textContent=tr('Mapas de las PCB KiCad de Flan36 rev I y Flan42/46/54. El montaje físico del prototipo está pendiente de validación.','Maps from the Flan36 rev I and Flan42/46/54 KiCad boards. Physical assembly of the prototype awaits validation.');
 $('prev').textContent=tr('← Anterior','← Previous');$('next').textContent=tr('Siguiente →','Next →');$('prev').disabled=index===0;$('next').disabled=index===steps.length-1;
}
options('size',Object.keys(maps).map(k=>[k,k.replace('flan','Flan')]),Object.hasOwn(maps,sizeId)?sizeId:'flan36');
options('side',[['left',''],['right','']],initialSide==='right'?'right':'left');
$('language').value=lang;$('language').onchange=e=>{lang=e.target.value;render()};$('size').onchange=$('side').onchange=render;
$('step').onchange=e=>{index=Number(e.target.value);render()};$('prev').onclick=()=>{index--;render()};$('next').onclick=()=>{index++;render()};render();
}
