import { useEffect, useMemo } from 'react';
import { createPortal, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { env } from '../../lib/env';
import { estado } from '../../lib/scroll';
import { azar } from '../../lib/mate';
import { presencia } from '../director';
import { RUIDO } from '../glsl/ruido';
import { LUZ_ADITIVA } from '../mezclas';
import { usarToma } from '../usarToma';

/** Lecho de brasas: trozos de carbón (celdas), grietas incandescentes que respiran y calor que ondula. */
function materialLecho() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTiempo: { value: 0 },
      uFuego: { value: 0 },
      uFondo: { value: new THREE.Color('#0e0c0b') },
      uMovimiento: { value: env.movimientoReducido ? 0 : 1 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vMundo;
      void main() {
        vec4 m = modelMatrix * vec4(position, 1.0);
        vMundo = m.xyz;
        gl_Position = projectionMatrix * viewMatrix * m;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTiempo;
      uniform float uFuego;
      uniform vec3 uFondo;
      uniform float uMovimiento;
      varying vec3 vMundo;
      ${RUIDO}
      vec3 rampa(float t) {
        // negro → rojo profundo → brasa → ámbar → casi blanco
        vec3 c = mix(vec3(0.0), vec3(0.35, 0.02, 0.0), smoothstep(0.0, 0.3, t));
        c = mix(c, vec3(1.0, 0.22, 0.03), smoothstep(0.25, 0.6, t));
        c = mix(c, vec3(1.0, 0.55, 0.15), smoothstep(0.55, 0.85, t));
        c = mix(c, vec3(1.0, 0.85, 0.6), smoothstep(0.85, 1.0, t));
        return c;
      }
      void main() {
        vec2 p = vMundo.xz;
        float t = uTiempo * uMovimiento;
        // Distorsión térmica: el aire caliente ondula lo que hay detrás (más al fondo).
        float lejos = smoothstep(1.2, -2.5, vMundo.z);
        p += vec2(snoise(vec3(p * 2.2, t * 0.7)), snoise(vec3(p * 2.2 + 9.0, t * 0.7))) * (0.012 + 0.03 * lejos);

        // Trozos de carbón irregulares: dominio deformado y dos tamaños de pieza mezclados.
        vec2 q = p + vec2(snoise(vec3(p * 0.9, 1.0)), snoise(vec3(p * 0.9, 5.0))) * 0.35;
        vec2 c1 = worley(vec3(q * 2.4, 0.5)).xy;
        vec2 c2 = worley(vec3(q * 5.1, 2.5)).xy;
        float chico = smoothstep(-0.2, 0.4, snoise(vec3(p * 0.6, 7.0)));
        float e = mix(c1.y - c1.x, (c2.y - c2.x) * 0.9, chico);
        float f1 = mix(c1.x, c2.x * 1.3, chico);
        float grieta = 1.0 - smoothstep(0.0, 0.06 + fwidth(e), e);

        // Calor escaso: solo algunas zonas viven; respiran lentamente.
        float calor = smoothstep(0.05, 0.75, fbm3(vec3(p * 0.55, t * 0.05)) + 0.12);
        calor *= 0.72 + 0.28 * sin(t * 0.8 + snoise(vec3(p * 1.4, 0.0)) * 6.0);
        float incandescencia = grieta * calor + (1.0 - smoothstep(0.0, 0.45, f1)) * calor * calor * 0.22;

        // Superficie del carbón: más clara en la cima de cada trozo, ceniza fina y reflejo rojo del calor.
        float cima = 1.0 - smoothstep(0.0, 0.6, f1);
        float ceniza = smoothstep(0.35, 0.85, snoise(vec3(q * 9.0, 3.0))) * (1.0 - calor) * cima;
        vec3 carbon = vec3(0.016, 0.012, 0.011) * (0.5 + 0.8 * cima) + vec3(0.06, 0.055, 0.05) * ceniza * 0.5;
        carbon += vec3(0.08, 0.012, 0.0) * calor * (1.0 - cima) * 0.6;
        vec3 col = carbon + rampa(incandescencia) * 1.5 * incandescencia;

        // Se pierde en la oscuridad hacia el fondo y a los lados.
        float borde = smoothstep(4.0, 1.2, abs(vMundo.x)) * smoothstep(-3.0, -0.9, vMundo.z) * smoothstep(1.6, 0.6, vMundo.z);
        col *= borde;
        col = mix(uFondo, col, uFuego * borde);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
    toneMapped: false,
  });
}

/** Brasas que suben lentamente, se mecen y se enfrían. Todo en el shader: un solo draw call. */
function brasas(cuantas: number) {
  const r = azar(23);
  const g = new THREE.BufferGeometry();
  const inicio = new Float32Array(cuantas * 3);
  const datos = new Float32Array(cuantas * 4);
  for (let i = 0; i < cuantas; i++) {
    inicio.set([(r() - 0.5) * 6.5, 0.02, -2.6 + r() * 3.4], i * 3);
    datos.set([0.1 + r() * 0.22, 5 + r() * 7, r() * 100, 0.6 + r() * 0.9], i * 4); // velocidad, vida, fase, tamaño
  }
  g.setAttribute('position', new THREE.BufferAttribute(inicio, 3));
  g.setAttribute('aDatos', new THREE.BufferAttribute(datos, 4));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTiempo: { value: 0 }, uFuego: { value: 0 }, uPx: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec4 aDatos;
      uniform float uTiempo;
      uniform float uPx;
      varying float vVida;
      void main() {
        float vida = aDatos.y;
        float edad = mod(uTiempo + aDatos.z, vida);
        vVida = edad / vida;
        vec3 p = position;
        p.y += edad * aDatos.x;
        p.x += sin(uTiempo * 0.6 + aDatos.z) * 0.18 * vVida;
        p.z += cos(uTiempo * 0.4 + aDatos.z * 1.3) * 0.1 * vVida;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aDatos.w * uPx * 2.0 / -mv.z * (1.0 - vVida * 0.5);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uFuego;
      varying float vVida;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = pow(1.0 - smoothstep(0.0, 1.0, d), 1.6);
        float brillo = smoothstep(0.0, 0.08, vVida) * (1.0 - smoothstep(0.45, 1.0, vVida));
        vec3 c = mix(vec3(1.0, 0.62, 0.25), vec3(0.6, 0.08, 0.02), vVida);
        gl_FragColor = vec4(c * a * brillo * uFuego * 1.4, 0.0);
        #include <colorspace_fragment>
      }`,
    toneMapped: false,
    ...LUZ_ADITIVA,
  });
  return { g, m };
}

/** Humo: velos que suben despacio, apenas iluminados por las brasas. */
function materialHumo() {
  return new THREE.ShaderMaterial({
    uniforms: { uTiempo: { value: 0 }, uFuego: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTiempo;
      uniform float uFuego;
      varying vec2 vUv;
      ${RUIDO}
      void main() {
        vec2 p = vUv * vec2(3.0, 2.0);
        p.y -= uTiempo * 0.05;
        float n = fbm3(vec3(p, uTiempo * 0.03));
        float hilos = 1.0 - abs(snoise(vec3(p * vec2(1.4, 0.6) + n, uTiempo * 0.04)));
        float a = smoothstep(0.82, 1.0, hilos) * smoothstep(-0.2, 0.6, n) * smoothstep(0.0, 0.35, vUv.y) * (1.0 - smoothstep(0.5, 1.0, vUv.y));
        a *= smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
        vec3 c = mix(vec3(0.5, 0.2, 0.08), vec3(0.18, 0.15, 0.14), vUv.y);
        gl_FragColor = vec4(c * a * 0.035 * uFuego, 0.0);
        #include <colorspace_fragment>
      }`,
    toneMapped: false,
    ...LUZ_ADITIVA,
  });
}

