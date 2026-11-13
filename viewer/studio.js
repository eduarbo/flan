// The explorer's look: image-based light from a procedural room, soft-edged shadows (percentage-closer
// filtering; its softness is fixed, so no radius is set) that the parts cast on each
// other and on the floor, a neutral tone curve that keeps theme colours true, and a surface per kind of
// part. Shadows are what keep parts of one colour apart. ?render=flat opens the earlier, evenly lit look.
// Exports are untouched: plain() gives a copy its plain materials back.
// SPDX-License-Identifier: GPL-3.0-or-later
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

// printed plastic is satin, moulded switch housings and the solder mask are glossier, hardware is metal
const SURFACES={
  keycaps:{roughness:.4,clearcoat:.16,clearcoatRoughness:.45},
  base:{roughness:.62},plate:{roughness:.68},lid:{roughness:.6},supports:{roughness:.72},
  switches:{roughness:.36,clearcoat:.22,clearcoatRoughness:.3},
  pcb:{roughness:.42,clearcoat:.5,clearcoatRoughness:.2},
  mcu:{roughness:.45,clearcoat:.3,clearcoatRoughness:.25},
  display:{roughness:.22,clearcoat:.9,clearcoatRoughness:.06},
  battery:{roughness:.3,metalness:.55},connectors:{roughness:.5},
  fasteners:{roughness:.34,metalness:1},
  metal:{roughness:.34,metalness:1},
};
const METAL=/magnet|screw|washer/i;

export function createStudio({renderer,scene,objects,ground}){
  renderer.toneMapping=THREE.NeutralToneMapping;renderer.toneMappingExposure=.96;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const pmrem=new THREE.PMREMGenerator(renderer);
  scene.environment=pmrem.fromScene(new RoomEnvironment(),.04).texture;scene.environmentIntensity=.42;pmrem.dispose();
  // the room now gives the ambient light: the existing lamps become fills. The one from below stays strong:
  // the room is dark underneath, and that lamp is what keeps the PCB's mask colour true in the Bottom view.
  scene.traverse(o=>{if(o.isLight)o.intensity*=o.isHemisphereLight?.12:o.position.y<0?.85:.16;});
  // phones and tablets get smaller shadow maps
  const small=matchMedia('(max-width: 760px), (pointer: coarse)').matches;
  const key=new THREE.DirectionalLight('#ffffff',3.1);key.castShadow=true;
  key.shadow.mapSize.set(small?2048:4096,small?2048:4096);key.shadow.bias=-.0006;key.shadow.normalBias=1.4;
  Object.assign(key.shadow.camera,{left:-330,right:330,top:330,bottom:-330,near:10,far:1400});key.shadow.camera.updateProjectionMatrix();
  scene.add(key,key.target);
  // a second lamp almost straight above: its shadow darkens the gaps between keys, a little like occlusion
  const sky=new THREE.DirectionalLight('#ffffff',1.5);sky.castShadow=true;
  sky.shadow.mapSize.set(small?1024:2048,small?1024:2048);sky.shadow.bias=-.0008;sky.shadow.normalBias=2;
  Object.assign(sky.shadow.camera,{left:-330,right:330,top:330,bottom:-330,near:10,far:1400});sky.shadow.camera.updateProjectionMatrix();
  scene.add(sky,sky.target);
  // the drawn contact shadow gives way to a real one on an invisible floor
  ground.material.visible=false;
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(2400,2400).rotateX(-Math.PI/2),new THREE.ShadowMaterial({opacity:.34,depthWrite:false}));
  floor.receiveShadow=true;floor.renderOrder=-1;floor.raycast=()=>{};scene.add(floor);
  const surfaces=new Map();
  function surface(source,kind){
    const id=kind+'|'+source.color.getHexString();
    if(!surfaces.has(id)){const m=new THREE.MeshPhysicalMaterial({color:source.color,metalness:0,...SURFACES[kind]||SURFACES.base});m.userData.studio=true;m.userData.plain=source;surfaces.set(id,m);}
    return surfaces.get(id);
  }
  const wants=m=>m.isMeshStandardMaterial&&!m.userData.studio;
  // Colours are applied elsewhere with the plain materials, so every frame swaps in the matching surface.
  function dress(){
    const centre=new THREE.Vector3();let count=0;
    for(const o of objects){
      const kind=METAL.test(o.name)?'metal':o.userData.group;
      if(Array.isArray(o.material)){if(o.material.some(wants))o.material=o.material.map(m=>wants(m)?surface(m,kind):m);}
      else if(wants(o.material))o.material=surface(o.material,kind);
      o.castShadow=o.receiveShadow=true;
      if(o.visible){centre.add(o.position);count++;}
    }
    const halves=Object.values(ground.halves).filter(h=>h.visible);
    floor.visible=halves.length>0;if(floor.visible)floor.position.y=Math.min(...halves.map(h=>h.position.y));
    // the shadow frustum follows what is shown
    if(count){centre.divideScalar(count);for(const [lamp,dx,dz] of [[key,-170,230],[sky,-12,18]]){lamp.target.position.set(centre.x,0,centre.z);lamp.position.set(centre.x+dx,340,centre.z+dz);}}
  }
  // a copy made for export gets the plain materials its colours came from
  const back=m=>m.userData.plain||m;
  function plain(object){object.traverse(o=>{if(o.material)o.material=Array.isArray(o.material)?o.material.map(back):back(o.material);o.castShadow=o.receiveShadow=false;});return object;}
  return {dress,plain};
}
