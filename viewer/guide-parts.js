// SPDX-License-Identifier: GPL-3.0-or-later
// Keys correspond to the guide renders in assets/solder. Labels identify what to pick up at the bench.
const names={
 diode:['Diodo 1N4148W · banda en K','1N4148W diode · stripe at K'],socket:['Zócalo Kailh Choc','Kailh Choc socket'],switch:['Switch Choc','Choc switch'],
 reset:['Pulsador de reset','Reset button'],power:['Interruptor deslizante','Power switch'],jack:['Jack JST PH de la PCB','PCB jack · JST PH'],plug:['Enchufe JST PH de la batería','Battery plug · JST PH'],
 strip:['Tiras Mill-Max de 12 contactos','12-contact Mill-Max strips'],pins:['Pines redondos Mill-Max','Mill-Max round pins'],nano:['Controlador nice!nano v2','nice!nano v2 controller'],riser:['Soporte impreso del controlador','Printed controller support'],
 'view-socket':['Zócalo hembra · 5 contactos','Female socket · 5 contacts'],header:['Conector macho · 5 pines','Male header · 5 pins'],view:['Pantalla nice!view','nice!view display'],sled:['Soporte impreso de pantalla','Printed display support'],
 'adafruit-1570':['Batería Adafruit 1570','Adafruit 1570 battery'],'301230':['Batería 301230','301230 battery'],
 tweezers:['Pinzas de precisión','Tweezers'],meter:['Multímetro con puntas','Multimeter and probes'],loupe:['Lupa','Magnifier'],iron:['Cautín','Soldering iron'],solder:['Estaño para electrónica','Electronics solder'],cable:['Cable USB de datos','USB data cable'],
 tape:['Cinta aislante','Insulating tape'],locator:['Guía de batería sin fondo','Open-bottom battery locator'],cage:['Jaula de batería','Battery cage'],spacer:['Separador impreso','Printed spacer'],
 m6:['Tornillo M2 × 6 mm','M2 × 6 mm screw'],m4:['Tornillo M2 × 4 mm','M2 × 4 mm screw'],'m6-common':['Tornillo M2 × 6 mm','M2 × 6 mm screw'],'m4-common':['Tornillo M2 × 4 mm','M2 × 4 mm screw'],
 feet:['Patas adhesivas','Adhesive feet'],driver:['Llave hexagonal','Hex driver'],
 base:['Base','Base'],plate:['Placa de switches','Switch plate'],frame:['Marco de pantalla','Display frame'],pcb:['PCB principal','Main PCB'],keycap:['Tecla','Keycap']
};
export const solderParts={D:['diode','tweezers'],K:['socket','switch'],SW2:['reset'],SW1:['power'],J1:['jack','plug','battery','meter'],U1:['strip','pins','riser','nano'],J2:['view-socket','header','view','sled']};
export const inspectionParts=['loupe','meter','cable','battery','nano'];
export const batteryId=value=>value==='301230'?'301230':'adafruit-1570';
const keyOf=id=>'part-'+id;
export function partURL(id){
 const key=keyOf(id);
 return globalThis.flanSolderBuild?.art?.[key]||globalThis.flanSolderAssets?.[key]||new URL('./assets/solder/'+key+'.webp',document.baseURI).href;
}
export async function inlinePart(id){
 const url=partURL(id);if(url.startsWith('data:'))return url;
 const res=await fetch(url);if(!res.ok)throw Error('Guide illustration: '+id);
 const blob=await res.blob();
 return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});
}
export function stepParts(prefix,battery){return solderParts[prefix].map(id=>id==='battery'?batteryId(battery):id);}
export function guideCards(ids,lang,options={}){
 const grid=document.createElement('div');grid.className='guide-parts';
 for(const id of new Set(ids)){
  const item=document.createElement('figure'),img=document.createElement('img'),caption=document.createElement('figcaption'),name=names[id][lang==='es'?0:1];
  img.alt='';img.loading='lazy';item.dataset.guidePart=id;img.width=180;img.height=115;
  if(options.live?.(img,id)!==true){img.dataset.guideArt=id;img.src=partURL(id);}
  caption.textContent=(options.quantity?.[id]?options.quantity[id]+' × ':'')+name;
  item.append(img,caption);grid.append(item);
 }
 return grid;
}
export const cardStyles=`
.guide-parts{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(104px,100%),1fr));gap:8px;margin:8px 0 12px}
.guide-parts figure{display:grid;align-content:start;justify-items:center;min-width:0;margin:0;padding:6px;background:var(--wash,rgba(105,112,94,.08));border-radius:8px;break-inside:avoid}
.guide-parts img{display:block;width:100%;height:clamp(64px,9vw,95px);object-fit:contain}
.guide-parts figcaption{font:600 13px/1.3 var(--sans,system-ui),sans-serif;text-align:center;color:inherit}
`;
