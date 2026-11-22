// Shared low side light for the home keyboard and explorer. Render materials stay separate from the design and its exports.
// SPDX-License-Identifier: GPL-3.0-or-later
import * as THREE from 'three';
import {contactLight} from './contact-light.js';

const PRINTED={roughness:.62,ior:1.47};
const SURFACES={
  keycaps:{...PRINTED,roughness:.55},
  switches:{roughness:.36,clearcoat:.22,clearcoatRoughness:.3},
  pcb:{roughness:.42,clearcoat:.5,clearcoatRoughness:.2},
  mcu:{roughness:.45,clearcoat:.3,clearcoatRoughness:.25},
  display:{roughness:.22,clearcoat:.9,clearcoatRoughness:.06},
  battery:{roughness:.3,metalness:.55},connectors:{roughness:.5},
  metal:{roughness:.34,metalness:1},
};
const METAL=/magnet|screw|washer/i;
// The Talavera lighting study places a low warm panel behind the left half and a wide cool fill in front.
const KEY_OFFSET=new THREE.Vector3(-230,160,-150),FILL_OFFSET=new THREE.Vector3(120,230,300);
const WINDOW_DIRECTION=KEY_OFFSET.clone().normalize(),FILL_DIRECTION=FILL_OFFSET.clone().normalize();
const KEY_COLOR='#ffe9d3',FILL_COLOR='#e5eeff';

const SPOT_ANGLE=Math.PI/3,SHADOW_NEAR=32,SHADOW_FAR=900;
const WINDOW_SLOPE=.26;

// The floor sees a larger penumbra where the keyboard stands farther above it.
// Convert perspective depths to millimetres before estimating the penumbra.
function softFloorShadow(shader){
  shader.fragmentShader=shader.fragmentShader.replace('#include <shadowmask_pars_fragment>', `
    #if defined(USE_SHADOWMAP) && NUM_SPOT_LIGHT_SHADOWS == 1
    vec2 diskPoint(int i, int count, float rotation) {
      float angle = float(i) * 2.39996323 + rotation;
      return vec2(cos(angle), sin(angle)) * sqrt((float(i) + 0.5) / float(count));
    }
    float lightDistance(float depth) {
      return ${(SHADOW_NEAR*SHADOW_FAR).toFixed(1)} / (${SHADOW_FAR.toFixed(1)} - depth * ${(SHADOW_FAR-SHADOW_NEAR).toFixed(1)});
    }
    float getShadowMask() {
      vec3 p = vSpotLightCoord[0].xyz / vSpotLightCoord[0].w;
      if (any(lessThan(p, vec3(0.0))) || any(greaterThan(p, vec3(1.0)))) return 1.0;
      float receiver = p.z + spotLightShadows[0].shadowBias;
      vec2 texel = 1.0 / spotLightShadows[0].shadowMapSize;
      float depth = unpackRGBAToDepth(texture2D(spotShadowMap[0], p.xy));
      float blocked = step(depth, receiver);
      float distanceToFloor = lightDistance(receiver);
      float separation = max(0.0, distanceToFloor - lightDistance(depth));
      float span = ${(2*Math.tan(SPOT_ANGLE)).toFixed(5)} * distanceToFloor;
      float search = 14.0 / span;
      for (int i = 0; i < 12; ++i) {
        vec2 uv = p.xy + search * diskPoint(i, 12, 0.0);
        depth = unpackRGBAToDepth(texture2D(spotShadowMap[0], uv));
        blocked += step(depth, receiver);
        separation += max(0.0, distanceToFloor - lightDistance(depth));
      }
      if (blocked == 0.0) return 1.0;
      float radius = clamp(separation / blocked * ${WINDOW_SLOPE.toFixed(2)} / span, texel.x, search);
      // A stable rotation in light space breaks up sampling bands during camera orbits.
      float rotation = 6.2831853 * fract(dot(floor(p.xy / texel), vec2(0.75487767, 0.56984029)));
      float lit = 0.0;
      for (int i = 0; i < 40; ++i) {
        vec2 uv = p.xy + radius * diskPoint(i, 40, rotation);
        lit += texture2DCompare(spotShadowMap[0], uv, receiver);
      }
      return lit / 40.0;
    }
    #else
    #include <shadowmask_pars_fragment>
    #endif
  `);
}

// The panels contribute soft reflections; only the key casts a directional shadow.
function windowEnvironment(renderer){
  const room=new THREE.Scene();
  room.background=new THREE.Color().setRGB(.17,.19,.22);
  function panel(direction,width,height,color,radiance){
    const material=new THREE.MeshBasicMaterial({color,toneMapped:false});
    material.color.multiplyScalar(radiance);
    const pane=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);
    pane.position.copy(direction).multiplyScalar(4);pane.lookAt(0,0,0);room.add(pane);
  }
  // Apparent sizes subtended by 23 × 13 cm at 32 cm, and 38 × 32 cm at 40 cm.
  panel(WINDOW_DIRECTION,2.9,1.6,KEY_COLOR,9);
  panel(FILL_DIRECTION,3.8,3.2,FILL_COLOR,1.9);
  const pmrem=new THREE.PMREMGenerator(renderer);
  const texture=pmrem.fromScene(room,.04,.1,20,{size:128}).texture;
  pmrem.dispose();
  for(const pane of room.children){pane.geometry.dispose();pane.material.dispose();}
  return texture;
}

