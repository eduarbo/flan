// SPDX-License-Identifier: GPL-3.0-or-later
import parts from '../design/build-parts.json';
import {language,t} from './i18n.js';
import {selectedParts,keycapPlan} from './printing.js';

const sides=['left','right'],raw=p=>'https://raw.githubusercontent.com/eduarbo/flan/main/'+p;
const say=(en,es)=>language()==='es'?es:en;
const local=value=>value[language()]||value.en;
export function shoppingList(config,family){
 const size=family[config.variant],keys=size.keys_total;
 const m6=6+sides.reduce((n,side)=>n+Object.keys(size.fasteners?.[side]||{}).length,0);
 return parts.items.flatMap(item=>{
  const battery=String(item.quantity).startsWith('battery:')?String(item.quantity).slice(8):null;
  const halves=battery?sides.filter(side=>config.batteries[side]===battery):[];
  const required=battery?halves.length:({keys,m6,'frame-magnets':sides.filter(side=>config.cases[side].cover).length*3}[item.quantity]??item.quantity);
  if(!required)return [];
  const packs=item.pack?Math.ceil((required+(item.quantity==='keys'?4:0))/item.pack):null;
  const buy=packs?packs*item.pack:item.buy||required;
  return [{...item,required,packs,buy,halves,token:[item.id,required,buy,...halves].join(':')}];
 });
}
const node=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;};
const link=(text,url)=>{const a=node('a','',text);a.href=url;a.target='_blank';a.rel='noopener';return a;};
const download=(filename,content,type)=>{const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);};
const list=(items,ordered=true)=>{const n=node(ordered?'ol':'ul','build-instructions');for(const text of items)n.append(node('li','',text));return n;};
function details(id,title,contents){const d=node('details','build-detail');d.id=id;d.append(node('summary','',title),...contents);return d;}
const orderText=row=>row.packs?say('Buy '+row.packs+' pack'+(row.packs===1?'':'s')+' × '+row.pack+' = '+row.buy,'Compra '+row.packs+' paquete'+(row.packs===1?'':'s')+' × '+row.pack+' = '+row.buy):say('Order '+row.buy,'Pide '+row.buy);

