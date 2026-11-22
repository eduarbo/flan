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
    shader.uniforms.flanFloorDepth={value:pass.normalRenderTarget.depthTexture};
    shader.vertexShader='varying vec2 flanFloorXZ;\n'+shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      '#include <worldpos_vertex>\nflanFloorXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader='uniform sampler2D flanFloorDepth;\nvarying vec2 flanFloorXZ;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <tonemapping_fragment>',`
      // Average the half-resolution AO over a small physical area of the receiving plane.
      // Window depth is affine on a plane. Reject taps that hit keyboard geometry instead.
      vec2 uv = gl_FragCoord.xy * flanInverseSize;
      vec2 pixelMM = vec2(length(dFdx(flanFloorXZ)), length(dFdy(flanFloorXZ)));
      vec2 size = vec2(textureSize(flanFloorDepth, 0));
      vec2 stride = clamp(floor(1.25 * flanInverseSize * size / max(pixelMM, vec2(0.001)) + 0.5), vec2(2.0), vec2(7.0));
      vec2 centre = uv * size - 0.5;
      vec2 grid = floor(centre / stride + 0.5) * stride;
      vec2 depthSlope = vec2(dFdx(gl_FragCoord.z), dFdy(gl_FragCoord.z));
      float total = 0.0, sum = 0.0;
      // Most of the transparent floor has neither a cast shadow nor nearby occlusion.
      vec2 probe = 2.0 * stride / size;
      float openFloor = min(texture2D(flanContactMap, uv).r,
          min(min(texture2D(flanContactMap, uv + vec2(probe.x, 0.0)).r,
                  texture2D(flanContactMap, uv - vec2(probe.x, 0.0)).r),
              min(texture2D(flanContactMap, uv + vec2(0.0, probe.y)).r,
                  texture2D(flanContactMap, uv - vec2(0.0, probe.y)).r)));
      if (gl_FragColor.a > 0.0 || openFloor < 0.9999) {
        for (int y = -2; y <= 2; ++y) {
          for (int x = -2; x <= 2; ++x) {
            vec2 pixel = grid + vec2(x, y) * stride;
            vec2 tap = (pixel + 0.5) / size;
            // This compact kernel reaches zero smoothly as a tap leaves the window.
            vec2 offset = (pixel - centre) / (2.5 * stride);
            vec2 kernel = max(1.0 - offset * offset, vec2(0.0));
            float planeZ = gl_FragCoord.z + dot((tap - uv) / flanInverseSize, depthSlope);
            float z = texture2D(flanFloorDepth, tap).r;
            float weight = kernel.x * kernel.x * kernel.y * kernel.y * step(abs(z - planeZ), 0.000004);
            total += weight;
            sum += weight * texture2D(flanContactMap, tap).r;
          }
        }
      }
      float contact = total > 0.0 ? sum / total : 1.0;
      // Deepen the short-range occlusion at the supports. Open floor keeps the raking shadow.
      float occlusion = 1.0 - contact;
      float support = 0.32 * occlusion + 0.38 * smoothstep(0.04, 0.60, occlusion);
      gl_FragColor.a += (1.0 - gl_FragColor.a) * support;
      #include <tonemapping_fragment>`);
  }
  return {update,surface,floor};
}
