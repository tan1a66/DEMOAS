import { useEffect, useMemo, useRef } from 'react';
import { createPortal, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { sitio } from '../../data';
import { env } from '../../lib/env';
import { estado, progreso } from '../../lib/scroll';
import { amortigua, mezcla, suave } from '../../lib/mate';
import { presencia } from '../director';
import { RUIDO } from '../glsl/ruido';
import { usarToma } from '../usarToma';

const PUERTA = { ancho: 1.6, alto: 2.35 }; // rectángulo + medio punto
const GROSOR = 0.6;

function muro() {
  const forma = new THREE.Shape();
  forma.moveTo(-8, 0);
  forma.lineTo(8, 0);
  forma.lineTo(8, 5.4);
  forma.lineTo(-8, 5.4);
  forma.closePath();
  const r = PUERTA.ancho / 2;
  const puerta = new THREE.Path();
  puerta.moveTo(-r, 0);
  puerta.lineTo(-r, PUERTA.alto);
  puerta.absarc(0, PUERTA.alto, r, Math.PI, 0, true);
  puerta.lineTo(r, 0);
  puerta.closePath();
  forma.holes.push(puerta);
  for (const x of [-3.3, 3.3]) {
    const v = new THREE.Path();
    v.moveTo(x - 0.55, 1.0);
    v.lineTo(x + 0.55, 1.0);
    v.lineTo(x + 0.55, 3.0);
    v.lineTo(x - 0.55, 3.0);
    v.closePath();
    forma.holes.push(v);
  }
  const g = new THREE.ExtrudeGeometry(forma, { depth: GROSOR, bevelEnabled: false, curveSegments: 40 });
  g.translate(0, 0, -GROSOR);
  return g;
}

/** Piedra caliza con estuco de cal: manchas de humedad, poros y zonas donde el estuco cayó y asoma la mampostería. */
function materialMuro() {
  const m = new THREE.MeshStandardMaterial({ color: '#b5a389', roughness: 0.95, metalness: 0 });
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPiedra;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPiedra = position;');
    s.fragmentShader = s.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
varying vec3 vPiedra;
${RUIDO}
float gAlto = 0.0;`,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
{
  vec3 p = vPiedra;
  // Zonas sin estuco (mampostería a la vista).
  float zona = fbm3(vec3(p.xy * 0.3, 1.7)) + snoise(p * 2.8) * 0.1 + smoothstep(1.4, 0.0, p.y) * 0.18;
  float sinEstuco = smoothstep(0.24, 0.3, zona);
  // Piedras irregulares y su junta.
  vec3 pw = p + vec3(snoise(p * 0.8), snoise(p * 0.8 + 5.0), 0.0) * 0.25;
  vec2 c = worley(vec3(pw.x * 1.7, pw.y * 2.4, pw.z * 1.7 + 3.0)).xy;
  vec2 c2 = worley(vec3(pw.x * 3.6, pw.y * 4.6, pw.z * 3.6 + 9.0)).xy;
  float chica = smoothstep(0.1, 0.5, snoise(p * 0.9 + 2.0));
  float borde = mix(c.y - c.x, c2.y - c2.x, chica);
  float junta = 1.0 - smoothstep(0.02, 0.07, borde);
  float tonoPiedra = snoise(vec3(c.x * 3.0, c.y * 2.0, 1.0)) * 0.5 + 0.5;
  vec3 mortero = vec3(0.55, 0.5, 0.42);
  vec3 piedra = mix(vec3(0.4, 0.34, 0.26), vec3(0.6, 0.53, 0.42), tonoPiedra) * (0.85 + 0.15 * snoise(p * 7.0));
  piedra = mix(piedra, mortero * 0.8, junta * 0.85);
  // Estuco: cal envejecida con chorreados verticales y humedad abajo.
  float chorreado = fbm3(vec3(p.x * 3.5, p.y * 0.35, 4.0));
  float humedad = smoothstep(1.4, 0.0, p.y);
  vec3 estuco = diffuseColor.rgb * (0.86 + 0.14 * chorreado) * (1.0 - 0.35 * humedad);
  estuco = mix(estuco, estuco * vec3(0.78, 0.8, 0.74), humedad * 0.5);
  float poros = smoothstep(0.55, 0.9, snoise(p * 26.0));
  vec3 color = mix(estuco, piedra, sinEstuco) * (1.0 - poros * 0.25);
  diffuseColor.rgb = color;
  gAlto = (1.0 - sinEstuco) * 0.6 + (1.0 - junta) * sinEstuco * 0.35 - poros * 0.15 + snoise(p * 9.0) * 0.06;
}`,
      )
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = perturbarNormal(-vViewPosition, normal, gAlto, 1.6);');
  };
  return m;
}