/** 5 · El fuego: brasas, calor y humo. Sin clichés de parrilla: solo la luz del carbón. */
export default function Brasas() {
  const { escena, camara, aspecto } = usarToma('fuego', 2, 34);
  const alta = env.calidad === 'alta';
  const lecho = useMemo(materialLecho, []);
  const humo = useMemo(materialHumo, []);
  const chispas = useMemo(() => brasas(alta ? 150 : 70), [alta]);
  const geoLecho = useMemo(() => new THREE.PlaneGeometry(9, 5, 1, 1).rotateX(-Math.PI / 2).translate(0, 0, -0.9), []);
  const geoHumo = useMemo(() => new THREE.PlaneGeometry(7, 3.2), []);

  useEffect(() => {
    chispas.m.uniforms.uPx.value = window.innerHeight * Math.min(window.devicePixelRatio, 2) * 0.014;
  }, [chispas]);

  useFrame(() => {
    const h = estado.historia;
    if (h < 3.9 || h > 5.1) return;
    const fuego = presencia('fuego', 0.08, 0.06);
    const t = estado.tiempo;
    for (const m of [lecho, humo, chispas.m]) {
      m.uniforms.uTiempo.value = env.movimientoReducido ? 0 : t;
      m.uniforms.uFuego.value = fuego;
    }
    const retrato = aspecto < 1;
    camara.position.set(0, retrato ? 1.25 : 1.0, retrato ? 4.4 : 3.4);
    camara.lookAt(0, retrato ? 1.05 : 0.92, -0.6);
  });

  return createPortal(
    <>
      <mesh geometry={geoLecho} material={lecho} />
      <points geometry={chispas.g} material={chispas.m} frustumCulled={false} />
      <mesh geometry={geoHumo} material={humo} position={[0, 1.4, -1.4]} />
    </>,
    escena,
  );
}
