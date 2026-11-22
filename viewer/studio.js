// Window light for the explorer. Render materials stay separate from the design and its exports.
// SPDX-License-Identifier: GPL-3.0-or-later
import * as THREE from 'three';
import {contactLight} from './contact-light.js';

const PRINTED={roughness:.62};
const SURFACES={
  switches:{roughness:.36,clearcoat:.22,clearcoatRoughness:.3},
  pcb:{roughness:.42,clearcoat:.5,clearcoatRoughness:.2},
  mcu:{roughness:.45,clearcoat:.3,clearcoatRoughness:.25},
  display:{roughness:.22,clearcoat:.9,clearcoatRoughness:.06},
  battery:{roughness:.3,metalness:.55},connectors:{roughness:.5},
  metal:{roughness:.34,metalness:1},
};
const METAL=/magnet|screw|washer/i;
const WINDOW_DIRECTION=new THREE.Vector3(-.84,1,.18).normalize();

const SHADOW_WIDTH=590,SHADOW_NEAR=5,SHADOW_FAR=890;
const WINDOW_SLOPE=.40;

// The floor sees a larger penumbra where the keyboard stands farther above it.
// Sample the single window's depth map in its orthographic coordinates (distances in mm).
function softFloorShadow(shader){
  shader.fragmentShader=shader.fragmentShader.replace('#include <shadowmask_pars_fragment>', `
    #if defined(USE_SHADOWMAP) && NUM_DIR_LIGHT_SHADOWS == 1
    vec2 diskPoint(int i, int count, float rotation) {
      float angle = float(i) * 2.39996323 + rotation;
      return vec2(cos(angle), sin(angle)) * sqrt((float(i) + 0.5) / float(count));
    }
    float getShadowMask() {
      vec3 p = vDirectionalShadowCoord[0].xyz / vDirectionalShadowCoord[0].w;
      if (any(lessThan(p, vec3(0.0))) || any(greaterThan(p, vec3(1.0)))) return 1.0;
      float receiver = p.z + directionalLightShadows[0].shadowBias;
      vec2 texel = 1.0 / directionalLightShadows[0].shadowMapSize;
      float depth = unpackRGBAToDepth(texture2D(directionalShadowMap[0], p.xy));
      float blocked = step(depth, receiver);
      float separation = max(0.0, receiver - depth);
      const float search = 14.0 / ${SHADOW_WIDTH.toFixed(1)};
      for (int i = 0; i < 12; ++i) {
        vec2 uv = p.xy + search * diskPoint(i, 12, 0.0);
        depth = unpackRGBAToDepth(texture2D(directionalShadowMap[0], uv));
        blocked += step(depth, receiver);
        separation += max(0.0, receiver - depth);
      }
      if (blocked == 0.0) return 1.0;
      float radius = clamp(separation / blocked * ${((SHADOW_FAR-SHADOW_NEAR)*WINDOW_SLOPE/SHADOW_WIDTH).toFixed(5)}, texel.x, search);
      // A stable rotation in light space breaks up sampling bands during camera orbits.
      float rotation = 6.2831853 * fract(dot(floor(p.xy / texel), vec2(0.75487767, 0.56984029)));
      float lit = 0.0;
      for (int i = 0; i < 40; ++i) {
        vec2 uv = p.xy + radius * diskPoint(i, 40, rotation);
        lit += texture2DCompare(directionalShadowMap[0], uv, receiver);
      }
      return lit / 40.0;
    }
    #else
    #include <shadowmask_pars_fragment>
    #endif
  `);
}

// One broad window in a neutral room. The same direction lights the surfaces and casts their shadow.
function windowEnvironment(renderer){
  const room=new THREE.Scene();
  room.background=new THREE.Color().setRGB(.24,.26,.29);
  const pane=new THREE.Mesh(new THREE.PlaneGeometry(6.2,5.6),new THREE.MeshBasicMaterial({
    color:new THREE.Color().setRGB(3.6,3.55,3.45),toneMapped:false
  }));
  pane.position.copy(WINDOW_DIRECTION).multiplyScalar(4);
  pane.lookAt(0,0,0);
  room.add(pane);
  const pmrem=new THREE.PMREMGenerator(renderer);
  const texture=pmrem.fromScene(room,.04,.1,20,{size:128}).texture;
  pmrem.dispose();pane.geometry.dispose();pane.material.dispose();
  return texture;
}

