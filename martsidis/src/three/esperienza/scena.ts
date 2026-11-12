/**
 * Scena 3D: figura femminile stilizzata → zoom dentro l'apparato pelvico.
 * All'inizio si vede tutta la figura, traslucida, con gli organi già al loro posto. Scorrendo la camera
 * si avvicina al bacino e la "pelle" si apre a partire dal bacino (un taglio sferico che si allarga, con
 * un bordo luminoso): è un'unica trasformazione continua, senza dissolvenze tra oggetti diversi.
 * L'inquadratura segue un'area dello schermo (rettangolo in px) indicata dalla pagina: i testi stanno fuori.
 */
import {
  Color,
  Group,
  HemisphereLight,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  NeutralToneMapping,
  Object3D,
  PMREMGenerator,
  FrontSide,
  DoubleSide,
  Vector3,
  type IUniform,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { creaStage } from '../shared/stage';
import { paletteBrand } from '../shared/palette';
import { config } from '@/config';
import { PARAMETRI, type IdStato, type Organo, type ParametriStato } from '../pelvi/stati';

export type Area = { x: number; y: number; w: number; h: number };
export type Comando = {
  /** 0 = figura intera, 1 = dentro l'apparato pelvico */
  montaggio: number;
  stato: IdStato;
  /** rotazione extra (rad) guidata dallo scroll dell'anello */
  giro: number;
  /** rettangolo dello schermo (px) in cui inquadrare il modello */
  area: Area;
  opacita: number;
};

const CENTRO = new Vector3(0, 0.62, 0);
const CENTRO_CORPO = new Vector3(0, -0.3, -0.1);
const RAGGIO_CORPO = 8.75; // metà altezza della figura
const RAGGIO_MODELLO = 1.5; // sfera che contiene tutto il bacino
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const PARTI: Record<string, { colore: string }> = {
  utero: { colore: '#c7aedb' },
  vescica: { colore: '#9cb9a6' },
  pavimento: { colore: '#8a5aa6' },
  retto: { colore: '#d9b590' },
  vagina: { colore: '#b99bcd' },
  bacino: { colore: '#ece2d2' },
};

export async function monta(host: HTMLElement, iniziale: Partial<Comando> = {}) {
  const stage = creaStage(host, { fov: 30, continuo: false });
  const { scene, camera, renderer } = stage;
  camera.far = 400;
  camera.updateProjectionMatrix();
  renderer.toneMapping = NeutralToneMapping;
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();

  const c = paletteBrand();
  scene.add(new HemisphereLight(c.ivory, c.plum100, 1.1));
  const sole = new DirectionalLight(0xffffff, 1.8);
  sole.position.set(2.5, 4, 3.5);
  scene.add(sole);

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(config.modelloPelviGlb ?? '/models/pelvi.glb');
  const modello = gltf.scene;

  // Uniform condivise: comparsa (una linea che sale dai piedi alla testa) e taglio della pelle
  const comuni = {
    uComparsa: { value: -10 },
    uTaglio: { value: 0 },
    uCentro: { value: CENTRO },
  };
  const telefono = window.matchMedia('(max-width: 63.99rem)').matches;
  const pelle = {
    uPelleA: { value: (telefono ? c.plum300.clone().lerp(c.ivory, 0.45) : c.plum300.clone()) },
    uPelleB: { value: c.plum500.clone() },
    uBordo: { value: c.sage200.clone() },
  };

  const parti: Record<string, Object3D> = {};
  const materiali: Record<string, MeshStandardMaterial> = {};
  const comparsa = (mat: MeshStandardMaterial, extra?: (shader: { uniforms: Record<string, IUniform>; vertexShader: string; fragmentShader: string }) => void) => {
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, comuni);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
varying vec3 vMondo;`)
        .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
vMondo = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
uniform float uComparsa; uniform float uTaglio; uniform vec3 uCentro;
varying vec3 vMondo;`)
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
if (vMondo.y > uComparsa) discard;`);
      extra?.(shader);
    };
  };

  for (const [nome, info] of Object.entries(PARTI)) {
    const nodo = modello.getObjectByName(nome);
    if (!nodo) continue;
    parti[nome] = nodo;
    const osso = nome === 'bacino';
    const mat = new MeshStandardMaterial({
      color: new Color(info.colore),
      roughness: osso ? 0.8 : 0.48,
      metalness: 0,
      transparent: osso,
      depthWrite: !osso,
      side: nome === 'pavimento' ? DoubleSide : FrontSide,
    });
    comparsa(mat);
    materiali[nome] = mat;
    nodo.traverse((o) => {
      if ((o as Mesh).isMesh) {
        (o as Mesh).material = mat;
        if (osso) o.renderOrder = 3;
      }
    });
  }

  // La pelle: traslucida (più piena sui bordi, come vetro), si apre dal bacino con un bordo luminoso.
  const corpo = modello.getObjectByName('corpo');
  if (corpo) {
    const mat = new MeshStandardMaterial({ roughness: 0.35, metalness: 0, transparent: true, depthWrite: false });
    mat.customProgramCacheKey = () => 'pelle'; // shader diverso da quello degli organi
    comparsa(mat, (shader) => {
      Object.assign(shader.uniforms, pelle);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
uniform vec3 uPelleA; uniform vec3 uPelleB; uniform vec3 uBordo;`)
        .replace('#include <color_fragment>', `#include <color_fragment>
float dTaglio = distance(vMondo, uCentro) - uTaglio;
if (dTaglio < 0.0) discard;
float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 2.2);
diffuseColor.rgb = mix(uPelleA, uPelleB, fres * 0.6);
diffuseColor.a = mix(0.07, 0.62, fres);
float bordo = (1.0 - smoothstep(0.0, 0.35, dTaglio)) * step(0.001, uTaglio);
diffuseColor.rgb = mix(diffuseColor.rgb, uBordo, bordo);
diffuseColor.a = max(diffuseColor.a, bordo * 0.9);`)
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
float lineaComparsa = 1.0 - smoothstep(0.0, 0.5, uComparsa - vMondo.y);`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += uBordo * lineaComparsa * 0.8;`);
    });
    corpo.traverse((o) => {
      if ((o as Mesh).isMesh) {
        (o as Mesh).material = mat;
        o.renderOrder = 5;
      }
    });
  }

  const pavimento = parti.pavimento?.getObjectByName('pavimento_mesh') as Mesh | undefined;
  const morph = (nome: string, v: number) => {
    const i = pavimento?.morphTargetDictionary?.[nome];
    if (pavimento?.morphTargetInfluences && i !== undefined) pavimento.morphTargetInfluences[i] = v;
  };
  const base: Record<string, { pos: Vector3; rotX: number }> = {};
  for (const [n, o] of Object.entries(parti)) base[n] = { pos: o.position.clone(), rotX: o.rotation.x };

  const gruppo = new Group();
  gruppo.add(modello);
  scene.add(gruppo);

  let cmd: Comando = {
    montaggio: 0,
    stato: 'normale',
    giro: 0,
    area: { x: host.clientWidth * 0.55, y: host.clientHeight * 0.2, w: host.clientHeight * 0.6, h: host.clientHeight * 0.6 },
    opacita: 1,
    ...iniziale,
  };
  const att = { montaggio: 0, giro: 0, opacita: 1, ax: 0, ay: 0, ar: 0, ...PARAMETRI.normale };
  let prima = true;
  let nascita = 0; // la figura compare con una linea che sale dai piedi alla testa
  let yaw = 0;
  let pitch = 0;
  const mouse = { x: 0, y: 0 };
  const onPointer = (e: PointerEvent) => {
    mouse.x = e.clientX / window.innerWidth - 0.5;
    mouse.y = e.clientY / window.innerHeight - 0.5;
    stage.sveglia(600);
  };
  window.addEventListener('pointermove', onPointer, { passive: true });
  const centro = new Vector3();

  const fotogramma = (dt: number, t: number) => {
    const k = Math.min(dt * 5, 1);
    const p = PARAMETRI[cmd.stato] as ParametriStato;
    const ax = cmd.area.x + cmd.area.w / 2, ay = cmd.area.y + cmd.area.h / 2;
    const ar = Math.max(Math.min(cmd.area.w, cmd.area.h) / 2, 40);
    if (prima) {
      Object.assign(att, { ax, ay, ar, montaggio: cmd.montaggio });
      prima = false;
    }
    att.ax = lerp(att.ax, ax, k);
    att.ay = lerp(att.ay, ay, k);
    att.ar = lerp(att.ar, ar, k);
    att.montaggio = lerp(att.montaggio, cmd.montaggio, Math.min(dt * 8, 1));
    att.giro = lerp(att.giro, cmd.giro, k);
    att.opacita = lerp(att.opacita, cmd.opacita, k);
    for (const key of ['cedimento', 'iato', 'tensione', 'discesaVescica', 'discesaUtero', 'rotUtero', 'pulsa'] as const) {
      att[key] = lerp(att[key], p[key], Math.min(dt * 3, 1));
    }
    const m = att.montaggio;
    nascita = Math.min(nascita + dt / 1.6, 1);
    comuni.uComparsa.value = lerp(-9.2, 8.6, 1 - Math.pow(1 - nascita, 2)) + (nascita >= 1 ? 100 : 0);

    // Zoom: dalla figura intera all'apparato (interpolazione "logaritmica": velocità costante percepita)
    const z = smooth(0, 1, m);
    const raggioMondo = RAGGIO_CORPO * Math.pow(RAGGIO_MODELLO / RAGGIO_CORPO, z);
    centro.lerpVectors(CENTRO_CORPO, CENTRO, smooth(0, 0.7, m));
    // la pelle si apre dal bacino mentre ci si avvicina
    comuni.uTaglio.value = m < 0.25 ? 0 : 0.2 + Math.pow(smooth(0.25, 1, m), 1.6) * 10;

    const w = host.clientWidth, h = host.clientHeight;
    const tanMezzo = Math.tan((camera.fov * Math.PI) / 360);
    const dist = (raggioMondo * h) / (2 * att.ar * tanMezzo);
    camera.setViewOffset(w, h, w / 2 - att.ax, h / 2 - att.ay, w, h);
    // di fronte da lontano, di tre quarti da vicino (come il modello di sempre)
    const az = lerp(0.15, 0.8, smooth(0.2, 1, m)) + att.giro + yaw + mouse.x * 0.2;
    const el = lerp(0.05, 0.26, smooth(0.2, 1, m)) + pitch + mouse.y * 0.1;
    camera.position.set(
      centro.x + dist * Math.sin(az) * Math.cos(el),
      centro.y + dist * Math.sin(el),
      centro.z + dist * Math.cos(az) * Math.cos(el),
    );
    camera.lookAt(centro);

    for (const nome of Object.keys(PARTI)) {
      const o = parti[nome];
      if (o) o.position.copy(base[nome]!.pos);
    }
    if (materiali.bacino) materiali.bacino.opacity = 0.42 * att.opacita;

    // Stato del modello (solo da vicino)
    const st = smooth(0.88, 1, m);
    morph('cedimento', att.cedimento * st);
    morph('iato', att.iato * st);
    morph('tensione', att.tensione * st);
    if (parti.vescica) parti.vescica.position.y += att.discesaVescica * st;
    if (parti.utero) {
      parti.utero.position.y += att.discesaUtero * st;
      parti.utero.rotation.x = base.utero!.rotX + att.rotUtero * st;
    }
    const evidenza: Organo | null = p.evidenza;
    for (const [nome, mat] of Object.entries(materiali)) {
      const on = evidenza === nome ? st : 0;
      const pulse = 0.5 + 0.5 * Math.sin(t * (2 + att.pulsa * 4));
      mat.emissive.set(mat.color).multiplyScalar(on * (0.22 + 0.18 * pulse));
    }
    if (evidenza === 'vescica' && parti.vescica && att.pulsa > 0.01) {
      parti.vescica.scale.setScalar(1 + Math.sin(t * 6) * 0.03 * att.pulsa * st);
    } else if (parti.vescica) parti.vescica.scale.setScalar(1);
    gruppo.visible = att.opacita > 0.01;

    const fermo =
      nascita >= 1 &&
      Math.abs(att.montaggio - cmd.montaggio) < 0.001 &&
      Math.abs(att.giro - cmd.giro) < 0.001 &&
      Math.abs(att.ax - ax) < 0.5 &&
      Math.abs(att.ay - ay) < 0.5 &&
      Math.abs(att.ar - ar) < 0.5 &&
      !evidenza;
    if (!fermo) stage.sveglia(250);
  };
  stage.onFrame(fotogramma);

  await stage.compila();
  stage.sveglia(1800);

  return {
    comanda(nuovo: Partial<Comando>) {
      cmd = { ...cmd, ...nuovo };
      stage.sveglia(800);
    },
    trascina(dx: number, dy: number) {
      yaw -= dx * 0.006;
      pitch = Math.min(Math.max(pitch + dy * 0.003, -0.25), 0.45);
      stage.sveglia(800);
    },
    dispose() {
      window.removeEventListener('pointermove', onPointer);
      stage.dispose();
    },
  };
}
