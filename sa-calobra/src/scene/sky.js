// Cielo al tramonto: lo shader Sky di Three.js viene disegnato UNA volta in una cubemap
// (il sole è fermo), che fa da sfondo e da colore per nebbia e riflessi del mare.
// Il disco del sole è un billboard HDR a parte, così il bloom lo fa brillare.
import {
  Scene, CubeCamera, WebGLCubeRenderTarget, HalfFloatType, LinearMipmapLinearFilter, LinearFilter,
  Mesh, PlaneGeometry, ShaderMaterial, AdditiveBlending, Color,
} from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { CONFIG } from '../config.js';

export function createSky(renderer, shared, size = 512) {
  const c = CONFIG.sky;
  const sky = new Sky();
  sky.scale.setScalar(1000);
  const u = sky.material.uniforms;
  u.turbidity.value = c.turbidity;
  u.rayleigh.value = c.rayleigh;
  u.mieCoefficient.value = c.mieCoefficient;
  u.mieDirectionalG.value = c.mieDirectionalG;
  u.sunPosition.value.copy(shared.uSunDir.value);
  if (u.cloudCoverage) u.cloudCoverage.value = c.clouds;
  if (u.showSunDisc) u.showSunDisc.value = 0;
  // ritocco "fotografico": zenit più blu, orizzonte più dorato (il modello fisico da solo è lattiginoso)
  const zen = new Color(c.zenithTint), hor = new Color(c.horizonTint);
  sky.material.fragmentShader = sky.material.fragmentShader.replace(
    'gl_FragColor = vec4( texColor, 1.0 );',
    `texColor *= mix(vec3(${hor.r.toFixed(3)}, ${hor.g.toFixed(3)}, ${hor.b.toFixed(3)}), vec3(1.0), smoothstep(-0.02, 0.22, direction.y));
     texColor *= mix(vec3(1.0), vec3(${zen.r.toFixed(3)}, ${zen.g.toFixed(3)}, ${zen.b.toFixed(3)}), smoothstep(0.05, 0.7, direction.y));
     gl_FragColor = vec4( texColor, 1.0 );`,
  );

  const rt = new WebGLCubeRenderTarget(size, {
    type: HalfFloatType,
    generateMipmaps: true,
    minFilter: LinearMipmapLinearFilter,
    magFilter: LinearFilter,
  });
  const skyScene = new Scene();
  skyScene.add(sky);
  const cam = new CubeCamera(1, 5000, rt);
  const bake = () => cam.update(renderer, skyScene);
  bake();
  shared.uSkyCube.value = rt.texture;
  return { texture: rt.texture, bake, sky };
}

/** disco del sole + alone, sempre all'"infinito" nella direzione del sole */
export function createSun(shared) {
  const mat = new ShaderMaterial({
    uniforms: { ...shared, uColor: { value: new Color(CONFIG.sun.color) } },
    vertexShader: /* glsl */ `
      uniform vec3 uSunDir;
      varying vec2 vP;
      void main() {
        vP = position.xy;
        vec4 c = viewMatrix * vec4(cameraPosition + uSunDir * 20000.0, 1.0);
        c.xy += position.xy * 1400.0;   // il quad è largo 2 × 1400 m a 20 km
        gl_Position = projectionMatrix * c;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying vec2 vP;
      void main() {
        float r = length(vP);                          // 1 = bordo del quad
        float disc = smoothstep(0.13, 0.115, r);       // disco ~0,45°
        float halo = exp(-r * 9.0) * 0.35 + exp(-r * 3.0) * 0.05;
        vec3 col = uColor * (disc * 5.0 + halo * 1.6) + vec3(1.0, 0.95, 0.85) * disc * 2.5;
        gl_FragColor = vec4(col, 1.0);
      }`,
    blending: AdditiveBlending,
    depthWrite: false,
    transparent: true,
  });
  const mesh = new Mesh(new PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return mesh;
}
