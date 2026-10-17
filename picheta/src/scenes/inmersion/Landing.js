import * as THREE from 'three';
import { DRIFT, SPRITE } from '../../gl/noise.js';
import { mulberry32 } from '../intro/LogoParticles.js';
import { MapPlane } from './MapPlane.js';

// Corte de montaje con la intro: las motas que estallaron hacia la cámara
// vuelven a caer desde su alrededor y se posan exactamente sobre el doble
// círculo de spray de la foto; al tocar el suelo se funden con la pintura.
export class Landing {
  constructor(targets, count) {
    const rnd = mulberry32(61501);
    const start = new Float32Array(count * 3);
    const target = new Float32Array(count * 3);
    const seed = new Float32Array(count * 4);
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      MapPlane.toWorld({ x: targets[i * 2], y: targets[i * 2 + 1] }, 0.03, v);
      target.set([v.x, v.y, v.z], i * 3);
      // Posición inicial relativa a la cámara (x, y en pantalla · z = distancia).
      const a = rnd() * Math.PI * 2;
      const r = 0.25 + Math.pow(rnd(), 0.6) * 1.4;
      start.set([Math.cos(a) * r, Math.sin(a) * r, 0.6 + rnd() * 5], i * 3);
      seed.set([rnd(), rnd(), rnd(), rnd()], i * 4);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(target, 3));
    geo.setAttribute('aStart', new THREE.BufferAttribute(start, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);

    this.uniforms = {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uFade: { value: 1 },
      uPixelRatio: { value: 1 },
      uCamPos: { value: new THREE.Vector3() },
      uCamRight: { value: new THREE.Vector3(1, 0, 0) },
      uCamUp: { value: new THREE.Vector3(0, 0, -1) },
      uCamFwd: { value: new THREE.Vector3(0, -1, 0) },
      uColor: { value: new THREE.Color('#efece6') },
    };
    this.points = new THREE.Points(
      geo,
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          uniform float uTime, uProgress, uPixelRatio;
          uniform vec3 uCamPos, uCamRight, uCamUp, uCamFwd;
          attribute vec3 aStart;
          attribute vec4 aSeed;
          varying float vAlpha;
          varying float vSoft;
          ${DRIFT}
          void main() {
            // Desde alrededor de la cámara hasta el círculo, con retraso por mota.
            float p = clamp((uProgress - aSeed.x * 0.35) / 0.65, 0.0, 1.0);
            float e = 1.0 - pow(1.0 - p, 3.0);
            vec3 from = uCamPos + uCamRight * aStart.x * aStart.z * 0.45 + uCamUp * aStart.y * aStart.z * 0.3 + uCamFwd * aStart.z;
            vec3 mid = mix(from, position, 0.5) + vec3(0.0, 1.5 + aSeed.y * 2.0, 0.0);
            vec3 pos = mix(mix(from, mid, e), mix(mid, position, e), e);
            pos += drift(position * 3.0 + aSeed.xyz * 7.0, uTime) * sin(p * 3.14159) * 0.35;
            vec4 mv = modelViewMatrix * vec4(pos, 1.0);
            gl_Position = projectionMatrix * mv;
            float depth = max(-mv.z, 0.05);
            float size = mix(1.1, 2.6, aSeed.z) * uPixelRatio * (16.0 / depth);
            gl_PointSize = min(size, 64.0 * uPixelRatio);
            vSoft = smoothstep(4.0 * uPixelRatio, 30.0 * uPixelRatio, size);
            float alpha = mix(0.35, 0.85, aSeed.w) / max(1.0, size * size / (9.0 * uPixelRatio * uPixelRatio));
            // Al posarse se funden con la pintura de la foto.
            alpha *= 1.0 - smoothstep(0.86, 1.0, p) * 0.85;
            vAlpha = alpha * smoothstep(0.0, 0.05, uProgress) * smoothstep(0.15, 0.6, depth);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uFade;
          varying float vAlpha;
          varying float vSoft;
          ${SPRITE}
          void main() { gl_FragColor = vec4(uColor, vAlpha * uFade * sprite(gl_PointCoord, vSoft)); }
        `,
      }),
    );
    this.points.frustumCulled = false;
  }

  // Ejes de la cámara al empezar (las motas "salen" de su alrededor).
  anchor(camera) {
    const U = this.uniforms;
    camera.updateMatrixWorld();
    U.uCamPos.value.copy(camera.position);
    U.uCamRight.value.setFromMatrixColumn(camera.matrixWorld, 0);
    U.uCamUp.value.setFromMatrixColumn(camera.matrixWorld, 1);
    U.uCamFwd.value.setFromMatrixColumn(camera.matrixWorld, 2).negate();
  }
}
