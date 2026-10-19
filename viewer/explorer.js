// SPDX-License-Identifier: GPL-3.0-or-later
import * as THREE from 'three';
import {t,language} from './i18n.js';

// Each group's name, short name and note, in the page's language.
const parts={en:{
  lid:{name:'Display frame',short:'Frame',info:'Removable frame with three captive Ø2 × 4 mm magnets per half. Opposite poles face the base magnets; check attraction before embedding. PCB and battery remain mechanically secured.'},
  keycaps:{name:'KLP Lamé keycaps',short:'Caps',info:'Original Choc-stem meshes. Choose a shape preset; color all keys, rows, columns or individual keys.'},
  display:{name:'nice!view display',short:'Display',info:'14 × 36 × 2.9 mm nominal nice!view. Illustrative screen content; flush frame details. Uses the supplied 7.00 mm connector pair. Glass sits 0.20 mm below the frame; physical fit remains untested.'},
  base:{name:'Printed base',short:'Base',info:'Key-aligned local curves and a shared contour. Use Customize this part to choose a case. Native parts are editable in FreeCAD.'},
  plate:{name:'Switch plate',short:'Plate',info:'Holds the 36 switch positions and angles of Flan36. Nominal plate height: 7.6 mm.'},
  switches:{name:'Choc switches',short:'Switch',info:'Licensed KiSwitch Choc v1 housings, pins and stems. Generic model; seating, travel and printed keycap stems need physical fit tests.'},
  pcb:{name:'PCB',short:'PCB',info:'Custom wireless PCB with the Flan signature on the back. Choose a back-silkscreen edition in Design → PCB; each edition has its own Gerber package.'},
  battery:{name:'LiPo battery',short:'Battery',info:'Adafruit 1570 and 301230 nominal profiles share the insulated case floor and captured cage. Use Customize this part to choose a profile. Verify actual pack, leads and insulation.'},
  mcu:{name:'nice!nano v2 controller',short:'MCU',info:'Nominal v2 reconstruction with separate PCB, ENIG pads, mid-mount USB-C, ICs and passives. Community outline dimensions; package detail inferred from official photos.'},
  supports:{name:'Insulating supports',short:'Mounts',info:'Cradle, display sled and controller supports. Retention is a nominal CAD proposal.'},
  connectors:{name:'Connectors & controls',short:'Ports',info:'Supplied nice!view connectors, specified Mill-Max controller sockets, battery connector, reset and power switch. Exact purchasing references are in the build guide; verify delivered dimensions and solder clearances during assembly.'},
  fasteners:{name:'Fasteners & feet',short:'Feet',info:'Per half: five internal M2 screws, three captive Ø2 × 3 mm base magnets and three Ø2 × 4 mm frame magnets. All magnets are axial. Printed threads, magnetic holding force and capture need physical tests.'}
},es:{
  lid:{name:'Marco de pantalla',short:'Marco',info:'Marco removible con tres imanes cautivos de Ø2 × 4 mm por mitad. Los polos opuestos miran hacia los imanes de la base; revisa que se atraigan antes de fijarlos. La PCB y la batería siguen sujetas mecánicamente.'},
  keycaps:{name:'Keycaps KLP Lamé',short:'Keycaps',info:'Mallas originales con vástago Choc. Elige una forma; pinta todas las teclas, filas, columnas o teclas sueltas.'},
  display:{name:'Pantalla nice!view',short:'Pantalla',info:'nice!view nominal de 14 × 36 × 2.9 mm. Contenido de pantalla ilustrativo; detalles del marco al ras. Usa el par de conectores de 7.00 mm incluido. El vidrio queda 0.20 mm bajo el marco; el ajuste físico aún no se prueba.'},
  base:{name:'Base impresa',short:'Base',info:'Curvas locales alineadas a las teclas y un contorno común. Usa Personalizar esta pieza para elegir una caja. Las piezas nativas se editan en FreeCAD.'},
  plate:{name:'Placa de switches',short:'Placa',info:'Sostiene las 36 posiciones y ángulos de switch de Flan36. Altura nominal de la placa: 7.6 mm.'},
  switches:{name:'Switches Choc',short:'Switch',info:'Carcasas, pines y vástagos Choc v1 de KiSwitch, con licencia. Modelo genérico; el asiento, el recorrido y los vástagos impresos de las keycaps necesitan pruebas físicas de ajuste.'},
  pcb:{name:'PCB',short:'PCB',info:'PCB inalámbrica a la medida, con la firma de Flan atrás. Elige una edición de serigrafía trasera en Diseño → PCB; cada edición tiene su propio paquete Gerber.'},
  battery:{name:'Batería LiPo',short:'Batería',info:'Los perfiles nominales Adafruit 1570 y 301230 comparten el piso aislado de la caja y la jaula de sujeción. Usa Personalizar esta pieza para elegir un perfil. Verifica la batería real, los cables y el aislamiento.'},
  mcu:{name:'Controlador nice!nano v2',short:'MCU',info:'Reconstrucción nominal de la v2 con PCB aparte, pads ENIG, USB-C de montaje medio, circuitos integrados y pasivos. Medidas del contorno de la comunidad; detalle de los encapsulados deducido de fotos oficiales.'},
  supports:{name:'Soportes aislantes',short:'Soportes',info:'Cuna, trineo de la pantalla y soportes del controlador. La sujeción es una propuesta nominal de CAD.'},
  connectors:{name:'Conectores y controles',short:'Puertos',info:'Conectores incluidos del nice!view, zócalos Mill-Max especificados para el controlador, conector de batería, botón de reset e interruptor de encendido. Las referencias exactas de compra están en la guía de armado; verifica las medidas recibidas y los espacios para soldar durante el armado.'},
  fasteners:{name:'Sujetadores y patas',short:'Patas',info:'Por mitad: cinco tornillos M2 internos, tres imanes cautivos de base de Ø2 × 3 mm y tres imanes de marco de Ø2 × 4 mm. Todos los imanes son axiales. Las roscas impresas, la fuerza magnética y la captura necesitan pruebas físicas.'}
}};
export const partInfo=id=>parts[language()][id]??parts.en[id];