export function windowLighting(renderer,scene,lightweight){
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.16;
  const room=new THREE.HemisphereLight('#e5ebf4','#cfc2b4',lightweight?.50:.24);
  // Two finite sources recreate the falloff across the two halves. The software renderer uses the centre directions.
  const key=lightweight?new THREE.DirectionalLight(KEY_COLOR,2.18):
    new THREE.SpotLight(KEY_COLOR,2.18*KEY_OFFSET.lengthSq(),0,SPOT_ANGLE,.2,2);
  const fill=lightweight?new THREE.DirectionalLight(FILL_COLOR,.85):
    new THREE.PointLight(FILL_COLOR,.85*FILL_OFFSET.lengthSq(),0,2);
  function aim(centre){
    key.target.position.copy(centre);
    key.position.copy(centre).add(KEY_OFFSET);
    fill.position.copy(lightweight?FILL_DIRECTION:centre);
    if(!lightweight)fill.position.add(FILL_OFFSET);
  }
  aim(new THREE.Vector3());
  scene.add(room,key,key.target,fill);
  // Keep the PCB readable when the user turns the keyboard over.
  const bounce=new THREE.DirectionalLight('#ffffff',.86);
  bounce.position.set(.12,-1,.10);scene.add(bounce);
  if(lightweight)return null;

  scene.environment=windowEnvironment(renderer);
  scene.environmentIntensity=.28;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFShadowMap;
  key.castShadow=true;
  const small=matchMedia('(max-width: 760px), (pointer: coarse)').matches;
  const mapSize=small?1024:2048;
  key.shadow.mapSize.set(mapSize,mapSize);
  key.shadow.radius=mapSize/900;
  key.shadow.bias=-.00012;
  key.shadow.normalBias=.32;
  Object.assign(key.shadow.camera,{near:SHADOW_NEAR,far:SHADOW_FAR});
  key.shadow.camera.updateProjectionMatrix();

  return aim;
}

export function studioMaterial(color,kind,contact){
  const m=new THREE.MeshPhysicalMaterial({color,...SURFACES[kind]||PRINTED});
  if(contact)m.onBeforeCompile=contact.surface;
  return m;
}

export function studioFloor(scene,contact){
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(2400,2400).rotateX(-Math.PI/2),
    new THREE.ShadowMaterial({opacity:.27,depthWrite:false}));
  floor.material.onBeforeCompile=shader=>{softFloorShadow(shader);contact?.floor(shader);};
  floor.receiveShadow=true;floor.renderOrder=-1;floor.raycast=()=>{};scene.add(floor);
  return floor;
}

export function createStudio({renderer,scene,camera,objects,ground,lightweight}){
  const aim=windowLighting(renderer,scene,lightweight);
  if(!aim)return null;
  ground.material.visible=false;
  const contact=contactLight(renderer,scene,camera);
  const floor=studioFloor(scene,contact);

  const surfaces=new Map();
  function surface(source,kind){
    const id=kind+'|'+source.color.getHexString();
    if(!surfaces.has(id)){
      const m=studioMaterial(source.color,kind,contact);
      m.userData.studio=true;m.userData.plain=source;surfaces.set(id,m);
    }
    return surfaces.get(id);
  }
  const wants=m=>m.isMeshStandardMaterial&&!m.userData.studio;
  const centre=new THREE.Vector3(),bounds=new THREE.Box3();
  function dress(){
    bounds.makeEmpty();
    for(const o of objects){
      const kind=METAL.test(o.name)||o.userData.group==='fasteners'?'metal':o.userData.group;
      if(Array.isArray(o.material)){if(o.material.some(wants))o.material=o.material.map(m=>wants(m)?surface(m,kind):m);}
      else if(wants(o.material))o.material=surface(o.material,kind);
      o.castShadow=o.receiveShadow=true;
      if(o.visible)bounds.expandByObject(o);
    }
    const halves=Object.values(ground.halves).filter(h=>h.visible);
    floor.visible=halves.length>0;if(floor.visible)floor.position.y=Math.min(...halves.map(h=>h.position.y));
    if(!bounds.isEmpty())aim(bounds.getCenter(centre));
    contact?.update();
  }
  const back=m=>m.userData.plain||m;
  function plain(object){object.traverse(o=>{if(o.material)o.material=Array.isArray(o.material)?o.material.map(back):back(o.material);o.castShadow=o.receiveShadow=false;});return object;}
  return {dress,plain};
}
