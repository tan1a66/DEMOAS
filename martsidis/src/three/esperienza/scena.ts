/**
 * Scena 3D della Home.
 * La "massa" iniziale è fatta delle parti stesse del modello: ogni vertice parte proiettato sulla superficie
 * della massa (stessi colori, stesso respiro) e, con lo scroll, si sposta verso la sua forma reale
 * cambiando colore. È una trasformazione continua, non una dissolvenza tra oggetti.
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
import { simplexNoise3D } from '../shared/noise-glsl';
import { config } from '@/config';
import { PARAMETRI, type IdStato, type Organo, type ParametriStato } from '../pelvi/stati';

export type Area = { x: number; y: number; w: number; h: number };
export type Comando = {
  /** 0 = massa, 1 = modello composto */
  montaggio: number;
  stato: IdStato;
  /** rotazione extra (rad) guidata dallo scroll dell'anello */
  giro: number;
  /** rettangolo dello schermo (px) in cui inquadrare il modello */
  area: Area;
  opacita: number;
};

const CENTRO = new Vector3(0, 0.62, 0);
const RAGGIO_MASSA = 0.8;
const RAGGIO_MODELLO = 1.5; // sfera che contiene tutto il bacino
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Parti: colore finale, strato nella massa (la più esterna copre le altre), finestra di trasformazione.
// La pelle della massa è l'utero (superficie chiusa attorno al centro: copre tutta la sfera, senza toppe);
// le altre parti partono appena sotto e ne escono trasformandosi.
const PARTI: Record<string, { colore: string; strato: number; finestra: [number, number] }> = {
  utero: { colore: '#c7aedb', strato: 1, finestra: [0.2, 0.82] },
  vescica: { colore: '#9cb9a6', strato: 0.994, finestra: [0.16, 0.74] },
  pavimento: { colore: '#8a5aa6', strato: 0.988, finestra: [0.12, 0.7] },
  retto: { colore: '#d9b590', strato: 0.982, finestra: [0.24, 0.86] },
  vagina: { colore: '#b99bcd', strato: 0.976, finestra: [0.3, 0.9] },
  bacino: { colore: '#ece2d2', strato: 0.97, finestra: [0.04, 0.64] },
};

export async function monta(host: HTMLElement, iniziale: Partial<Comando> = {}) {
  const stage = creaStage(host, { fov: 30, continuo: false });
  const { scene, camera, renderer } = stage;
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

  // Uniform condivise: tempo e respiro della massa
  const comuni = { uTempo: { value: 0 }, uAmp: { value: 0.07 }, uCentro: { value: CENTRO }, uRaggio: { value: RAGGIO_MASSA } };
  const massaColori = { uC1: { value: c.plum500 }, uC2: { value: c.plum300 }, uC3: { value: c.sage200 } };

  const parti: Record<string, Object3D> = {};
  const materiali: Record<string, MeshStandardMaterial> = {};
  const morphU: Record<string, IUniform<number>> = {};
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
    const uMorph = { value: 0 };
    const uStrato = { value: info.strato };
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, comuni, massaColori, { uMorph, uStrato });
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
uniform float uMorph; uniform float uStrato; uniform float uTempo; uniform float uAmp; uniform vec3 uCentro; uniform float uRaggio;
varying float vMassaY; varying float vMassaN; varying vec3 vMassaDir;
${simplexNoise3D}`,
        )
        .replace(
          '#include <project_vertex>',
          `vec4 mondoM = modelMatrix * vec4(transformed, 1.0);