export const isMagnet=o=>/^(left|right)-(magnet|frame-target)-[0-2]$/.test(o.userData.part_id||'');
export const matchesPart=(o,ref)=>Boolean(ref)&&(ref.collection==='magnets'?isMagnet(o):o.userData.group===ref.group)&&(!ref.side||o.userData.side===ref.side)&&(!ref.key||o.userData.key===ref.key)&&(ref.objectIndex===undefined||o.userData.objectIndex===ref.objectIndex);

export function createExplorer({scene,camera,canvas,objects,onSelect,onClear,requestRender}){
  const $=id=>document.getElementById(id),ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),overlay=new THREE.Group(),bounds=new Map(),highlights=new Map();
  scene.add(overlay);
  const glow=new THREE.MeshBasicMaterial({color:'#4285e8',transparent:true,opacity:.25,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  const xray=new THREE.MeshBasicMaterial({color:'#2785ff',transparent:true,opacity:.8,depthTest:false,depthWrite:false});
  // Screen-sized locator dots remain legible when the 2 mm magnets are tiny.
  // These are annotations; the actual magnet geometry stays unchanged.
  const dotCanvas=document.createElement('canvas');dotCanvas.width=dotCanvas.height=64;
  const dot=dotCanvas.getContext('2d');dot.fillStyle='#fff';dot.beginPath();dot.arc(32,32,30,0,Math.PI*2);dot.fill();dot.fillStyle='#3568ed';dot.beginPath();dot.arc(32,32,21,0,Math.PI*2);dot.fill();
  const locatorTexture=new THREE.CanvasTexture(dotCanvas);locatorTexture.colorSpace=THREE.SRGBColorSpace;
  const locatorGeometry=new THREE.BufferGeometry(),locator=new THREE.Points(locatorGeometry,new THREE.PointsMaterial({map:locatorTexture,toneMapped:false,size:12,sizeAttenuation:false,transparent:true,depthTest:false,depthWrite:false}));
  locatorGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(objects.filter(isMagnet).length*3),3));
  locator.renderOrder=1001;locator.frustumCulled=false;locator.visible=false;overlay.add(locator);
  const match=(o,ref)=>o.userData.installed!==false&&matchesPart(o,ref);
  const key=ref=>ref?JSON.stringify(ref):'';
  const refOf=o=>({group:o.userData.group,side:o.userData.side,key:o.userData.key,objectIndex:o.userData.objectIndex});
  let selected=null,hovered=null,moving=false,down=null,pointers=new Set(),pickTimer=0,revision=0,boxRevision=-1,highlightStamp='',visibilityStamp='',activeKey='';
  function refreshBounds(){
    if(boxRevision===revision)return;
    scene.updateMatrixWorld(true);
    for(const o of objects){if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();bounds.set(o,o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}
    boxRevision=revision;
  }
  function hit(event){
    const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2);camera.updateMatrixWorld();ray.setFromCamera(pointer,camera);
    refreshBounds();const candidates=[],point=new THREE.Vector3();
    for(const o of objects)if(o.visible&&ray.ray.intersectBox(bounds.get(o),point))candidates.push({object:o,near:ray.ray.origin.distanceTo(point)});
    candidates.sort((a,b)=>a.near-b.near);let closest=null;
    for(const {object,near} of candidates){if(closest&&near>closest.distance+.001)break;const found=ray.intersectObject(object,false)[0];if(found&&(!closest||found.distance<closest.distance))closest=found;}
    return closest;
  }
  function setHover(ref){if(key(ref)===key(hovered))return;hovered=ref;requestRender();}
  function select(ref){selected=ref;hovered=null;onSelect(ref);requestRender();}
  function clear(){selected=null;hovered=null;onClear();requestRender();}
  canvas.addEventListener('pointerdown',e=>{pointers.add(e.pointerId);clearTimeout(pickTimer);hovered=null;down=pointers.size===1?{id:e.pointerId,x:e.clientX,y:e.clientY,moved:false}:null;});
  canvas.addEventListener('pointermove',e=>{
    if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>6)down.moved=true;
    clearTimeout(pickTimer);if(pointers.size||e.pointerType==='touch'||moving)return;
    const event={clientX:e.clientX,clientY:e.clientY};pickTimer=setTimeout(()=>{const found=hit(event);setHover(found?refOf(found.object):null);canvas.style.cursor=found?'pointer':'';},55);
  });
  canvas.addEventListener('pointerup',e=>{const tap=down&&down.id===e.pointerId&&!down.moved&&pointers.size===1;pointers.delete(e.pointerId);down=null;if(tap){const found=hit(e);if(found)select(refOf(found.object));else clear();}});
  canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);down=null;clearTimeout(pickTimer);});
  canvas.addEventListener('pointerleave',()=>{clearTimeout(pickTimer);setHover(null);canvas.style.cursor='';});
  function update(){
    const active=hovered||selected,highlighted=hovered||(['lid','keycaps'].includes(selected?.group)?null:selected),stamp=key(active)+':'+key(highlighted)+':'+revision;
    if(stamp!==highlightStamp){
      highlightStamp=stamp;for(const mesh of highlights.values())mesh.visible=false;
      for(const o of objects)if((o.visible||hovered)&&match(o,highlighted)){
        let mesh=highlights.get(o);if(!mesh){mesh=new THREE.Mesh(o.geometry,glow);highlights.set(o,mesh);overlay.add(mesh);}
        const through=Boolean(hovered)||highlighted?.collection==='magnets';mesh.material=through?xray:glow;mesh.renderOrder=through?1000:0;mesh.geometry=o.geometry;mesh.position.copy(o.position);mesh.rotation.copy(o.rotation);mesh.scale.copy(o.scale);mesh.visible=true;
      }
      const positions=[];
      if(highlighted?.collection==='magnets'){
        scene.updateMatrixWorld(true);
        for(const o of objects)if(o.visible&&match(o,highlighted)){
          if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();
          const center=o.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(o.matrixWorld);positions.push(center.x,center.y,center.z);
        }
      }
      locator.visible=positions.length>0;
      locatorGeometry.attributes.position.array.set(positions);locatorGeometry.attributes.position.needsUpdate=true;locatorGeometry.setDrawRange(0,positions.length/3);
    }
    // Hovering a row and selecting it share a highlight stamp, so the note tracks selection and visibility on its own.
    const shown=key(selected)+':'+revision;
    if(shown!==visibilityStamp){
      visibilityStamp=shown;
      if(selected)$('selection-visibility').textContent=objects.some(o=>o.visible&&match(o,selected))?'':t(selected.group==='lid'&&!objects.some(o=>match(o,selected))?'vis.frames':'vis.hidden');
    }
    if(activeKey!==key(active)){activeKey=key(active);for(const row of document.querySelectorAll('.part-row'))row.classList.toggle('is-highlighted',!active?.collection&&active?.group===row.dataset.group);}
  }
  return {update,highlight:setHover,select,clear,
    invalidate(){revision++;requestRender();},layoutChanged(){requestRender();},cameraChanged(){requestRender();},
    tint(color){glow.color.set(color);xray.color.set(color);requestRender();},
    motion(value){moving=value;clearTimeout(pickTimer);if(value)hovered=null;requestRender();},get selected(){return selected;}};
}
