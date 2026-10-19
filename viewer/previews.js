// SPDX-License-Identifier: GPL-3.0-or-later
import * as THREE from 'three';

// Reuse the main renderer during startup. No extra WebGL contexts or animation loop.
export function createPreviewRenderer(renderer, geometryFor) {
  const scene=new THREE.Scene();   // transparent: thumbnails sit on the page's own colour
  scene.add(new THREE.HemisphereLight('#ffffff','#8d9c88',2));
  for(const [p,intensity] of [[[-60,150,80],3],[[100,80,-60],.8]]){
    const light=new THREE.DirectionalLight('#fff',intensity);light.position.fromArray(p);scene.add(light);
  }
  const mat=new THREE.MeshStandardMaterial({color:'#7c927f',roughness:.86});
  const camera=new THREE.OrthographicCamera();
  const pixelRatio=renderer.getPixelRatio();renderer.setPixelRatio(1);renderer.setSize(220,220,false);
  function image(entries,direction=[.2,2,1],options={}){
    const width=options.width||220,height=options.height||220,aspect=width/height;
    renderer.setSize(width,height,false);
    const group=new THREE.Group();
    for(const e of entries){const mesh=new THREE.Mesh(e.geometry||geometryFor(e.path),e.material||mat);mesh.rotation.y=THREE.MathUtils.degToRad(e.rotation||0);if(e.center){const box=mesh.geometry.boundingBox;mesh.position.copy(box.getCenter(new THREE.Vector3()).negate().applyEuler(mesh.rotation)).add(new THREE.Vector3(...e.center));}if(e.position)mesh.position.fromArray(e.position);group.add(mesh);}
    scene.add(group);const box=new THREE.Box3().setFromObject(group),center=box.getCenter(new THREE.Vector3());
    camera.position.copy(center).add(new THREE.Vector3(...direction).normalize().multiplyScalar(300));camera.up.fromArray(options.up||[0,1,0]);camera.lookAt(center);camera.updateMatrixWorld();
    const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0),up=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1);
    let size=0;for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const v=new THREE.Vector3(x,y,z).sub(center);size=Math.max(size,Math.abs(v.dot(right))/aspect,Math.abs(v.dot(up)));}
    size*=1.08;camera.left=-size*aspect;camera.right=size*aspect;camera.top=size;camera.bottom=-size;camera.near=.1;camera.far=1000;camera.updateProjectionMatrix();
    renderer.render(scene,camera);const src=renderer.domElement.toDataURL('image/png');scene.remove(group);return src;
  }
  return {image,finish(){renderer.setPixelRatio(pixelRatio);mat.dispose();}};
}