export function createStudio({renderer,scene,camera,objects,ground,lightweight}){
  renderer.toneMapping=THREE.NeutralToneMapping;
  renderer.toneMappingExposure=.70;
  const fill=new THREE.HemisphereLight('#f4f7ff','#eee3d3',lightweight?1.85:.68);
  const key=new THREE.DirectionalLight('#fffaf3',lightweight?2.35:1.82);
  key.position.copy(WINDOW_DIRECTION).multiplyScalar(440);
  scene.add(fill,key,key.target);
  // A reflector below the assembly keeps the PCB visible when inspecting its underside.
  const bounce=new THREE.DirectionalLight('#ffffff',1.28);
  bounce.position.set(.12,-1,.10);scene.add(bounce);
  if(lightweight)return null;

  scene.environment=windowEnvironment(renderer);
  scene.environmentIntensity=.73;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFShadowMap;
  key.castShadow=true;
  const small=matchMedia('(max-width: 760px), (pointer: coarse)').matches;
  const mapSize=small?1024:2048;
  key.shadow.mapSize.set(mapSize,mapSize);
  key.shadow.radius=mapSize/900;
  key.shadow.bias=-.00035;
  key.shadow.normalBias=.32;
  Object.assign(key.shadow.camera,{left:-SHADOW_WIDTH/2,right:SHADOW_WIDTH/2,top:SHADOW_WIDTH/2,bottom:-SHADOW_WIDTH/2,near:SHADOW_NEAR,far:SHADOW_FAR});
  key.shadow.camera.updateProjectionMatrix();

  ground.material.visible=false;
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(2400,2400).rotateX(-Math.PI/2),
    new THREE.ShadowMaterial({opacity:.27,depthWrite:false}));
  const contact=contactLight(renderer,scene,camera);
  floor.material.onBeforeCompile=shader=>{softFloorShadow(shader);contact?.floor(shader);};
  floor.receiveShadow=true;floor.renderOrder=-1;floor.raycast=()=>{};scene.add(floor);

  const surfaces=new Map();
  function surface(source,kind){
    const id=kind+'|'+source.color.getHexString();
    if(!surfaces.has(id)){
      const m=new THREE.MeshPhysicalMaterial({color:source.color,...SURFACES[kind]||PRINTED});
      if(contact)m.onBeforeCompile=contact.surface;
      m.userData.studio=true;m.userData.plain=source;surfaces.set(id,m);
    }
    return surfaces.get(id);
  }
  const wants=m=>m.isMeshStandardMaterial&&!m.userData.studio;
  const centre=new THREE.Vector3();
  function dress(){
    centre.set(0,0,0);let count=0;
    for(const o of objects){
      const kind=METAL.test(o.name)||o.userData.group==='fasteners'?'metal':o.userData.group;
      if(Array.isArray(o.material)){if(o.material.some(wants))o.material=o.material.map(m=>wants(m)?surface(m,kind):m);}
      else if(wants(o.material))o.material=surface(o.material,kind);
      o.castShadow=o.receiveShadow=true;
      if(o.visible){centre.add(o.position);count++;}
    }
    const halves=Object.values(ground.halves).filter(h=>h.visible);
    floor.visible=halves.length>0;if(floor.visible)floor.position.y=Math.min(...halves.map(h=>h.position.y));
    if(count){
      centre.divideScalar(count);
      key.target.position.copy(centre);
      key.position.copy(centre).addScaledVector(WINDOW_DIRECTION,440);
    }
    contact?.update();
  }
  const back=m=>m.userData.plain||m;
  function plain(object){object.traverse(o=>{if(o.material)o.material=Array.isArray(o.material)?o.material.map(back):back(o.material);o.castShadow=o.receiveShadow=false;});return object;}
  return {dress,plain};
}