export function createBuildGuide({catalog,family,inventory,getDesignLink}){
 const $=id=>document.getElementById(id),storageKey='flan.build-parts.v1';
 let current,rows=[],checked={},savedDetails=new Set();
 try{const value=JSON.parse(localStorage.getItem(storageKey)||'{}');if(value&&typeof value==='object'&&!Array.isArray(value))checked=value;}catch{}
 function progress(){const count=rows.filter(r=>checked[r.id]===r.token).length;$('build-shopping-progress').textContent=say(count+' of '+rows.length+' lines ready',count+' de '+rows.length+' partidas listas');}
 function renderShopping(){
  rows=shoppingList(current,family);const target=$('build-shopping');target.replaceChildren();
  for(const supplier of [...new Set(rows.map(r=>r.supplier))]){
   const group=node('section','shopping-group');group.append(node('h4','',supplier==='workbench'?say('Magnets & tools','Imanes y herramientas'):supplier));
   for(const row of rows.filter(r=>r.supplier===supplier)){
    const item=node('div','shopping-row');item.dataset.part=row.id;item.dataset.required=row.required;item.dataset.buy=row.buy;
    const label=node('label','shopping-check'),input=node('input');input.type='checkbox';input.checked=checked[row.id]===row.token;
    input.setAttribute('aria-label',say('Ready: ','Listo: ')+local(row.name));
    label.append(input,node('span','sr-only',say('Ready','Listo')));
    input.onchange=()=>{if(input.checked)checked[row.id]=row.token;else delete checked[row.id];try{localStorage.setItem(storageKey,JSON.stringify(checked));}catch{$('build-shopping-status').textContent=say('Checklist stays in this tab. Download the list to keep it.','La lista marcada queda en esta pestaña. Descárgala para conservarla.');}progress();};
    const body=node('div','shopping-body'),name=node('strong','',local(row.name));
    const quantity=node('p','shopping-quantity',say('Need ','Necesitas ')+row.required+(row.halves.length?' · '+row.halves.map(s=>t('side.'+s)).join(' + '):''));
    body.append(name,quantity,node('p','micro',local(row.note)));
    if(row.url){const a=link(orderText(row)+' ↗',row.url);a.className='shopping-buy';body.append(a);}
    item.append(label,body);group.append(item);
   }target.append(group);
  }progress();
 }
 function csv(){
  const header=say(['Item','Supplier','Required','Order quantity','Packs','Ready','For half','Selection / notes','URL'],['Pieza','Proveedor','Necesarias','Cantidad de compra','Paquetes','Lista','Mitad','Selección / notas','URL']);
  const values=rows.map(r=>[local(r.name),r.supplier==='workbench'?say('Workbench','Taller'):r.supplier,r.required,r.buy,r.packs||'',checked[r.id]===r.token?say('Yes','Sí'):'',r.halves.map(s=>t('side.'+s)).join(' + '),local(r.note),r.url]);
  return '\uFEFF'+[header,...values].map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n';
 }
 async function exportPlan(){
  const copy=$('build-workflow').cloneNode(true),title=family[current.variant].title+' · '+say('Build plan','Plan de construcción'),filename=family[current.variant].title+'-build-plan.html';
  const exactLink=getDesignLink();
  copy.querySelectorAll('button,.build-jumps,[role=status]').forEach(n=>n.remove());
  copy.querySelectorAll('details').forEach(n=>n.open=true);
  copy.querySelectorAll('input').forEach(n=>{if(n.type==='checkbox'){if(n.checked)n.setAttribute('checked','');n.disabled=true;}else n.remove();});
  try{const a=link(say('Open this exact design to download its print kit','Abrir este diseño exacto para descargar su kit de impresión'),await exactLink);a.id='build-design-link';copy.prepend(a);}catch{$('build-shopping-status').textContent=say('Could not prepare the design link. Try saving the guide again.','No se pudo preparar el enlace al diseño. Intenta guardar la guía otra vez.');return;}
  const css='body{font:15px/1.6 system-ui,sans-serif;color:#172b35;max-width:920px;margin:32px auto;padding:0 24px}h2,h3{line-height:1.2}h3{margin-top:32px}h4{margin-bottom:8px}a{color:#715719}li{margin-bottom:8px}summary{font-weight:600;margin:16px 0 8px}.steps{padding-left:24px}.step{break-inside:auto;margin-bottom:28px}.shopping-row{display:flex;gap:12px;border-bottom:1px solid #ddd;padding:10px 0;break-inside:avoid}.shopping-body{flex:1}.shopping-body p{margin:3px 0}.micro{font-size:13px;color:#485b63}.shopping-quantity{font-weight:600}.downloads a{display:block;margin:12px 0}.downloads span{display:block;font-size:13px}dl>div{display:flex;justify-content:space-between;gap:16px;border-bottom:1px solid #ddd;padding:6px 0}dd{margin:0;text-align:right}.config-actions,.sr-only,.segments,.field-label,#print-status{display:none}.build-summary{padding:12px 0;border-bottom:1px solid #ddd}.print-row{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid #ddd}.print-row small{display:block}.color-dot{display:inline-block;width:10px;height:10px;border:1px solid #888;border-radius:50%;margin-right:5px;background:var(--sample)}@media print{body{margin:0;font-size:11pt}a{color:inherit;text-decoration:none}details{break-inside:auto}h3,h4,summary{break-after:avoid}}';
  download(filename,'<!doctype html><html lang="'+language()+'"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+'</title><style>'+css+'</style><body>'+copy.outerHTML+'<p>'+say('Generated from your design. Use your browser’s Print command to save as PDF.','Generado con tu diseño. Usa Imprimir en el navegador para guardarlo como PDF.')+'</p></body></html>','text/html');
 }
 function renderOverview(){
  const size=family[current.variant],summary=$('build-overview');summary.replaceChildren(node('p','build-size',size.title+' · '+size.keys_total+' '+say('keys','teclas')));
  for(const side of sides){
   const row=node('p','micro'),c=current.cases[side];row.textContent=t('side.'+side)+': '+catalog.case_styles[c.style].label+' · '+(c.cover?catalog.frame_styles[current.frames[side].style]:say('no frame','sin marco'))+' · '+catalog.battery_profiles[current.batteries[side]].label;summary.append(row);
  }
  summary.append(node('p','micro',say('Digital prototype: start with fit samples and inspect the actual parts before the complete build.','Prototipo digital: empieza con muestras de ajuste e inspecciona las piezas reales antes del armado completo.')));
  const actions=$('build-actions');actions.replaceChildren();
  for(const [id,title,fn] of [['build-csv',say('Download shopping list · CSV','Descargar lista de compra · CSV'),()=>download(size.title+'-shopping.csv',csv(),'text/csv;charset=utf-8')],['build-plan',say('Save build guide · HTML / print','Guardar guía · HTML / imprimir'),exportPlan]]){
   const button=node('button','',title);button.id=id;button.onclick=fn;actions.append(button);
  }
  const nav=$('build-nav');nav.setAttribute('aria-label',say('Build sections','Secciones de construcción'));nav.replaceChildren();
  for(const [id,en,es] of [['build-buy','Parts','Piezas'],['build-boards','PCBs','PCB'],['build-print','Print','Imprimir'],['build-solder','Solder','Soldar'],['build-program','Firmware','Firmware'],['build-close','Assemble','Armar']]){
   const b=node('button','',say(en,es));b.onclick=()=>$(id).scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});nav.append(b);
  }
 }
 function renderOrder(){
  const settings=[['Material','Material','FR4'],['Layers','Capas','2'],['Thickness','Grosor','1.6 mm'],['Copper','Cobre','1 oz'],['Finish','Acabado',say('Lead-free HASL','HASL sin plomo')],['Assembly / stencil','Ensamblaje / esténcil',say('Neither','Ninguno')]];
  const dl=node('dl','build-settings');
  for(const [en,es,value] of settings){const row=node('div');row.append(node('dt','',say(en,es)),node('dd','',value));dl.append(row);}
  const quote=link(say('Quote both boards at JLCPCB ↗','Cotizar las placas en JLCPCB ↗'),'https://cart.jlcpcb.com/quote');quote.className='go';
  $('build-order-settings').replaceChildren(dl,node('p','micro',say('Upload each ZIP as a separate job. You need one left and one right board; confirm the minimum lot in each quote. Select each color shown above: color is not encoded in the ZIP. Let the importer detect the outline and inspect the internal cutouts.','Sube cada ZIP como un trabajo distinto. Necesitas una placa izquierda y una derecha; confirma el lote mínimo de cada cotización. Elige el color indicado arriba: el ZIP no contiene el color. Deja que el importador detecte el contorno y revisa los recortes internos.')),quote);
 }
 function renderPrint(){
  const half=$('print-half').querySelector('[aria-pressed=true]').dataset.value,scope=$('print-scope').querySelector('[aria-pressed=true]').dataset.value;
  const registry=inventory[current.variant],selected=selectedParts(current,registry,half,scope),caps=keycapPlan(current,catalog,family[current.variant].added||[],half);
  const host=$('build-print-list'),rows=node('div','print-inventory');
  const supportLabels={cradle:say('Battery locator','Guía de batería'),'battery-retainer':say('Battery cage','Jaula de batería'),'mcu-riser':say('Controller support','Soporte del controlador'),'display-sled':say('Display support','Soporte de pantalla')};
  for(const side of half==='both'?sides:[half]){
   rows.append(node('h4','',t('side.'+side)));
   for(const p of selected.filter(p=>p.side===side)){
    let label=p.id.includes('-case-')?catalog.case_styles[current.cases[side].style].label+' · '+say(p.id.endsWith('-base')?'base':'plate / upper shell',p.id.endsWith('-base')?'base':'placa / carcasa superior'):p.id.includes('-frame-')?say('Frame · ','Marco · ')+catalog.frame_styles[current.frames[side].style]:supportLabels[p.id.slice(side.length+1)]||say('Spacer','Separador');
    const r=node('div','print-row'),name=node('span','',label),color=node('small','',Object.values(p.colors).filter((v,i,a)=>a.indexOf(v)===i).join(' · ').toUpperCase());
    r.dataset.printPart=p.id;name.append(color);r.append(name,node('strong','','1'));rows.append(r);
   }
  }
  if(scope==='complete'){
   rows.append(node('h4','',say('Keycaps · ','Keycaps · ')+caps.keys.length));
   for(const g of caps.groups){
    const row=node('div','print-row'),name=node('span','',g.label),color=node('small','',g.color.toUpperCase()),dot=node('i','color-dot');dot.style.setProperty('--sample',g.color);color.prepend(dot);name.append(color);row.append(name,node('strong','',String(g.count)));row.dataset.capCount=g.count;rows.append(row);
   }
  }
  const selection=say('Selected: ','Selección: ')+(half==='both'?t('seg.both'):t('side.'+half))+' · '+t(scope==='complete'?'kit.complete':'kit.shells');
  host.replaceChildren(details('build-print-contents',selection+' · '+selected.length+' '+say('parts','piezas')+(scope==='complete'?' + '+caps.keys.length+' keycaps':''),[rows]));
  const samples=node('div','downloads');
  for(const [name,file] of [[say('Base magnet sample','Muestra de imán de base'),'coupon-magnet-base'],[say('Frame magnet sample','Muestra de imán de marco'),'coupon-magnet-frame'],[say('M2 thread sample','Muestra de rosca M2'),'coupon-m2-thread']])samples.append(link(name+' · STL ↓',raw('mechanical/revI/'+file+'.stl')));
  const seen=new Set();
  for(const g of caps.groups){if(seen.has(g.file))continue;seen.add(g.file);samples.append(link(say('Keycap sample · ','Muestra de keycap · ')+g.label+' ↓',raw(catalog.variants.find(v=>v.id===g.variant).path)));}
  $('build-fit').replaceChildren(details('build-fit-details',say('Start with fit samples','Empieza con las muestras de ajuste'),[
   node('p','micro',say('Print one of each selected keycap shape, plus the magnet and M2 coupons. Check stem fit, full key travel, magnet capture and tapped screw engagement before printing everything.','Imprime una de cada forma de keycap elegida, más las muestras de imán y M2. Revisa el encaje del vástago, recorrido, captura de imanes y rosca antes de imprimir todo.')),samples,
   ...printInstructions()
  ]));
 }
 function printInstructions(){return [list([
  say('Open each 3MF as one multipart assembly. Assign the HEX colors in its manifest to your actual filaments; keep body, detail, accent and secondary volumes registered. STL is the single-color fallback.','Abre cada 3MF como un ensamblaje multiparte. Asigna los HEX del manifiesto a tus filamentos; conserva alineados cuerpo, detalle, acento y secundario. El STL es la alternativa de un color.'),
  say('Choose orientation and supports in the slicer, then inspect every layer. The kit includes no printer profile or G-code. Print the plates first and test switch retention.','Elige orientación y soportes en el slicer y revisa cada capa. El kit no incluye perfil de impresora ni G-code. Imprime primero las placas y prueba la retención de switches.'),
  say('For captive magnets, measure the actual magnet and mark attracting pairs in their final orientation. Pause at the sliced layer before the pocket closes; keep the magnet below the nozzle path. Qualify heat exposure and retention using the coupons.','Para los imanes cautivos, mide el imán real y marca las parejas que se atraen en su posición final. Pausa en la capa del slicer antes de cerrar el bolsillo; el imán debe quedar por debajo de la boquilla. Verifica exposición al calor y retención con las muestras.'),
  say('Tap the Ø1.7 mm printed pilots with an M2 tap. Test that the selected screw grips without bottoming or splitting the part.','Rosca los pilotos impresos de Ø1.7 mm con un macho M2. Comprueba que el tornillo sujete sin tocar fondo ni partir la pieza.')
 ])];}
 function renderAssembly(){
  $('build-assembly').replaceChildren(list([
   say('Disconnect USB and leave both batteries unplugged. Solder diodes, hot-swap sockets, power/reset switches and battery jacks; match the PCB markings, diode bands and each component orientation.','Desconecta USB y deja ambas baterías sin conectar. Suelda diodos, sockets hot-swap, interruptores, reset y jacks de batería; respeta marcas de PCB, bandas de diodos y orientación.'),
   say('Cut four 12-contact controller sockets from the 64-contact strip. Use 48 round pins. Hold the controller level on its printed support: 2.80 mm above the main PCB, underside at Z8.20 mm. The pin length does not set this gap.','Corta cuatro zócalos de 12 contactos de la tira de 64. Usa 48 pines redondos. Apoya el controlador nivelado en su soporte: 2.80 mm sobre la PCB principal, cara inferior en Z8.20 mm. La longitud del pin no determina la separación.'),
   say('Use the connectors supplied with nice!view: 7.00 mm PCB separation, display underside at Z12.40 mm. Put the short solder tails into the display; do not trim the mating posts.','Usa los conectores incluidos con nice!view: separación de 7.00 mm entre PCB, cara inferior de pantalla en Z12.40 mm. Las colas cortas se sueldan a la pantalla; no cortes los postes de acoplamiento.'),
   say('Trim display solder tails to ≤0.30 mm above its PCB, with joints ≤0.50 mm. Main-board socket tails may extend ≤1.00 mm below the PCB. Inspect bridges and frame clearance.','Recorta las colas de soldadura de pantalla a ≤0.30 mm sobre su PCB, con uniones ≤0.50 mm. Las colas del zócalo principal pueden sobresalir ≤1.00 mm por debajo. Revisa puentes y espacio para el marco.'),
   say('Before inserting controllers or powering up, inspect all solder joints and verify continuity and no sustained power-to-ground short with a multimeter. Keep the nice!nano BOOST jumper open.','Antes de insertar controladores o dar energía, inspecciona las soldaduras y verifica continuidad y ausencia de cortocircuito sostenido entre alimentación y tierra con multímetro. Deja abierto el jumper BOOST del nice!nano.')
  ]));
  const m6=shoppingList(current,family).find(r=>r.id==='m6').required;
  $('build-final').replaceChildren(list([
   say('After the USB checks, disconnect power. Verify the delivered cell’s polarity, dimensions and charge-current limit. Insulate exposed PCB edges locally; never compress the pouch or cover connector contacts.','Después de las pruebas por USB, desconecta la energía. Verifica polaridad, dimensiones y límite de carga de la batería recibida. Aísla los bordes expuestos de PCB sin comprimir la bolsa ni tapar contactos.'),
   say('Place the open-bottom locator, cell on the 1.4 mm case floor, and cage before lowering the PCB over them. Keep cage feet below the board and leads clear of screw posts and edges.','Coloca la guía sin fondo, la celda sobre el piso de 1.4 mm y la jaula antes de bajar la PCB. Deja los pies de la jaula bajo la placa y los cables libres de postes y bordes.'),
   say('Across both halves, install '+m6+' M2 × 6 screws with their printed spacers, and four M2 × 4 PCB screws. Fit plates, switches, keycaps, displays and the selected frames without stressing glass or the cell.','Entre ambas mitades, instala '+m6+' tornillos M2 × 6 con sus separadores impresos y cuatro M2 × 4 para PCB. Coloca placas, switches, keycaps, pantallas y marcos elegidos sin forzar vidrio ni batería.'),
   say('Fit four feet per half, clear of reset and screws. Check USB and power-switch access, full key travel, frame retention and battery service.','Coloca cuatro patas por mitad sin tapar reset ni tornillos. Comprueba acceso a USB e interruptor, recorrido de teclas, retención de marcos y acceso a la batería.'),
   say('Connect the verified cells, test power switches and measure charging within each cell’s limit. Pair the left half, check the right and test all '+family[current.variant].keys_total+' keys for press and release, chords, thumb tap/hold and all four layers. Test reconnect and wake after 15 minutes of sleep. Stop if a component heats unexpectedly.','Conecta las celdas verificadas, prueba interruptores y mide la carga dentro del límite de cada celda. Empareja la mitad izquierda, verifica la derecha y prueba pulsación y liberación de las '+family[current.variant].keys_total+' teclas, combinaciones, tap/hold de pulgares y las cuatro capas. Prueba reconexión y despertar tras 15 minutos de reposo. Detén la prueba ante calentamiento inesperado.')
  ]),node('p','micro',say('Record the build date, configuration, part references and measured results. A rendered model or downloaded file is not a physical acceptance test.','Registra fecha, configuración, referencias y mediciones. Un modelo renderizado o un archivo descargado no sustituye las pruebas físicas.')));
 }
 function renderFirmware(){
  const target=$('build-firmware');target.replaceChildren();
  for(const side of sides){const a=link(t('build.firmware.'+side)+' · UF2 ↓',raw('firmware/uf2/'+current.variant+'-'+side+'.uf2'));a.append(node('span','',say(side==='left'?'Central · USB / Bluetooth to your computer':'Peripheral · connects to the left half',side==='left'?'Central · USB / Bluetooth a tu computadora':'Periférica · se conecta a la mitad izquierda')));target.append(a);}
  const alternative=link(t('build.firmware.rightNoDisplay')+' · UF2 ↓',raw('firmware/uf2/'+current.variant+'-right-no-display.uf2'));
  $('build-firmware-alt').replaceChildren(details('build-single-display',say('Alternative: omit the right display','Alternativa: omitir la pantalla derecha'),[node('p','micro',say('The design above includes two displays. Use this file instead of the normal right UF2 only if you intentionally leave the right display out; reduce the shopping list to one display. Hiding a frame alone does not select this option.','El diseño de arriba incluye dos pantallas. Usa este archivo en lugar del UF2 derecho normal solo si decides omitir su pantalla; reduce entonces la compra a una pantalla. Quitar un marco no selecciona esta opción.')),alternative]));
  $('build-flash').replaceChildren(list([
   say('With batteries still unplugged and BOOST open, connect one genuine nice!nano v2 by a USB data cable. Double-tap reset to open its bootloader drive.','Con baterías aún desconectadas y BOOST abierto, conecta un nice!nano v2 original con cable USB de datos. Pulsa reset dos veces para abrir su unidad de arranque.'),
   say('Copy the matching '+family[current.variant].title+' left or right UF2 to that drive. Repeat for the other half. Use one firmware file per half.','Copia el UF2 '+family[current.variant].title+' izquierdo o derecho que corresponda a esa unidad. Repite en la otra mitad. Usa un archivo por mitad.'),
   say('Using the one data cable in turn, check each display and reset/bootloader recovery with its battery unplugged. Disconnect USB after each check. The left provides USB keyboard input; full-key and wireless tests follow assembly.','Usa el mismo cable de datos por turnos para verificar cada pantalla y la recuperación por reset/bootloader, con su batería desconectada. Desconecta USB tras cada prueba. La izquierda da la entrada de teclado por USB; las pruebas de teclas y radio siguen después del armado.')
  ]),details('build-keymap',say('Layers & Bluetooth controls','Capas y controles Bluetooth'),[list([
   say('Base: QWERTY. Left thumbs: Ctrl/Esc, Numbers, Shift/Space. Right: Shift/Enter, Symbols, GUI/Backspace. The first action is held, the second tapped.','Base: QWERTY. Pulgares izquierdos: Ctrl/Esc, Números, Shift/Espacio. Derechos: Shift/Enter, Símbolos, GUI/Backspace. La primera acción se mantiene; la segunda se pulsa.'),
   say('Numbers: digits, navigation and F keys. Symbols: punctuation, volume and Alt/Delete.','Números: dígitos, navegación y teclas F. Símbolos: puntuación, volumen y Alt/Delete.'),
   say('Settings: hold Symbols, then Numbers. The Q–P positions in the alphabetic block select Bluetooth profiles 1–5, clear the active profile, select BLE or USB, enter the bootloader or reset. Added number-row and outer-column keys have no action on Settings. Pair the left central with your computer.','Ajustes: mantén Símbolos y luego Números. Las posiciones Q–P del bloque alfabético seleccionan perfiles Bluetooth 1–5, borran el activo, eligen BLE o USB y entran al bootloader o reinician. Las teclas añadidas de fila numérica y columna exterior no tienen acción en Ajustes. Empareja la central izquierda con la computadora.')
  ],false)]));
 }
 function update(config){
  current=config;savedDetails=new Set([...$('build-workflow').querySelectorAll('details[open]')].map(d=>d.id));
  renderOverview();renderShopping();renderOrder();renderPrint();renderAssembly();renderFirmware();
  for(const id of savedDetails){const d=$(id);if(d)d.open=true;}
  $('build-shopping-note').textContent=say('Quantities cover the complete keyboard, even when you export one half for printing. Mark parts you already have. Confirm price, stock and pack sizes at checkout.','Las cantidades cubren el teclado completo, aunque exportes una sola mitad para imprimir. Marca lo que ya tienes. Confirma precio, stock y tamaño de paquete al comprar.');
 }
 return {update};
}
