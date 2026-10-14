import { useMemo } from 'react';
import { createPortal, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { env } from '../../lib/env';
import { estado, progreso } from '../../lib/scroll';
import { amortigua, suave, tramo } from '../../lib/mate';
import { PRIVADO } from '../../lib/tiempos';
import { RUIDO } from '../glsl/ruido';
import { usarToma } from '../usarToma';

const FOV = 30;
const DIST = 3;

/**
 * Media cortina de terciopelo. La tela se recoge hacia el lado (los pliegues se profundizan al
 * comprimirse) y el bajo va un poco rezagado, como una tela pesada. Sombreado de terciopelo:
 * oscuro de frente, brillo en los ángulos rasantes (el "sheen" del pelo de la tela).
 */
function materialCortina(lado: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uAbre: { value: 0 },
      uLado: { value: lado },
      uTam: { value: new THREE.Vector2(1, 1) },
      uTiempo: { value: 0 },
      uLuz: { value: 0 },
      uDesvanece: { value: 0 },
      uBase: { value: new THREE.Color('#3a0f3f') },
      uSombra: { value: new THREE.Color('#12030f') },
      uBrillo: { value: new THREE.Color('#a8739a') },
      uCalido: { value: new THREE.Color('#ffcf9a') },
      uFondo: { value: new THREE.Color('#0e0c0b') },
    },
    vertexShader: /* glsl */ `
      uniform float uAbre;
      uniform float uLado;
      uniform vec2 uTam;
      uniform float uTiempo;
      varying vec3 vNormal2;
      varying vec2 vUv;
      varying float vPliegue;
      void main() {
        vUv = uv;
        float u = uv.x;   // 0 = borde central, 1 = borde exterior
        float y = uv.y;   // 0 = bajo, 1 = arriba
        // El bajo va rezagado y se abre en curva (como una cortina de teatro recogida).
        float abre = clamp(uAbre * (1.0 - 0.18 * (1.0 - y) * (1.0 - uAbre)) - 0.06 * (1.0 - y) * sin(uAbre * 3.1416), 0.0, 1.0);
        float ocupa = mix(1.0, 0.16, abre);
        float x = 1.0 - (1.0 - u) * ocupa;
        // Pliegues: más hondos cuando la tela se comprime.
        float k = 3.1416 * 2.0 * 7.0;
        float fase = u * k + sin(y * 2.3 + u * 3.0) * 0.6;
        float amp = (0.035 + 0.11 * abre) * (0.8 + 0.2 * sin(u * 13.0));
        float onda = sin(fase);
        float z = amp * onda;
        // leve respiración de la tela
        z += 0.006 * sin(uTiempo * 0.6 + u * 9.0 + y * 2.0);
        // normal a partir de la derivada de los pliegues
        float dzdu = amp * k * cos(fase);
        float dxdu = max(ocupa, 0.05) * uTam.x;
        vec3 n = normalize(vec3(-dzdu / dxdu * uLado, 0.0, 1.0));
        vNormal2 = n;
        vPliegue = onda;
        vec3 pos = vec3(uLado * x * uTam.x, (y - 0.5) * uTam.y, z);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uLuz;
      uniform float uDesvanece;
      uniform vec3 uBase, uSombra, uBrillo, uCalido, uFondo;
      varying vec3 vNormal2;
      varying vec2 vUv;
      varying float vPliegue;
      ${RUIDO}
      void main() {
        vec3 n = normalize(vNormal2);
        vec3 l = normalize(vec3(0.0, 0.7, 0.7));
        float frente = abs(n.z);
        float difusa = max(dot(n, l), 0.0);
        // terciopelo: el brillo vive en los flancos de cada pliegue
        float sheen = pow(1.0 - frente, 1.6);
        vec3 col = mix(uSombra, uBase, 0.25 + 0.75 * difusa);
        col += uBrillo * sheen * 0.42;
        // valles más oscuros, crestas más claras
        col *= 0.55 + 0.45 * smoothstep(-1.0, 1.0, vPliegue);
        // pelo de la tela
        col *= 0.92 + 0.08 * snoise(vec3(vUv * vec2(240.0, 380.0), 1.0));
        // luz cálida tenue desde arriba, cae hacia el bajo
        float cenital = smoothstep(-0.1, 1.0, vUv.y);
        col *= mix(0.25, 1.0, cenital);
        col += uCalido * 0.05 * cenital * cenital * difusa;
        col = mix(uFondo, col, uLuz);
        gl_FragColor = vec4(col, 1.0 - uDesvanece);
        #include <colorspace_fragment>
      }`,
    toneMapped: false,
    transparent: true,
    side: THREE.DoubleSide, // la mitad izquierda está reflejada
  });
}

/** 7 · El privado: la cortina de terciopelo morado se abre lentamente con el scroll. */
export default function Cortina() {
  const { escena, camara, aspecto } = usarToma('cortina', 4, FOV);
  const alta = env.calidad === 'alta';
  const rm = env.movimientoReducido;
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1, alta ? 220 : 120, alta ? 24 : 12).translate(0.5, 0.5, 0), [alta]);
  const izq = useMemo(() => materialCortina(-1), []);
  const der = useMemo(() => materialCortina(1), []);
  const grupo = useMemo(() => new THREE.Group(), []);
  const suavizado = useMemo(() => ({ abre: 0 }), []);

  useFrame(() => {
    const h = estado.historia;
    if (h < 6.15 || h > 8.05) return;
    const p = progreso('privado');
    // Alto y ancho de la pantalla a la distancia de la cortina.
    const alto = 2 * DIST * Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * 1.08;
    const ancho = alto * aspecto;
    const meta = suave(p, PRIVADO.abre, PRIVADO.abierta);
    suavizado.abre = amortigua(suavizado.abre, meta, rm ? 30 : 4, estado.dt);
    const luz = suave(p, PRIVADO.apareceCortina - 0.08, PRIVADO.apareceCortina + 0.02);
    for (const m of [izq, der]) {
      m.uniforms.uTam.value.set(ancho / 2 + 0.02, alto);
      // Con movimiento reducido la cortina no se desliza: se desvanece.
      m.uniforms.uAbre.value = rm ? 0 : suavizado.abre;
      m.uniforms.uDesvanece.value = rm ? suavizado.abre : 0;
      m.uniforms.uTiempo.value = rm ? 0 : estado.tiempo;
      m.uniforms.uLuz.value = luz;
    }
    // Al llegar el final, la cortina sube con el resto de la escena.
    grupo.position.y = tramo(h, 7, 8) * alto;
    camara.position.set(0, 0, DIST);
    camara.lookAt(0, 0, 0);
  });

  return createPortal(
    <primitive object={grupo}>
      <mesh geometry={geo} material={izq} frustumCulled={false} />
      <mesh geometry={geo} material={der} frustumCulled={false} />
    </primitive>,
    escena,
  );
}