/** Interior visto por el portón: luz cálida, sin detalle (lo íntimo no se muestra). */
function materialInterior() {
  return new THREE.ShaderMaterial({
    uniforms: { uLuz: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uLuz;
      varying vec2 vUv;
      void main() {
        vec2 d = (vUv - vec2(0.5, 0.42)) * vec2(1.6, 1.0);
        float r = dot(d, d);
        vec3 c = vec3(1.0, 0.5, 0.22) * exp(-r * 6.0) * 0.95 + vec3(0.3, 0.1, 0.035) * exp(-r * 1.4) * 0.8;
        gl_FragColor = vec4(c * uLuz, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

function texturaPlaca() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 192;
  const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 512, 192);
  g.addColorStop(0, '#6f5737');
  g.addColorStop(0.5, '#9a7b4f');
  g.addColorStop(1, '#5b4630');
  x.fillStyle = g;
  x.fillRect(0, 0, 512, 192);
  x.strokeStyle = 'rgba(30,20,10,.7)';
  x.lineWidth = 3;
  x.strokeRect(14, 14, 484, 164);
  x.fillStyle = 'rgba(25,16,8,.92)';
  x.font = '300 86px "Cormorant Garamond", serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  if ('letterSpacing' in x) (x as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '28px';
  x.fillText(sitio.nombre, 256 + 14, 100);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** 6 · Visítanos. La cámara llega a Mérida: un muro colonial de piedra y la entrada a Carnal. */
export default function Fachada() {
  const { escena, camara, aspecto } = usarToma('fachada', 3, 34);
  const size = useThree((s) => s.size);
  const alta = env.calidad === 'alta';
  const rm = env.movimientoReducido;

  const geo = useMemo(
    () => ({
      muro: muro(),
      cornisa: new THREE.BoxGeometry(16.4, 0.22, 0.8).translate(0, 5.45, -0.25),
      zocalo: new THREE.BoxGeometry(16, 0.35, 0.08).translate(0, 0.175, 0.02),
      banqueta: new THREE.PlaneGeometry(16, 3.2).rotateX(-Math.PI / 2).translate(0, 0, 1.6),
      calle: new THREE.PlaneGeometry(16, 6).rotateX(-Math.PI / 2).translate(0, -0.14, 6.2),
      bordillo: new THREE.BoxGeometry(16, 0.14, 0.16).translate(0, -0.07, 3.2),
      interior: new THREE.PlaneGeometry(3.2, 3.6).translate(0, 1.8, -2.4),
      pisoInterior: new THREE.PlaneGeometry(2, 2.4).rotateX(-Math.PI / 2).translate(0, 0, -1.2),
      barra: new THREE.CylinderGeometry(0.011, 0.011, 1.98, 8),
      travesano: new THREE.BoxGeometry(1.22, 0.022, 0.022),
      placa: new THREE.PlaneGeometry(0.46, 0.17),
    }),
    [],
  );
  const mat = useMemo(
    () => ({
      muro: materialMuro(),
      piso: new THREE.MeshStandardMaterial({ color: '#2b2621', roughness: 0.92 }),
      calle: new THREE.MeshStandardMaterial({ color: '#141210', roughness: 0.85 }),
      interior: materialInterior(),
      hierro: new THREE.MeshStandardMaterial({ color: '#16120f', roughness: 0.55, metalness: 0.6 }),
      placa: (() => {
        const t = texturaPlaca();
        return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, metalness: 0.25, roughness: 0.45, emissive: '#ffffff', emissiveIntensity: 0.16 });
      })(),
    }),
    [],
  );

  const farol = useRef<THREE.SpotLight>(null);
  const puertaLuz = useRef<THREE.SpotLight>(null);
  const jambas = useRef<THREE.PointLight>(null);
  const ambiente = useRef<THREE.HemisphereLight>(null);
  const objFarol = useMemo(() => new THREE.Object3D(), []);
  const objPuerta = useMemo(() => new THREE.Object3D(), []);
  const avance = useRef(0);

  useEffect(() => {
    const t = mat.placa.map;
    if (t) document.fonts.ready.then(() => {
      const nueva = texturaPlaca();
      mat.placa.map = nueva;
      mat.placa.emissiveMap = nueva;
      mat.placa.needsUpdate = true;
      t.dispose();
    });
  }, [mat]);

  useFrame(() => {
    const h = estado.historia;
    if (h < 4.9 || h > 6.05) return;
    avance.current = amortigua(avance.current, progreso('visitanos'), rm ? 30 : 5, estado.dt);
    const p = avance.current;
    const luz = presencia('fachada', 0.1, 0.07);

    // Llegada: la cámara camina hacia el portón.
    const retrato = aspecto < 1;
    const llegar = rm ? 0.6 : suave(p, 0.0, 0.42);
    const z = mezcla(retrato ? 15 : 10.5, retrato ? 8.2 : 5.3, llegar);
    camara.position.set(rm ? 0 : Math.sin(estado.tiempo * 0.15) * 0.04, mezcla(1.65, 1.5, llegar), z);
    camara.lookAt(0, mezcla(1.9, 1.6, llegar), 0);
    // Cuando aparece la información, el portón se aparta hacia un lado.
    const apartar = suave(p, 0.34, 0.5);
    const { width: w, height: hh } = size;
    if (retrato) camara.setViewOffset(w, hh, 0, -hh * 0.16 * apartar, w, hh);
    else camara.setViewOffset(w, hh, -w * 0.2 * apartar, 0, w, hh);

    if (farol.current) farol.current.intensity = 60 * luz;
    if (puertaLuz.current) puertaLuz.current.intensity = 30 * luz;
    if (jambas.current) jambas.current.intensity = 3.5 * luz;
    if (ambiente.current) ambiente.current.intensity = 0.1 * luz;
    mat.interior.uniforms.uLuz.value = luz;
  });

  return createPortal(
    <>
      <mesh geometry={geo.muro} material={mat.muro} castShadow={alta} receiveShadow />
      <mesh geometry={geo.cornisa} material={mat.muro} receiveShadow />
      <mesh geometry={geo.banqueta} material={mat.piso} receiveShadow />
      <mesh geometry={geo.bordillo} material={mat.piso} receiveShadow />
      <mesh geometry={geo.calle} material={mat.calle} receiveShadow />
      <mesh geometry={geo.interior} material={mat.interior} />
      <mesh geometry={geo.pisoInterior} material={mat.piso} receiveShadow />

      {/* Rejas de hierro de las ventanas */}
      {[-3.3, 3.3].map((x) => (
        <group key={x} position={[x, 2.0, 0.07]}>
          {Array.from({ length: 9 }, (_, i) => (
            <mesh key={i} geometry={geo.barra} material={mat.hierro} position={[-0.52 + i * 0.13, 0, 0]} castShadow={alta} />
          ))}
          {[-0.75, 0, 0.75].map((y) => (
            <mesh key={y} geometry={geo.travesano} material={mat.hierro} position={[0, y, 0]} />
          ))}
        </group>
      ))}

      {/* Placa de latón junto al portón */}
      <mesh geometry={geo.placa} material={mat.placa} position={[1.36, 1.62, 0.012]} />

      <primitive object={objFarol} position={[-1.2, 1.4, 0]} />
      <spotLight
        ref={farol}
        target={objFarol}
        position={[-7.5, 6.5, 3.2]}
        color="#ffcf9e"
        angle={0.42}
        penumbra={0.8}
        decay={2}
        castShadow={alta}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0005}
        shadow-radius={3}
      />
      <primitive object={objPuerta} position={[0, 0, 2.6]} />
      <spotLight ref={puertaLuz} target={objPuerta} position={[0, 2.5, -1.6]} color="#ffb074" angle={0.5} penumbra={0.7} decay={2} />
      <pointLight ref={jambas} position={[0, 1.8, -0.9]} color="#ffb070" distance={3.2} decay={2} />
      <hemisphereLight ref={ambiente} args={['#4a3f36', '#0b0908']} />
    </>,
    escena,
  );
}
