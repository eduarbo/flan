// Short-range ambient occlusion, measured from the visible surfaces in model millimetres.
// SPDX-License-Identifier: GPL-3.0-or-later
import {Vector2} from 'three';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';

export function contactLight(renderer,scene,camera){
  if(!renderer.extensions.has('EXT_color_buffer_float'))return null;
  const pass=new GTAOPass(scene,camera,1,1,undefined,
    {radius:6,thickness:5,samples:24,scale:1},
    {radius:4,samples:16,rings:2,depthPhi:2});
  pass.output=GTAOPass.OUTPUT.Off;
  const bufferSize=new Vector2();
  const inverseSize={value:new Vector2()};
  const contactMap={value:pass.pdRenderTarget.texture};

  function update(){
    renderer.getDrawingBufferSize(bufferSize);
    const width=Math.max(1,Math.ceil(bufferSize.x/2)),height=Math.max(1,Math.ceil(bufferSize.y/2));
    if(pass.width!==width||pass.height!==height)pass.setSize(width,height);
    inverseSize.value.set(1/bufferSize.x,1/bufferSize.y);
    const target=renderer.getRenderTarget(),autoUpdate=renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate=false;
    try{pass.render(renderer);}finally{
      renderer.setRenderTarget(target);
      renderer.shadowMap.autoUpdate=autoUpdate;
    }
  }

  function bind(shader){
    shader.uniforms.flanContactMap=contactMap;
    shader.uniforms.flanInverseSize=inverseSize;
    shader.fragmentShader='uniform sampler2D flanContactMap;\nuniform vec2 flanInverseSize;\n'+shader.fragmentShader;
  }
  function surface(shader){
    bind(shader);
    shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>',`
      #include <aomap_fragment>
      float contact = texture2D(flanContactMap, gl_FragCoord.xy * flanInverseSize).r;
      reflectedLight.indirectDiffuse *= mix(1.0, contact, 0.78);
      reflectedLight.indirectSpecular *= mix(1.0, contact, 0.35);`);
  }
  function floor(shader){
    bind(shader);
    shader.fragmentShader=shader.fragmentShader.replace('#include <tonemapping_fragment>',`
      float contact = texture2D(flanContactMap, gl_FragCoord.xy * flanInverseSize).r;
      // Deepen the short-range occlusion at the supports. Open floor keeps the raking shadow.
      float occlusion = 1.0 - contact;
      float support = 0.32 * occlusion + 0.38 * smoothstep(0.04, 0.60, occlusion);
      gl_FragColor.a += (1.0 - gl_FragColor.a) * support;
      #include <tonemapping_fragment>`);
  }
  return {update,surface,floor};
}
