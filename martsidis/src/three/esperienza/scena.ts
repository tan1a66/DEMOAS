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
  AnimationMixer,
  Matrix4,
  SkinnedMesh,
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
const CENTRO_CORPO = new Vector3(0, 0, -0.1);
const RAGGIO_CORPO = 8.7; // metà altezza della figura (alta 16,8)
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

/** Andatura: dove la figura comincia a camminare, quanto dura la camminata, quante falcate al secondo. */
// passo lento; il ciclo del passo segue lo spazio percorso (il piede d'appoggio resta fermo a terra)
const CAMMINO = { partenza: -15, durata: 6.2, ampiezza: 0.27 };

export async function monta(
  host: HTMLElement,
  iniziale: Partial<Comando> = {},
  { cammina = false, ritardo = 0, attesa = (): boolean => false }: { cammina?: boolean; ritardo?: number; attesa?: () => boolean } = {},
) {
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
  // la figura animata (Meshy + Mixamo, public/models/donna.glb) è facoltativa: senza, resta quella del modello
  const [gltf, animata] = await Promise.all([
    loader.loadAsync(config.modelloPelviGlb ?? '/models/pelvi.glb'),
    loader.loadAsync('/models/donna.glb').catch(() => null),
  ]);
  const modello = gltf.scene;

  // Uniform condivise: comparsa (una linea che sale dai piedi alla testa) e taglio della pelle
  const comuni = {
    uComparsa: { value: -10 },
    uTaglio: { value: 0 },
    uCentro: { value: CENTRO.clone() },
  };
  // su telefono la figura sta dietro ai testi: tinte un po' più chiare
  const telefono = window.matchMedia('(max-width: 63.99rem)').matches;
  const tinta = (col: Color, q: number) => (telefono ? col.clone().lerp(c.ivory, q) : col.clone());
  const pelle = {
    uPelleA: { value: tinta(c.plum300, 0.45) },
    uBordo: { value: c.sage200.clone() },
    uFase: { value: 0 },
    uPasso: { value: 0 },
    uGruppoPos: { value: new Vector3() },
    uGruppoRot: { value: 0 },
    uOndaAmp: { value: 0 },
    uOndaT: { value: 0 },
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
  // Stesso shader per pelle e capelli: cambiano solo i colori e quanto sono "pieni".
  // articolazioni della figura (dal modello: scripts/modello/prepara-donna.mjs)
  type Art = { anca: number; ginocchio: number; spalla: number[]; mano: number[]; collo: number; vita: number; piedi: number };
  const art: Art = (modello.getObjectByName('corpo')?.userData.articolazioni as Art) ?? {
    anca: 0.3, ginocchio: -4.6, spalla: [1.62, 4.95, -0.2], mano: [2.28, -0.35, 0.02], collo: 5.9, vita: 2.2, piedi: -9.3,
  };
  const uArt = {
    uAnca: { value: art.anca },
    uGin: { value: art.ginocchio },
    uSpalla: { value: new Vector3(...(art.spalla as [number, number, number])) },
    uMano: { value: new Vector3(...(art.mano as [number, number, number])) },
    uCollo: { value: art.collo },
    uVita: { value: art.vita },
    uPiedi: { value: art.piedi },
    uCapelli: { value: tinta(c.plum500, 0.12).lerp(c.plum700, 0.25) },
  };
  const materialePelle = (colA: Color, colB: Color, pieno: number, testa: number, scrive = false, onda = 0) => {
    const mat = new MeshStandardMaterial({ roughness: 0.35, metalness: 0, transparent: true, depthWrite: scrive, vertexColors: true });
    mat.customProgramCacheKey = () => 'pelle'; // shader diverso da quello degli organi
    const propri = { uPelleA: { value: colA }, uPelleB: { value: colB }, uPieno: { value: pieno }, uTesta: { value: testa }, uOnda: { value: onda }, uDaY: { value: -100 }, uViso: { value: c.plum300.clone().lerp(c.ivory, 0.82) } };
    comparsa(mat, (shader) => {
      Object.assign(shader.uniforms, pelle, propri, uArt);
      // Camminata: gambe, ginocchia e braccia ruotano attorno alle articolazioni (nello spazio della figura)
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
uniform float uFase; uniform float uPasso; uniform vec3 uGruppoPos; uniform float uGruppoRot;
uniform float uOnda; uniform float uOndaAmp; uniform float uOndaT;
uniform float uAnca; uniform float uGin; uniform vec3 uSpalla; uniform vec3 uMano; uniform float uCollo; uniform float uVita; uniform float uPiedi;
vec3 rotX(vec3 p, vec3 c, float a) {
  vec3 d = p - c; float co = cos(a), si = sin(a);
  return c + vec3(d.x, d.y * co - d.z * si, d.y * si + d.z * co);
}
vec3 rotZ(vec3 p, vec3 c, float a) {
  vec3 d = p - c; float co = cos(a), si = sin(a);
  return c + vec3(d.x * co - d.y * si, d.x * si + d.y * co, d.z);
}
vec3 cammina(vec3 p) {
  float s = p.x >= 0.0 ? 1.0 : -1.0;
  float fi = uFase + (s > 0.0 ? 0.0 : 3.14159);
  // braccia (pesi calcolati prima: le mani, all'altezza delle cosce, non devono seguire le gambe)
  vec3 sp = vec3(s * uSpalla.x, uSpalla.y, uSpalla.z);
  vec3 ab = vec3(s * uMano.x, uMano.y, uMano.z) - sp;
  // asse del braccio prolungato oltre il polso, così anche la mano lo segue tutta
  float h = clamp(dot(p - sp, ab) / dot(ab, ab), 0.0, 1.15);
  float da = length(p - sp - ab * h);
  float wa = (1.0 - smoothstep(0.5, 0.75, da)) * smoothstep(0.04, 0.2, h);
  float we = smoothstep(0.34, 0.68, h) * wa; // transizione lunga: il gomito si piega senza spigolo
  // gambe: la piega è distribuita sulla coscia alta, così i fianchi non si deformano
  float wl = (1.0 - smoothstep(uAnca - 2.0, uAnca - 0.55, p.y)) * smoothstep(0.0, 0.05, abs(p.x)) * (1.0 - wa);
  float wk = 1.0 - smoothstep(uGin - 0.5, uGin + 0.4, p.y);
  p = rotX(p, vec3(0.0, uGin, 0.04), uPasso * 0.75 * max(0.0, cos(fi)) * wk * wl);
  p = rotX(p, vec3(0.0, uAnca, -0.06), -uPasso * 0.27 * sin(fi) * wl);
  // un piede davanti all'altro: la gamba si porta verso il centro, come in passerella
  p = rotZ(p, vec3(0.0, uAnca, 0.0), -s * uPasso * 0.075 * wl);
  // braccia: oscillano avanti e indietro, opposte alla gamba dello stesso lato, gomito appena piegato
  vec3 gomito = sp + ab * 0.5;
  p = rotX(p, vec3(0.0, gomito.y, gomito.z), -uPasso * (0.06 + 0.2 * max(0.0, -sin(fi))) * we);
  p = rotX(p, sp, uPasso * 0.28 * sin(fi) * wa);
  // ondeggiare dei fianchi verso la gamba d'appoggio (svanisce verso i piedi e verso le spalle)
  float fianchi = smoothstep(uPiedi, uAnca - 0.8, p.y) * (1.0 - smoothstep(uVita, uVita + 2.8, p.y));
  p.x -= uPasso * 0.13 * sin(uFase) * fianchi * (1.0 - wa); // le braccia restano un pezzo unico
  return p;
}`)
        .replace('#include <project_vertex>', `vec4 mondoC = modelMatrix * vec4(transformed, 1.0);
float cg = cos(uGruppoRot), sg = sin(uGruppoRot);
vec3 fC = mondoC.xyz - uGruppoPos;
fC = vec3(cg * fC.x - sg * fC.z, fC.y, sg * fC.x + cg * fC.z);
float capello = 0.0;
#ifdef USE_COLOR
capello = color.r;
#endif
fC = cammina(fC);
// capelli: ondeggiano come in acqua. Un'onda scende dalla nuca alle punte (sfasata con l'altezza),
// segue l'ondeggiare dei fianchi e, camminando, la chioma scivola indietro. Le punte si muovono di più.
float lunghi = uOnda * capello * pow(1.0 - smoothstep(uVita - 0.5, uCollo + 0.8, fC.y), 1.4);
float giu = uCollo + 1.0 - fC.y;
fC.x += lunghi * uOndaAmp * 0.38 * sin(uOndaT * 2.1 - giu * 0.85);
fC.x += lunghi * uPasso * 0.16 * sin(uFase - 0.9 - giu * 0.3);
fC.z -= lunghi * uOndaAmp * 0.24 * (0.55 + 0.45 * sin(uOndaT * 1.6 - giu * 0.7 + 1.0));
fC.z -= lunghi * uPasso * 0.32;
fC.y += lunghi * uPasso * 0.05 * cos(uFase * 2.0);
vec3 wC = vec3(cg * fC.x + sg * fC.z, fC.y, -sg * fC.x + cg * fC.z) + uGruppoPos;
vec4 mvPosition = viewMatrix * vec4(wC, 1.0);
gl_Position = projectionMatrix * mvPosition;`)
        .replace('#include <fog_vertex>', `#include <fog_vertex>
vMondo = wC;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
uniform vec3 uPelleA; uniform vec3 uPelleB; uniform vec3 uBordo; uniform float uPieno; uniform float uTesta; uniform float uDaY; uniform vec3 uViso; uniform vec3 uCapelli; uniform float uCollo;`)
        .replace('#include <color_fragment>', `#include <color_fragment>
float dTaglio = distance(vMondo, uCentro) - uTaglio;
if (dTaglio < 0.0 || vMondo.y < uDaY) discard;
float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 2.2);
diffuseColor.rgb = mix(uPelleA, uPelleB, fres * 0.6);
diffuseColor.a = mix(uPieno, max(0.62, uPieno), fres);
// la testa è più piena: davanti ai capelli raccolti si vede il viso, non l'interno della capigliatura
float capelloF = 0.0;
#ifdef USE_COLOR
capelloF = smoothstep(0.3, 0.7, vColor.r);
#endif
float testaW = uTesta * smoothstep(uCollo + 0.25, uCollo + 0.6, vMondo.y) * (1.0 - capelloF);
diffuseColor.a = max(diffuseColor.a, testaW);
// il viso pieno prende il tono con cui la pelle traslucida appare sul fondo: chiaro, distinto dai capelli
diffuseColor.rgb = mix(diffuseColor.rgb, uViso, testaW);
// i capelli: un viola profondo, quasi pieni, con un riflesso sui bordi
diffuseColor.rgb = mix(diffuseColor.rgb, mix(uCapelli, uPelleB, fres * 0.35), capelloF);
diffuseColor.a = mix(diffuseColor.a, 0.86, capelloF * uTesta);
float bordo = (1.0 - smoothstep(0.0, 0.35, dTaglio)) * step(0.001, uTaglio);
diffuseColor.rgb = mix(diffuseColor.rgb, uBordo, bordo);
diffuseColor.a = max(diffuseColor.a, bordo * 0.9);`)
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
float lineaComparsa = 1.0 - smoothstep(0.0, 0.5, uComparsa - vMondo.y);`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += uBordo * lineaComparsa * 0.8;`);
    });
    mat.userData.propri = propri;
    return mat;
  };
  const vesti = (nome: string, mat: MeshStandardMaterial, ordine: number) =>
    modello.getObjectByName(nome)?.traverse((o) => {
      if ((o as Mesh).isMesh) {
        (o as Mesh).material = mat;
        o.renderOrder = ordine;
      }
    });
  const matPelle = materialePelle(pelle.uPelleA.value, c.plum500.clone(), 0.07, 1, false, 1);
  const matSagoma = materialePelle(pelle.uPelleA.value, c.plum500.clone(), 1, 0, true);
  matSagoma.colorWrite = false;
  (matSagoma.userData.propri as { uDaY: { value: number } }).uDaY.value = art.piedi - 1;
  // Solo profondità, disegnata prima della pelle: si vede solo la superficie davanti (niente doppi strati, niente
  // capelli attraverso la schiena). Dopo le ossa del bacino (3), prima della pelle (5): l'apparato resta visibile.
  const conSagoma = (m: Mesh) => {
    const sk = m as SkinnedMesh;
    const sag = sk.isSkinnedMesh ? new SkinnedMesh(m.geometry, matSagoma) : new Mesh(m.geometry, matSagoma);
    if (sk.isSkinnedMesh) (sag as unknown as SkinnedMesh).bind(sk.skeleton, sk.bindMatrix);
    sag.position.copy(m.position);
    sag.quaternion.copy(m.quaternion);
    sag.scale.copy(m.scale);
    sag.renderOrder = 4;
    sag.frustumCulled = false;
    m.parent?.add(sag);
  };
  const corpoStatico = modello.getObjectByName('corpo');
  let mixer: AnimationMixer | null = null;
  let hips: Object3D | null = null;
  const apparato = new Group();
  const H0 = new Matrix4();
  const Ht = new Matrix4();
  const Pinv = new Matrix4();
  if (animata && corpoStatico?.parent) {
    // la figura animata prende il posto di quella statica, con la stessa pelle
    corpoStatico.visible = false;
    const figura = animata.scene;
    const al = (figura.children[0]?.userData.allineamento ?? figura.userData.allineamento) as
      | { scala: number; posizione: [number, number, number] }
      | undefined;
    if (al) {
      figura.scale.setScalar(al.scala);
      figura.position.fromArray(al.posizione);
    }
    corpoStatico.parent.add(figura);
    const pelli: Mesh[] = [];
    figura.traverse((o) => {
      if ((o as Mesh).isMesh) pelli.push(o as Mesh);
    });
    for (const m of pelli) {
      m.material = matPelle;
      m.renderOrder = 5;
      m.frustumCulled = false;
      conSagoma(m);
    }
    hips = figura.getObjectByName('mixamorigHips') ?? null;
    // l'apparato segue il bacino: riferimento = posa di partenza del modello (quella allineata all'apparato),
    // misurata prima che l'animazione muova le ossa
    const genitore = corpoStatico.parent;
    genitore.add(apparato);
    for (const o of Object.values(parti)) apparato.add(o);
    apparato.matrixAutoUpdate = false;
    modello.updateMatrixWorld(true);
    if (hips) H0.copy(Pinv.copy(genitore.matrixWorld).invert().multiply(hips.matrixWorld)).invert();
    if (animata.animations[0]) {
      mixer = new AnimationMixer(figura);
      mixer.clipAction(animata.animations[0]).play();
    }
  } else {
    vesti('corpo', matPelle, 5);
    const pelleCorpo = modello.getObjectByName('corpo_mesh') as Mesh | undefined;
    if (pelleCorpo) conSagoma(pelleCorpo);
  }
  // i capelli fanno parte della figura (maschera nel colore dei vertici): colore e ondeggiare nello shader della pelle

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
  let xPrima = CAMMINO.partenza;
  let tCammino = -ritardo; // con l'entrata dalla porta, la figura compare e cammina quando la porta è aperta
  let onda = cammina ? 1 : 0;
  let fase = 0;

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
    if (tCammino > -0.4) nascita = Math.min(nascita + dt / 1.6, 1);
    // la figura si muove finché la si guarda intera; con lo zoom rallenta e si ferma
    const velocita = 1 - smooth(0, 0.25, att.montaggio);
    if (mixer && velocita > 0.001) {
      mixer.update(dt * velocita);
      if (hips && apparato.parent) {
        apparato.parent.updateMatrixWorld(true);
        Ht.copy(Pinv.copy(apparato.parent.matrixWorld).invert().multiply(hips.matrixWorld));
        apparato.matrix.copy(Ht).multiply(H0);
        apparato.matrixWorldNeedsUpdate = true;
      }
    }

    // La figura entra camminando di profilo, rallenta, si gira verso di noi e si ferma.
    // finché la porta è chiusa la figura aspetta (nascosta); poi compare ed entra
    if (attesa()) tCammino = -ritardo;
    else tCammino += dt;
    const q = cammina ? Math.min(Math.max(tCammino, 0) / CAMMINO.durata, 1) : 1;
    const frena = 1 - Math.pow(1 - q, 2.2);
    const passo = 1 - smooth(0.62, 0.97, q);
    const x = CAMMINO.partenza * (1 - frena);
    // un ciclo (due passi) = 4 · gamba · sin(ampiezza): la fase avanza con lo spazio, non con il tempo
    const ciclo = 4 * (art.anca - art.piedi) * Math.sin(CAMMINO.ampiezza);
    fase += (Math.abs(x - xPrima) / ciclo) * Math.PI * 2;
    xPrima = x;
    gruppo.position.set(x, -Math.abs(Math.sin(fase)) * 0.05 * passo, 0);
    gruppo.rotation.y = (Math.PI / 2) * (1 - smooth(0.55, 1, q));
    pelle.uFase.value = fase;
    pelle.uPasso.value = passo;
    pelle.uGruppoPos.value.copy(gruppo.position);
    pelle.uGruppoRot.value = gruppo.rotation.y;
    // l'ondeggiare dei capelli segue il passo e si spegne piano dopo che la figura si è fermata
    onda = Math.max(passo, onda * Math.exp(-dt * 0.55)); // dopo l'arrivo i capelli si posano piano
    if (onda < 0.01) onda = 0;
    pelle.uOndaAmp.value = onda;
    pelle.uOndaT.value += dt;
    comuni.uCentro.value.copy(CENTRO).add(gruppo.position);
    comuni.uComparsa.value = lerp(-8.8, 8.9, 1 - Math.pow(1 - nascita, 2)) + (nascita >= 1 ? 100 : 0);

    // Zoom: dalla figura intera all'apparato (interpolazione "logaritmica": velocità costante percepita)
    const z = smooth(0, 1, m);
    const raggioMondo = RAGGIO_CORPO * Math.pow(RAGGIO_MODELLO / RAGGIO_CORPO, z);
    centro.lerpVectors(CENTRO_CORPO, CENTRO, smooth(0, 0.7, m)).addScaledVector(gruppo.position, Math.min(m * 4, 1));
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
      if (o) o.position.copy(base[nome]!.pos).setX(base[nome]!.pos.x - 0.13 * Math.sin(fase) * passo); // gli organi seguono i fianchi
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
      (!cammina || tCammino >= CAMMINO.durata || attesa()) &&
      onda === 0 &&
      Math.abs(att.montaggio - cmd.montaggio) < 0.001 &&
      Math.abs(att.giro - cmd.giro) < 0.001 &&
      Math.abs(att.ax - ax) < 0.5 &&
      Math.abs(att.ay - ay) < 0.5 &&
      Math.abs(att.ar - ar) < 0.5 &&
      !evidenza &&
      !(mixer && velocita > 0.001);
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
