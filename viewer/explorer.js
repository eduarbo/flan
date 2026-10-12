// SPDX-License-Identifier: GPL-3.0-or-later
import * as THREE from 'three';

export const partInfo={
  lid:{name:'Display frame',short:'Frame',info:'Removable frame with three captive Ø2 × 4 mm magnets per half. Opposite poles face the base magnets; check attraction before embedding. PCB and battery remain mechanically secured.'},
  keycaps:{name:'KLP Lamé keycaps',short:'Caps',info:'Original Choc-stem meshes. Choose a shape preset; color all keys, rows, columns or individual keys.'},
  display:{name:'nice!view display',short:'Display',info:'14 × 36 × 2.9 mm nominal nice!view. Illustrative screen content; flush frame details. Uses the supplied 7.00 mm connector pair. Glass sits 0.20 mm below the frame; physical fit remains untested.'},
  base:{name:'Printed base',short:'Base',info:'Key-aligned local curves and a shared contour. Use Customize this part to choose a case. Native parts are editable in FreeCAD.'},
  plate:{name:'Switch plate',short:'Plate',info:'Holds the 36 switch positions and angles of Flan36. Nominal plate height: 7.6 mm.'},
  switches:{name:'Choc switches',short:'Switch',info:'Licensed KiSwitch Choc v1 housings, pins and stems. Generic model; seating, travel and printed keycap stems need physical fit tests.'},
  pcb:{name:'PCB',short:'PCB',info:'Custom wireless PCB. See the build guide for fabrication files and electrical validation.'},
  battery:{name:'LiPo battery',short:'Battery',info:'Adafruit 1570 and 301230 nominal profiles share the insulated case floor and captured cage. Use Customize this part to choose a profile. Verify actual pack, leads and insulation.'},
  mcu:{name:'nice!nano v2 controller',short:'MCU',info:'Nominal v2 reconstruction with separate PCB, ENIG pads, mid-mount USB-C, ICs and passives. Community outline dimensions; package detail inferred from official photos.'},
  supports:{name:'Insulating supports',short:'Mounts',info:'Cradle, display sled and controller supports. Retention is a nominal CAD proposal.'},
  connectors:{name:'Connectors & controls',short:'Ports',info:'Supplied nice!view connectors, specified Mill-Max controller sockets, battery connector, reset and power switch. Exact purchasing references are in the build guide; verify delivered dimensions and solder clearances during assembly.'},
  fasteners:{name:'Fasteners & feet',short:'Feet',info:'Per half: five internal M2 screws, three captive Ø2 × 3 mm base magnets and three Ø2 × 4 mm frame magnets. All magnets are axial. Printed threads, magnetic holding force and capture need physical tests.'}
};

export const isMagnet=o=>/^(left|right)-(magnet|frame-target)-[0-2]$/.test(o.userData.part_id||'');
export const matchesPart=(o,ref)=>Boolean(ref)&&(ref.collection==='magnets'?isMagnet(o):o.userData.group===ref.group)&&(!ref.side||o.userData.side===ref.side)&&(!ref.key||o.userData.key===ref.key)&&(ref.objectIndex===undefined||o.userData.objectIndex===ref.objectIndex);

export function createExplorer({scene,camera,canvas,objects,onSelect,onClear,requestRender}){
  const $=id=>document.getElementById(id),ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),overlay=new THREE.Group(),bounds=new Map(),highlights=new Map();
  scene.add(overlay);
  const glow=new THREE.MeshBasicMaterial({color:'#4285e8',transparent:true,opacity:.25,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  const xray=new THREE.MeshBasicMaterial({color:'#2785ff',transparent:true,opacity:.8,depthTest:false,depthWrite:false});
  const match=(o,ref)=>o.userData.installed!==false&&matchesPart(o,ref);
  const key=ref=>ref?JSON.stringify(ref):'';
  const refOf=o=>({group:o.userData.group,side:o.userData.side,key:o.userData.key,objectIndex:o.userData.objectIndex});
  let selected=null,hovered=null,moving=false,down=null,pointers=new Set(),pickTimer=0,revision=0,boxRevision=-1,highlightStamp='',activeKey='';
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
      if(selected)$('selection-visibility').textContent=objects.some(o=>o.visible&&match(o,selected))?'':selected.group==='lid'&&!objects.some(o=>match(o,selected))?'Display frames are not installed. Use the installation controls below.':'This selection is hidden. Use the visibility control beside its name.';
    }
    if(activeKey!==key(active)){activeKey=key(active);for(const row of document.querySelectorAll('.part-row'))row.classList.toggle('is-highlighted',!active?.collection&&active?.group===row.dataset.group);}
  }
  return {update,highlight:setHover,select,clear,
    invalidate(){revision++;requestRender();},layoutChanged(){requestRender();},cameraChanged(){requestRender();},
    motion(value){moving=value;clearTimeout(pickTimer);if(value)hovered=null;requestRender();},get selected(){return selected;}};
}