vec3 dirM = normalize(mondoM.xyz - uCentro + vec3(1e-5, 2e-5, 3e-5));
float rumoreM = snoise(dirM * 1.15 + vec3(uTempo * 0.09, uTempo * 0.07, uTempo * 0.05));
vec3 sullaMassa = uCentro + dirM * uRaggio * uStrato * (1.0 + rumoreM * uAmp);
vec3 finaleM = mix(sullaMassa, mondoM.xyz, uMorph);
vec4 mvPosition = viewMatrix * vec4(finaleM, 1.0);
gl_Position = projectionMatrix * mvPosition;
vMassaDir = normalize((viewMatrix * vec4(dirM, 0.0)).xyz);
vMassaY = dirM.y; vMassaN = rumoreM;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform float uMorph; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3;
varying float vMassaY; varying float vMassaN; varying vec3 vMassaDir;`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
vec3 massaC = mix(uC1, uC2, smoothstep(-0.85, 0.95, vMassaY * 0.65 + vMassaN * 0.45 + 0.1));
massaC = mix(massaC, uC3, smoothstep(0.55, 1.0, vMassaY) * 0.35);
diffuseColor.rgb = mix(massaC, diffuseColor.rgb, smoothstep(0.0, 0.85, uMorph));`,
        )
        // finché è massa: stessa luce e stessa superficie per tutte le parti (nessuna "toppa" visibile)
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
roughnessFactor = mix(0.62, roughnessFactor, uMorph);`,
        )
        .replace(
          '#include <normal_fragment_begin>',
          `#include <normal_fragment_begin>
normal = normalize(mix(normalize(vMassaDir), normal, uMorph));`,
        );
    };
    materiali[nome] = mat;
    morphU[nome] = uMorph;
    nodo.traverse((o) => {
      if ((o as Mesh).isMesh) {
        (o as Mesh).material = mat;
        (o as Mesh).frustumCulled = false; // i vertici si spostano nello shader
        if (osso) o.renderOrder = 3;
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
  let nascita = 0; // la massa nasce crescendo da un punto (nessuna dissolvenza)
  let yaw = 0;
  let pitch = 0;
  const mouse = { x: 0, y: 0 };
  const onPointer = (e: PointerEvent) => {
    mouse.x = e.clientX / window.innerWidth - 0.5;
    mouse.y = e.clientY / window.innerHeight - 0.5;
    stage.sveglia(600);
  };
  window.addEventListener('pointermove', onPointer, { passive: true });

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
    nascita = Math.min(nascita + dt / 1.2, 1);
    const cresce = 1 - Math.pow(1 - nascita, 3);
    comuni.uRaggio.value = RAGGIO_MASSA * cresce;
    gruppo.scale.setScalar(cresce);
    gruppo.position.copy(CENTRO).multiplyScalar(1 - cresce);
    comuni.uTempo.value = t;
    comuni.uAmp.value = 0.07 * (1 - smooth(0, 0.5, m));

    // Inquadratura: il modello (o la massa) occupa l'area indicata, centrato e senza uscirne.
    const w = host.clientWidth, h = host.clientHeight;
    const raggioMondo = lerp(RAGGIO_MASSA * 1.07, RAGGIO_MODELLO, smooth(0, 0.9, m));
    const riempi = lerp(0.8, 1, smooth(0, 0.9, m)); // la massa occupa l'80% dell'area (come la versione statica)
    const tanMezzo = Math.tan((camera.fov * Math.PI) / 360);
    const dist = (raggioMondo * h) / (2 * att.ar * riempi * tanMezzo);
    camera.setViewOffset(w, h, w / 2 - att.ax, h / 2 - att.ay, w, h);
    const az = 0.8 + att.giro + yaw + mouse.x * 0.2;
    const el = 0.26 + pitch + mouse.y * 0.1;
    camera.position.set(
      CENTRO.x + dist * Math.sin(az) * Math.cos(el),
      CENTRO.y + dist * Math.sin(el),
      CENTRO.z + dist * Math.cos(az) * Math.cos(el),
    );
    camera.lookAt(CENTRO);

    // Trasformazione massa → parti (ognuna nella sua finestra di scroll)
    for (const [nome, info] of Object.entries(PARTI)) {
      const q = smooth(info.finestra[0], info.finestra[1], m);
      if (morphU[nome]) morphU[nome].value = q;
      const o = parti[nome];
      if (o) {
        o.position.copy(base[nome]!.pos);
        o.scale.setScalar(1);
      }
    }
    if (materiali.bacino) materiali.bacino.opacity = lerp(1, 0.42, smooth(0.25, 0.7, m)) * att.opacita;

    // Stato del modello (solo a modello composto)
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
    }
    gruppo.visible = att.opacita > 0.01;

    // la massa respira sempre; a modello composto si ferma quando nulla si muove
    const fermo =
      nascita >= 1 &&
      m > 0.99 &&
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
  stage.sveglia(1000);

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
