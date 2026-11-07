/**
 * Scena 3D della Home: la "palla" iniziale diventa l'utero, attorno si compongono gli altri organi
 * (montaggio guidato dallo scroll) e il modello mostra lo stato della problematica attiva.
 * Il controllo dello scroll è in src/components/Esperienza.astro: qui solo la grafica.
 */
import {
  Color,
  Group,
  HemisphereLight,
  DirectionalLight,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  NeutralToneMapping,
  Object3D,
  PMREMGenerator,
  ShaderMaterial,
  FrontSide,
  DoubleSide,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { creaStage } from '../shared/stage';
import { paletteBrand } from '../shared/palette';
import { simplexNoise3D } from '../shared/noise-glsl';
import { isMobile } from '../shared/capacita';
import { config } from '@/config';
import { PARAMETRI, type IdStato, type Organo, type ParametriStato } from '../pelvi/stati';

export type Comando = {
  /** 0 = solo la palla, 1 = modello composto */
  montaggio: number;
  stato: IdStato;
  /** rotazione extra (rad) guidata dallo scroll dell'anello */
  giro: number;
  /** -1 sinistra … 0 centro … 1 destra (posizione del modello sullo schermo) */
  posto: number;
  /** visibilità complessiva 0–1 */
  opacita: number;
};

const CENTRO = new Vector3(0, 0.62, 0);
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const vertexBlob = /* glsl */ `
uniform float uTime; uniform float uAmp;
varying vec3 vN; varying vec3 vV; varying float vNoise;
${simplexNoise3D}
float sp(vec3 p){ vec3 f=vec3(uTime*.11,uTime*.08,uTime*.06); return snoise(p*.8+f)*uAmp + snoise(p*1.9-f*.7)*uAmp*.12; }
void main(){
  vec3 n=normalize(normal); float d=sp(position); vec3 p=position+n*d;
  vec3 su=abs(n.y)<.99?vec3(0.,1.,0.):vec3(1.,0.,0.); vec3 t=normalize(cross(n,su)); vec3 b=normalize(cross(n,t));
  float r=length(position); float e=.012;
  vec3 p1=normalize(position+t*e)*r; vec3 p2=normalize(position+b*e)*r;
  vec3 d1=p1+normalize(p1)*sp(p1); vec3 d2=p2+normalize(p2)*sp(p2);
  vN=normalize(normalMatrix*normalize(cross(d1-p,d2-p)));
  vec4 mv=modelViewMatrix*vec4(p,1.); vV=-mv.xyz; vNoise=d; gl_Position=projectionMatrix*mv;
}`;
const fragmentBlob = /* glsl */ `
uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; uniform vec3 uRim; uniform float uOpacity;
varying vec3 vN; varying vec3 vV; varying float vNoise;
void main(){
  vec3 N=normalize(vN); vec3 V=normalize(vV);
  float fr=pow(1.-max(dot(N,V),0.),2.4); float l=dot(N,normalize(vec3(-.45,.75,.6)))*.5+.5;
  vec3 c=mix(uC1,uC2,smoothstep(-.7,.95,N.y*.55+vNoise*2.2+.15)); c=mix(c,uC3,smoothstep(.6,1.,l)*.5);
  c*=.86+.22*l; c=mix(c,uRim,fr*.8);
  gl_FragColor=vec4(c,uOpacity);
  #include <colorspace_fragment>
}`;

export async function monta(host: HTMLElement) {
  const mobile = isMobile();
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

  // — Modello anatomico (GLB) —
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(config.modelloPelviGlb ?? '/models/pelvi.glb');
  const modello = gltf.scene;
  const colori: Record<string, string> = {
    bacino: '#ece2d2',
    pavimento: '#8a5aa6',
    vescica: '#9cb9a6',
    utero: '#c7aedb',
    vagina: '#b99bcd',
    retto: '#d9b590',
  };
  const parti: Record<string, Object3D> = {};
  const materiali: Record<string, MeshStandardMaterial> = {};
  for (const nome of Object.keys(colori)) {
    const nodo = modello.getObjectByName(nome);
    if (!nodo) continue;
    parti[nome] = nodo;
    const osso = nome === 'bacino';
    const m = new MeshStandardMaterial({
      color: new Color(colori[nome]),
      roughness: osso ? 0.8 : 0.48,
      metalness: 0,
      transparent: osso,
      opacity: osso ? 0.42 : 1,
      depthWrite: !osso,
      side: nome === 'pavimento' ? DoubleSide : FrontSide,
    });
    materiali[nome] = m;
    nodo.traverse((o) => {
      if ((o as Mesh).isMesh) {
        (o as Mesh).material = m;
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

  // — La "palla" iniziale: stesso shader della forma dell'hero, poi diventa l'utero —
  const matBlob = new ShaderMaterial({
    vertexShader: vertexBlob,
    fragmentShader: fragmentBlob,
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
      uAmp: { value: 0.15 },
      uOpacity: { value: 1 },
      uC1: { value: c.plum500 },
      uC2: { value: c.plum300 },
      uC3: { value: c.sage200 },
      uRim: { value: c.ivory },
    },
  });
  const blob = new Mesh(new IcosahedronGeometry(1, mobile ? 28 : 40), matBlob);
  blob.renderOrder = 4;
  scene.add(blob);

  // — Montaggio: da dove arrivano le parti e in quale tratto dello scroll —
  const arrivi: Record<string, { da: Vector3; finestra: [number, number] }> = {
    utero: { da: new Vector3(0, 0, 0), finestra: [0.22, 0.4] },
    vescica: { da: new Vector3(0, 0.4, 1.8), finestra: [0.3, 0.55] },
    retto: { da: new Vector3(0, 0.3, -1.8), finestra: [0.36, 0.6] },
    vagina: { da: new Vector3(0, -1.2, 0.3), finestra: [0.42, 0.62] },
    pavimento: { da: new Vector3(0, -1.4, 0), finestra: [0.48, 0.75] },
    bacino: { da: new Vector3(0, 0.2, 0), finestra: [0.58, 0.95] },
  };

  // — Stato corrente (interpolato) e comando ricevuto dallo scroll —
  let cmd: Comando = { montaggio: 0, stato: 'normale', giro: 0, posto: mobile ? 0 : 0.45, opacita: 1 };
  const att = { montaggio: 0, giro: 0, posto: cmd.posto, opacita: 1, ...PARAMETRI.normale };
  let evidenza: Organo | null = null;
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
    att.montaggio = lerp(att.montaggio, cmd.montaggio, Math.min(dt * 8, 1));
    att.giro = lerp(att.giro, cmd.giro, k);
    att.posto = lerp(att.posto, cmd.posto, k);
    att.opacita = lerp(att.opacita, cmd.opacita, k);
    for (const key of ['cedimento', 'iato', 'tensione', 'discesaVescica', 'discesaUtero', 'rotUtero', 'pulsa'] as const) {
      att[key] = lerp(att[key], p[key], Math.min(dt * 3, 1));
    }
    evidenza = p.evidenza;
    const m = att.montaggio;

    // camera: posizione sullo schermo (view offset), parallasse del mouse, rotazione da scroll e trascinamento
    const w = host.clientWidth, h = host.clientHeight;
    camera.setViewOffset(w, h, -att.posto * w * 0.24, mobile ? h * 0.1 : 0, w, h);
    const az = 0.8 + att.giro + yaw + mouse.x * 0.25;
    const el = 0.26 + pitch + mouse.y * 0.12;
    const dist = (mobile ? 7.2 : 5.6) * (h > w ? 1.15 : 1) * (1 + Math.min(Math.abs(att.giro), 0.12));
    camera.position.set(
      CENTRO.x + dist * Math.sin(az) * Math.cos(el),
      CENTRO.y + dist * Math.sin(el),
      CENTRO.z + dist * Math.cos(az) * Math.cos(el),
    );
    camera.lookAt(CENTRO);

    // palla → utero
    const morphBlob = smooth(0, 0.34, m);
    const uteroPos = base.utero?.pos ?? CENTRO;
    blob.position.lerpVectors(CENTRO, uteroPos, morphBlob);
    blob.scale.setScalar(lerp(1.05, 0.2, morphBlob));
    blob.scale.y *= lerp(1, 1.35, morphBlob);
    matBlob.uniforms.uTime!.value = t;
    matBlob.uniforms.uAmp!.value = lerp(0.15, 0.03, morphBlob);
    matBlob.uniforms.uOpacity!.value = (1 - smooth(0.3, 0.42, m)) * att.opacita;
    blob.visible = matBlob.uniforms.uOpacity!.value > 0.01;

    for (const [nome, o] of Object.entries(parti)) {
      const a = arrivi[nome];
      if (!a) continue;
      const q = smooth(a.finestra[0], a.finestra[1], m);
      const b0 = base[nome]!;
      o.position.set(b0.pos.x + a.da.x * (1 - q), b0.pos.y + a.da.y * (1 - q), b0.pos.z + a.da.z * (1 - q));
      o.visible = q > 0.002 && att.opacita > 0.01;
      const s = nome === 'bacino' ? lerp(1.6, 1, q) : lerp(0.001, 1, q);
      o.scale.setScalar(s);
      if (nome === 'bacino') materiali.bacino!.opacity = 0.42 * q * att.opacita;
    }

    // stato del modello (solo a modello composto)
    const st = smooth(0.85, 1, m);
    morph('cedimento', att.cedimento * st);
    morph('iato', att.iato * st);
    morph('tensione', att.tensione * st);
    if (parti.vescica) parti.vescica.position.y += att.discesaVescica * st;
    if (parti.utero) {
      parti.utero.position.y += att.discesaUtero * st;
      parti.utero.rotation.x = base.utero!.rotX + att.rotUtero * st;
    }
    for (const [nome, mat] of Object.entries(materiali)) {
      const on = evidenza === nome ? st : 0;
      const pulse = 0.5 + 0.5 * Math.sin(t * (2 + att.pulsa * 4));
      mat.emissive.set(mat.color).multiplyScalar(on * (0.22 + 0.18 * pulse));
      if (nome !== 'bacino') mat.opacity = 1;
    }
    if (evidenza === 'vescica' && parti.vescica && att.pulsa > 0.01) {
      parti.vescica.scale.setScalar(1 + Math.sin(t * 6) * 0.03 * att.pulsa * st);
    }
    gruppo.visible = att.opacita > 0.01;

    // continua a disegnare finché qualcosa si muove (palla, pulsazioni, interpolazioni)
    const fermo =
      Math.abs(att.montaggio - cmd.montaggio) < 0.001 &&
      Math.abs(att.giro - cmd.giro) < 0.001 &&
      Math.abs(att.posto - cmd.posto) < 0.001 &&
      !blob.visible &&
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
