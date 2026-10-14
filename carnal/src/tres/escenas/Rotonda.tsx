import { useEffect, useMemo, useRef } from 'react';
import { createPortal, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { cortes } from '../../data';
import { env } from '../../lib/env';
import { estado, progreso } from '../../lib/scroll';
import { indiceColeccion } from '../../lib/coleccion';
import { amortigua, mezcla } from '../../lib/mate';
import { presencia } from '../director';
import { piezaCorte } from '../geometria';
import { materialCarne, materialHueso } from '../materiales/carne';
import { materialMarmol } from '../materiales/marmol';
import { entornoMuseo } from '../entorno';
import { usarToma } from '../usarToma';
import { LUZ_ADITIVA } from '../mezclas';

const N = cortes.length;
const esTomahawk = (i: number) => cortes[i].forma === 'tomahawk';
const R = Math.max(2.4, N * 0.42); // radio de la rotonda
const PASO = (Math.PI * 2) / N;
const ALTO_COLUMNA = 1.14; // altura de la superficie donde descansa la vitrina
const VITRINA = { ancho: 0.54, alto: 0.46 };

/** Fuste estriado (20 estrías), en baja calidad liso. */
function fuste(alta: boolean) {
  const g = new THREE.CylinderGeometry(0.2, 0.22, ALTO_COLUMNA - 0.18, alta ? 120 : 40, 1, false);
  if (alta) {
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const r = Math.hypot(x, z);
      if (r < 0.05) continue;
      const a = Math.atan2(z, x);
      const f = 1 - 0.045 * Math.pow(Math.max(0, Math.cos(a * 20)), 2);
      p.setXYZ(i, x * f, p.getY(i), z * f);
    }
    g.computeVertexNormals();
  }
  g.translate(0, 0.1 + (ALTO_COLUMNA - 0.18) / 2, 0);
  return g;
}

