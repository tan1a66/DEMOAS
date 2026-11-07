/**
 * Hero: forma organica astratta (non anatomica). Una sfera deformata dal noise nel vertex shader,
 * con gradiente nei colori del brand e un leggero effetto fresnel sui bordi.
 * Si muove lentamente e reagisce poco a mouse e scroll.
 */
import { IcosahedronGeometry, Mesh, ShaderMaterial, Group } from 'three';
import { creaStage } from '../shared/stage';
import { paletteBrand } from '../shared/palette';
import { simplexNoise3D } from '../shared/noise-glsl';

const vertexShader = /* glsl */ `
uniform float uTime;
uniform float uAmp;
uniform float uFreq;
varying vec3 vNormal;
varying vec3 vViewPos;
varying float vNoise;

${simplexNoise3D}

float spostamento(vec3 p) {
  vec3 flusso = vec3(uTime * 0.11, uTime * 0.08, uTime * 0.06);
  float n1 = snoise(p * uFreq + flusso);
  float n2 = snoise(p * uFreq * 2.3 - flusso * 0.7);
  return n1 * uAmp + n2 * uAmp * 0.12;
}

void main() {
  vec3 n = normalize(normal);
  float d = spostamento(position);
  vec3 spostato = position + n * d;

  // Normale ricalcolata con due punti vicini sulla sfera (serve per luce e fresnel).
  vec3 su = abs(n.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 t = normalize(cross(n, su));
  vec3 b = normalize(cross(n, t));
  float r = length(position);
  float e = 0.012;
  vec3 p1 = normalize(position + t * e) * r;
  vec3 p2 = normalize(position + b * e) * r;
  vec3 d1 = p1 + normalize(p1) * spostamento(p1);
  vec3 d2 = p2 + normalize(p2) * spostamento(p2);
  vec3 nuovaNormale = normalize(cross(d1 - spostato, d2 - spostato));

  vNormal = normalize(normalMatrix * nuovaNormale);
  vec4 mv = modelViewMatrix * vec4(spostato, 1.0);
  vViewPos = -mv.xyz;
  vNoise = d;
  gl_Position = projectionMatrix * mv;
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uCol1;
uniform vec3 uCol2;
uniform vec3 uCol3;
uniform vec3 uRim;
varying vec3 vNormal;
varying vec3 vViewPos;
varying float vNoise;

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vViewPos);
  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.4);
  float luce = dot(N, normalize(vec3(-0.45, 0.75, 0.6))) * 0.5 + 0.5;

  float g = smoothstep(-0.7, 0.95, N.y * 0.55 + vNoise * 2.2 + 0.15);
  vec3 col = mix(uCol1, uCol2, g);
  col = mix(col, uCol3, smoothstep(0.6, 1.0, luce) * 0.5);
  col *= 0.86 + 0.22 * luce;
  col = mix(col, uRim, fresnel * 0.8);

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

export async function monta(host: HTMLElement) {
  const stage = creaStage(host, { fov: 32 });
  const { scene, camera } = stage;
  camera.position.set(0, 0, 4.6);

  const colori = paletteBrand();
  const materiale = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uAmp: { value: 0.15 },
      uFreq: { value: 0.8 },
      uCol1: { value: colori.plum500 },
      uCol2: { value: colori.plum300 },
      uCol3: { value: colori.sage200 },
      uRim: { value: colori.ivory },
    },
  });

  const forma = new Mesh(new IcosahedronGeometry(1, 40), materiale);
  const gruppo = new Group();
  gruppo.add(forma);
  scene.add(gruppo);

  // Reazione morbida a mouse e scroll (piccoli angoli, interpolati).
  const obiettivo = { x: 0, y: 0, scroll: 0 };
  const suMouse = (e: PointerEvent) => {
    obiettivo.x = (e.clientX / window.innerWidth - 0.5) * 0.35;
    obiettivo.y = (e.clientY / window.innerHeight - 0.5) * 0.25;
  };
  const suScroll = () => {
    obiettivo.scroll = Math.min(window.scrollY / window.innerHeight, 1.5);
  };
  window.addEventListener('pointermove', suMouse, { passive: true });
  window.addEventListener('scroll', suScroll, { passive: true });

  stage.onFrame((dt, t) => {
    materiale.uniforms.uTime!.value = t;
    forma.rotation.y += dt * 0.06;
    gruppo.rotation.y += (obiettivo.x - gruppo.rotation.y) * Math.min(dt * 1.5, 1);
    gruppo.rotation.x += (obiettivo.y + obiettivo.scroll * 0.35 - gruppo.rotation.x) * Math.min(dt * 1.5, 1);
    gruppo.position.y = -obiettivo.scroll * 0.25;
  });

  stage.renderOnce();

  return {
    dispose() {
      window.removeEventListener('pointermove', suMouse);
      window.removeEventListener('scroll', suScroll);
      forma.geometry.dispose();
      materiale.dispose();
      stage.dispose();
    },
  };
}