/** Haz de luz falso (volumétrico barato): cono aditivo que se desvanece hacia abajo y en los bordes. */
function materialHaz() {
  return new THREE.ShaderMaterial({
    uniforms: { uIntensidad: { value: 0 }, uColor: { value: new THREE.Color('#ffe0c0') } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying float vFrente;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        vFrente = abs(dot(n, normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uIntensidad;
      uniform vec3 uColor;
      varying vec2 vUv;
      varying float vFrente;
      void main() {
        // nace en la oscuridad del techo y muere antes del piso
        float a = smoothstep(0.0, 0.55, vUv.y) * (1.0 - smoothstep(0.75, 1.0, vUv.y));
        a *= pow(vFrente, 3.0) * uIntensidad * 0.06;
        gl_FragColor = vec4(uColor * a, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    ...LUZ_ADITIVA,
    side: THREE.DoubleSide,
  });
}

/** Charco de luz en el piso bajo cada columna. */
function materialCharco() {
  return new THREE.ShaderMaterial({
    uniforms: { uIntensidad: { value: 0 }, uColor: { value: new THREE.Color('#ffd7b0') } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uIntensidad;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        float r = length(vUv - 0.5) * 2.0;
        float a = pow(1.0 - smoothstep(0.0, 1.0, r), 2.0) * uIntensidad * 0.16;
        gl_FragColor = vec4(uColor * a, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    ...LUZ_ADITIVA,
  });
}

/** Piso pulido que se funde con el fondo de la página hacia los bordes. */
function materialPiso() {
  const m = new THREE.MeshPhysicalMaterial({ color: '#0b0908', roughness: 0.3, metalness: 0, transparent: true, envMapIntensity: 0.5 });
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vPiso;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPiso = position.xy;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec2 vPiso;`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>\ndiffuseColor.a *= 1.0 - smoothstep(${(R + 0.8).toFixed(2)}, ${(R + 4.2).toFixed(2)}, length(vPiso));`,
      );
  };
  return m;
}

/**
 * 4 · La Colección: un museo de la carne. Columnas de mármol en círculo, cada corte protegido por
 * una vitrina de cristal. Con el scroll el círculo gira y trae cada corte al frente, bajo el único
 * spot cenital fijo: llegar al frente es "entrar en la luz".
 */
export default function Rotonda() {
  const { escena, camara, aspecto } = usarToma('coleccion', 1, 30);
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const calidad = env.calidad;
  const alta = calidad === 'alta';
  const rm = env.movimientoReducido;

  useEffect(() => {
    escena.environment = entornoMuseo(gl);
    escena.environmentIntensity = 0.5;
  }, [escena, gl]);

  const geo = useMemo(
    () => ({
      base: new RoundedBoxGeometry(0.64, 0.1, 0.64, 2, 0.015).translate(0, 0.05, 0),
      fuste: fuste(alta),
      capitel: new RoundedBoxGeometry(0.6, 0.08, 0.6, 2, 0.012).translate(0, ALTO_COLUMNA - 0.04, 0),
      vitrina: new THREE.BoxGeometry(VITRINA.ancho, VITRINA.alto, VITRINA.ancho).translate(0, ALTO_COLUMNA + VITRINA.alto / 2, 0),
      aristas: new THREE.EdgesGeometry(new THREE.BoxGeometry(VITRINA.ancho, VITRINA.alto, VITRINA.ancho)).translate(0, ALTO_COLUMNA + VITRINA.alto / 2, 0),
      soporte: new THREE.CylinderGeometry(0.05, 0.07, 0.06, 24).translate(0, ALTO_COLUMNA + 0.03, 0),
      haz: new THREE.CylinderGeometry(0.06, 0.4, 2.6, 40, 1, true).translate(0, ALTO_COLUMNA + 1.3, 0),
      charco: new THREE.PlaneGeometry(2.2, 2.2).rotateX(-Math.PI / 2).translate(0, 0.003, 0),
      piso: new THREE.CircleGeometry(R + 4.4, 96),
      anilloA: new THREE.RingGeometry(R + 0.62, R + 0.634, 192),
      anilloB: new THREE.RingGeometry(R - 0.634, R - 0.62, 192),
    }),
    [alta],
  );

  const mat = useMemo(
    () => ({
      marmoles: cortes.map((_, i) => materialMarmol(i + 1, calidad, 3.0)),
      vidrio: alta
        ? new THREE.MeshPhysicalMaterial({ color: '#f3efe8', transmission: 1, thickness: 0.03, roughness: 0.03, ior: 1.5, envMapIntensity: 1.4, specularIntensity: 1 })
        : new THREE.MeshPhysicalMaterial({ color: '#cfc6b8', transparent: true, opacity: 0.1, roughness: 0.04, envMapIntensity: 3, depthWrite: false }),
      aristas: new THREE.LineBasicMaterial({ color: '#a8875a', transparent: true, opacity: 0.4 }),
      soporte: new THREE.MeshStandardMaterial({ color: '#0a0909', roughness: 0.6 }),
      piso: materialPiso(),
      laton: new THREE.MeshStandardMaterial({ color: '#a8875a', metalness: 1, roughness: 0.32 }),
      hueso: materialHueso(),
      haces: cortes.map(() => materialHaz()),
      charcos: cortes.map(() => materialCharco()),
    }),
    [alta, calidad],
  );

  const piezas = useMemo(
    () =>
      cortes.map((c, i) => {
        const pieza = piezaCorte(c.forma, i + 11, calidad);
        const material = materialCarne(pieza, c.bms, i + 11, calidad);
        const escala = (pieza.hueso ? 0.5 : 0.48) / (pieza.radio * 2);
        return { pieza, material, escala };
      }),
    [calidad],
  );

  const anillo = useRef<THREE.Group>(null);
  const giros = useRef<(THREE.Group | null)[]>([]);
  const spot = useRef<THREE.SpotLight>(null);
  const relleno = useRef<THREE.DirectionalLight>(null);
  const ambiente = useRef<THREE.HemisphereLight>(null);
  const objetivo = useMemo(() => new THREE.Object3D(), []);
  const mirar = useMemo(() => new THREE.Vector3(), []);
  const estadoLocal = useRef({ indice: 0 });

  // Desplaza el encuadre: en escritorio el corte queda a la izquierda (ficha a la derecha);
  // en vertical, arriba (ficha abajo).
  useEffect(() => {
    const { width: w, height: h } = size;
    if (aspecto >= 1) camara.setViewOffset(w, h, w * 0.14, 0, w, h);
    else camara.setViewOffset(w, h, 0, h * 0.2, w, h);
  }, [camara, size, aspecto]);

  useFrame(() => {
    const h = estado.historia;
    if (h < 2.9 || h > 4.05) return;
    const p = progreso('coleccion');
    const meta = indiceColeccion(p, N);
    const loc = estadoLocal.current;
    loc.indice = rm ? Math.round(meta) : amortigua(loc.indice, meta, 5, estado.dt);
    const t = estado.tiempo;

    const luz = presencia('coleccion', 0.07, 0.05);
    // Con movimiento reducido el círculo no gira a la vista: se atenúa, cambia y vuelve la luz.
    const cambio = rm ? 1 - Math.min(1, Math.abs(meta - Math.round(meta)) * 4) : 1;

    if (anillo.current) anillo.current.rotation.y = -loc.indice * PASO;

    cortes.forEach((_, i) => {
      // Distancia angular de cada columna al frente (0 = al frente).
      let d = Math.abs(i - loc.indice) % N;
      d = Math.min(d, N - d);
      const alFrente = Math.max(0, 1 - d);
      const g = giros.current[i];
      if (g) g.rotation.z = (rm ? 0 : t * 0.1) + i * 1.7 + (esTomahawk(i) ? 0.5 : 0) + alFrente * p * 1.5;
      mat.haces[i].uniforms.uIntensidad.value = luz * cambio * alFrente * alFrente;
      mat.charcos[i].uniforms.uIntensidad.value = luz * cambio * mezcla(0.3, 1, alFrente);
    });

    if (spot.current) spot.current.intensity = 20 * luz * cambio;
    if (relleno.current) relleno.current.intensity = 0.35 * luz;
    if (ambiente.current) ambiente.current.intensity = 0.12 * luz;

    const retrato = aspecto < 1;
    const respira = rm ? 0 : Math.sin(t * 0.18) * 0.05;
    if (retrato) camara.position.set(respira, 1.85, R + 6.1);
    else camara.position.set(respira, 1.45, R + 4.4);
    mirar.set(0, retrato ? 1.0 : 0.86, R);
    camara.lookAt(mirar);
  });

  return createPortal(
    <>
      <group ref={anillo}>
        {cortes.map((c, i) => {
          const a = i * PASO;
          const { pieza, material, escala } = piezas[i];
          return (
            <group key={c.id} position={[Math.sin(a) * R, 0, Math.cos(a) * R]} rotation={[0, a, 0]}>
              <mesh geometry={geo.base} material={mat.marmoles[i]} receiveShadow castShadow />
              <mesh geometry={geo.fuste} material={mat.marmoles[i]} receiveShadow castShadow />
              <mesh geometry={geo.capitel} material={mat.marmoles[i]} receiveShadow castShadow />
              <mesh geometry={geo.soporte} material={mat.soporte} receiveShadow />
              <group position={[0, ALTO_COLUMNA + 0.06 + 0.07, 0]}>
                {/* inclinado hacia el visitante; gira sobre su propia normal, como en un plato giratorio */}
                <group rotation={[-Math.PI / 2 + 0.75, 0, 0]} scale={escala}>
                  <group ref={(el) => void (giros.current[i] = el)}>
                    <mesh geometry={pieza.geometria} material={material} castShadow receiveShadow />
                    {pieza.hueso && <mesh geometry={pieza.hueso} material={mat.hueso} castShadow receiveShadow />}
                  </group>
                </group>
              </group>
              <mesh geometry={geo.vitrina} material={mat.vidrio} renderOrder={2} />
              <lineSegments geometry={geo.aristas} material={mat.aristas} renderOrder={3} />
              <mesh geometry={geo.haz} material={mat.haces[i]} renderOrder={4} />
              <mesh geometry={geo.charco} material={mat.charcos[i]} renderOrder={1} />
            </group>
          );
        })}
      </group>

      <mesh geometry={geo.piso} material={mat.piso} rotation={[-Math.PI / 2, 0, 0]} receiveShadow renderOrder={0} />
      <mesh geometry={geo.anilloA} material={mat.laton} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} />
      <mesh geometry={geo.anilloB} material={mat.laton} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} />

      <primitive object={objetivo} position={[0, ALTO_COLUMNA + 0.1, R]} />
      <spotLight
        ref={spot}
        target={objetivo}
        position={[0, 4.0, R + 0.35]}
        color="#ffe2c6"
        angle={0.2}
        penumbra={0.55}
        decay={2}
        castShadow={alta}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={4}
      />
      <directionalLight ref={relleno} color="#a8907a" position={[-2, 3, R + 4]} />
      <hemisphereLight ref={ambiente} args={['#3b2c24', '#050404']} />
    </>,
    escena,
  );
}
