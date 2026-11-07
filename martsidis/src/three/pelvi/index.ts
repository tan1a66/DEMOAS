/**
 * Modello interattivo del pavimento pelvico.
 * - modello procedurale o .glb (config.modelloPelviGlb), stessa interfaccia (modello.ts);
 * - 4 stati con transizioni animate (stati.ts), pilotati dai pulsanti della pagina (ModelloPelvi.astro);
 * - rotazione limitata (mai capovolto), nessun pan, zoom solo con pulsanti/tastiera e mai su mobile;
 * - su touch: trascinamento orizzontale = rotazione, verticale = scroll della pagina (nessuna "trappola");
 * - ciclo di render solo quando qualcosa si muove, in pausa fuori schermo.
 */
import {
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  HemisphereLight,
  DirectionalLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  PlaneGeometry,
  SphereGeometry,
  Vector3,
  type Object3D,
} from 'three';
import { creaStage } from '../shared/stage';
import { paletteBrand } from '../shared/palette';
import { isMobile, cedi } from '../shared/capacita';
import { config } from '@/config';
import { STATI, STATO_INIZIALE, isIdStato, statoPerId, type IdStato, type ParametriStato } from './stati';
import { creaModelloProcedurale } from './procedurale';
import type { ModelloPelvi, IdEtichetta } from './modello';

const ETICHETTE: Record<IdEtichetta, string> = {
  vescica: 'Vescica',
  utero: 'Utero',
  retto: 'Retto',
  pavimento: 'Pavimento pelvico',
  bacino: 'Bacino',
};

// Vista: orbita intorno al bersaglio con angoli limitati.
const BERSAGLIO = new Vector3(0, 0.55, 0);
const VISTA_INIZIALE = { azimut: 1.2, elevazione: 0.36, distanza: 5.1 };
const LIMITI = { azimut: [0.1, 1.9], elevazione: [-0.1, 0.75], distanza: [3.8, 6.4] } as const;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (v: number, [min, max]: readonly [number, number]) => Math.min(Math.max(v, min), max);

function interpola(a: ParametriStato, b: ParametriStato, t: number): ParametriStato {
  const r = { ...a };
  for (const k of Object.keys(a) as Array<keyof ParametriStato>) r[k] = a[k] + (b[k] - a[k]) * t;
  return r;
}

function creaFreccia(colore: Color, lunghezza: number, verso: 1 | -1) {
  const g = new Group();
  const mat = new MeshStandardMaterial({ color: colore, roughness: 0.5, transparent: true, opacity: 0 });
  const asta = new Mesh(new CylinderGeometry(0.03, 0.03, lunghezza * 0.65, 14), mat);
  const punta = new Mesh(new ConeGeometry(0.085, lunghezza * 0.35, 20), mat);
  // L'origine del gruppo è la punta della freccia; l'asta sta dalla parte opposta al verso.
  punta.position.y = -verso * lunghezza * 0.175;
  asta.position.y = -verso * lunghezza * 0.675;
  punta.rotation.x = verso === -1 ? Math.PI : 0;
  const coda = new Group();
  coda.position.y = -verso * lunghezza * 1.05;
  g.add(asta, punta, coda);
  g.renderOrder = 4;
  return { gruppo: g, materiale: mat, coda };
}

function ombraContatto() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(62,41,85,0.18)');
  grad.addColorStop(1, 'rgba(62,41,85,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const mesh = new Mesh(
    new PlaneGeometry(3.4, 2.6),
    new MeshBasicMaterial({ map: new CanvasTexture(canvas), transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.42;
  return mesh;
}

async function caricaModello(): Promise<ModelloPelvi> {
  if (config.modelloPelviGlb) {
    try {
      const { caricaModelloGlb } = await import('./glb');
      return await caricaModelloGlb(config.modelloPelviGlb);
    } catch (errore) {
      console.warn('Modello .glb non caricato: uso il modello procedurale.', errore);
    }
  }
  return creaModelloProcedurale();
}

export async function monta(host: HTMLElement) {
  const radiceUi = host.closest<HTMLElement>('[data-pelvi]') ?? host.parentElement!;
  const stage = creaStage(host, { fov: 30, continuo: false });
  const { scene, camera, renderer } = stage;
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;

  const c = paletteBrand();
  scene.add(new HemisphereLight(c.ivory, c.plum100, 1.7));
  const sole = new DirectionalLight(0xffffff, 2.1);
  sole.position.set(2.5, 4, 3.5);
  const controluce = new DirectionalLight(c.sage200, 0.9);
  controluce.position.set(-3, 2, -3);
  scene.add(sole, controluce);

  await cedi();
  const modello = await caricaModello();
  scene.add(modello.radice);
  await cedi();
  scene.add(ombraContatto());

  // — Frecce e goccia —
  const pressione = creaFreccia(c.plum700, 0.5, -1);
  const discesa = creaFreccia(c.plum500, 0.38, -1);
  const sostegno = [-0.32, 0, 0.32].map(() => creaFreccia(c.sage500, 0.26, 1));
  modello.riferimenti.pressione.add(pressione.gruppo);
  modello.riferimenti.discesa.add(discesa.gruppo);
  sostegno.forEach((f, i) => {
    f.gruppo.position.set((i - 1) * 0.32, -0.12, 0);
    modello.riferimenti.centroAmaca.add(f.gruppo);
  });
  const matGoccia = new MeshStandardMaterial({ color: new Color('#e9cf8f'), roughness: 0.3, transparent: true, opacity: 0 });
  const goccia = new Mesh(new SphereGeometry(0.05, 16, 12), matGoccia);
  goccia.scale.set(1, 1.35, 1);
  modello.riferimenti.uretra.add(goccia);

  // — Etichette HTML (decorative: il testo completo è nella descrizione accessibile) —
  const livello = document.createElement('div');
  livello.className = 'pelvi-etichette';
  livello.setAttribute('aria-hidden', 'true');
  host.appendChild(livello);
  const etichette = (Object.keys(ETICHETTE) as IdEtichetta[]).map((id) => {
    const el = document.createElement('span');
    el.className = `pelvi-etichetta pelvi-etichetta--${id}`;
    el.textContent = ETICHETTE[id];
    livello.appendChild(el);
    return { el, ancora: modello.ancore[id] as Object3D };
  });
  const etichettaPressione = document.createElement('span');
  etichettaPressione.className = 'pelvi-etichetta pelvi-etichetta--pressione';
  etichettaPressione.textContent = 'Pressione dell’addome';
  livello.appendChild(etichettaPressione);

  // Posiziona le etichette proiettando le ancore 3D sullo schermo; se due si sovrappongono,
  // la seconda sale sopra la prima (semplice, ma basta per 5–6 etichette).
  const v = new Vector3();
  const tutte = [
    ...etichette,
    { el: etichettaPressione, ancora: pressione.coda as Object3D },
  ];
  // Dimensioni delle etichette misurate una volta (e al resize): niente letture di layout a ogni fotogramma.
  let misure = new Map<HTMLElement, { w: number; h: number; visibile: boolean }>();
  const misuraEtichette = () => {
    misure = new Map(
      tutte.map(({ el }) => [el, { w: el.offsetWidth, h: el.offsetHeight, visibile: el.offsetParent !== null }]),
    );
  };
  misuraEtichette();
  document.fonts?.ready.then(misuraEtichette);

  const aggiornaEtichette = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    const piazzate: Array<{ x: number; y: number; w: number; h: number }> = [];
    const pos = tutte
      .filter(({ el }) => misure.get(el)?.visibile && el.style.opacity !== '0')
      .map(({ el, ancora }) => {
        ancora.getWorldPosition(v).project(camera);
        const m = misure.get(el)!;
        return { el, x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h, lw: m.w, lh: m.h };
      })
      .sort((a, b) => b.y - a.y);
    for (const p of pos) {
      let y = p.y;
      for (let tentativi = 0; tentativi < 6; tentativi++) {
        const urto = piazzate.find(
          (q) => Math.abs(q.x - p.x) < (q.w + p.lw) / 2 + 4 && Math.abs(q.y - y) < (q.h + p.lh) / 2 + 2,
        );
        if (!urto) break;
        y = urto.y - (urto.h + p.lh) / 2 - 3;
      }
      piazzate.push({ x: p.x, y, w: p.lw, h: p.lh });
      p.el.style.transform = `translate(${p.x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
  };

  // — Stato e transizioni —
  let attuale: ParametriStato = { ...statoPerId(STATO_INIZIALE).parametri };
  let da = attuale;
  let a = attuale;
  let progresso = 1;
  const DURATA = 1.1;

  const applicaVisivi = (p: ParametriStato, t: number) => {
    modello.applica(p);
    pressione.materiale.opacity = p.frecciaPressione;
    pressione.gruppo.visible = p.frecciaPressione > 0.01;
    pressione.gruppo.position.y = Math.sin(t * 3) * 0.04 * p.frecciaPressione;
    discesa.materiale.opacity = p.frecciaDiscesa;
    discesa.gruppo.visible = p.frecciaDiscesa > 0.01;
    for (const f of sostegno) {
      f.materiale.opacity = p.frecceSostegno;
      f.gruppo.visible = p.frecceSostegno > 0.01;
    }
    matGoccia.opacity = p.goccia * 0.9;
    goccia.visible = p.goccia > 0.01;
    goccia.position.y = -0.04 - ((t * 0.35) % 0.2) * p.goccia;
    etichettaPressione.style.opacity = String(p.frecciaPressione);
  };

  const vaiA = (id: IdStato) => {
    da = attuale;
    a = { ...statoPerId(id).parametri };
    progresso = 0;
    stage.sveglia(DURATA * 1000 + 300);
  };

  // — Vista: orbita con limiti e smorzamento —
  const vista = { ...VISTA_INIZIALE };
  const obiettivo = { ...VISTA_INIZIALE };
  const mobile = isMobile();
  let interagito = false;
  let fotogramma = 0;
  let trascina: { x: number; y: number; id: number; tipo: string } | null = null;

  // Su contenitori più stretti la camera si allontana, così il modello resta tutto inquadrato.
  let fattoreAspetto = 1;
  const calcolaFattore = () => {
    const aspetto = host.clientWidth / Math.max(host.clientHeight, 1);
    fattoreAspetto = Math.pow(Math.max(1, 1.25 / aspetto), 0.7) * (host.clientWidth < 520 ? 0.94 : 1);
  };
  calcolaFattore();

  const aggiornaCamera = () => {
    const cosE = Math.cos(vista.elevazione);
    const d = vista.distanza * fattoreAspetto;
    camera.position.set(
      BERSAGLIO.x + d * Math.sin(vista.azimut) * cosE,
      BERSAGLIO.y + d * Math.sin(vista.elevazione),
      BERSAGLIO.z + d * Math.cos(vista.azimut) * cosE,
    );
    camera.lookAt(BERSAGLIO);
  };

  stage.onFrame((dt, t) => {
    // oscillazione leggera all'inizio, finché la paziente non interagisce
    const oscillazione = interagito ? 0 : Math.sin(t * 0.5) * 0.18 * Math.min(t / 2, 1);
    const k = Math.min(dt * 6, 1);
    vista.azimut += (obiettivo.azimut + oscillazione - vista.azimut) * k;
    vista.elevazione += (obiettivo.elevazione - vista.elevazione) * k;
    vista.distanza += (obiettivo.distanza - vista.distanza) * k;
    aggiornaCamera();

    if (progresso < 1) {
      progresso = Math.min(progresso + dt / DURATA, 1);
      attuale = interpola(da, a, easeInOut(progresso));
    }
    applicaVisivi(attuale, t);
    aggiornaEtichette();

    // resta sveglio se c'è ancora qualcosa in movimento (frecce e goccia sono animate)
    const inMoto =
      !interagito ||
      progresso < 1 ||
      Math.abs(obiettivo.azimut - vista.azimut) > 0.001 ||
      Math.abs(obiettivo.elevazione - vista.elevazione) > 0.001 ||
      Math.abs(obiettivo.distanza - vista.distanza) > 0.002 ||
      attuale.frecciaPressione > 0.01 ||
      attuale.goccia > 0.01;
    if (inMoto) stage.sveglia(200);

    // Solo animazioni d'ambiente (frecce che oscillano, goccia): bastano 30 fps.
    const soloAmbiente =
      interagito &&
      progresso >= 1 &&
      !trascina &&
      Math.abs(obiettivo.azimut - vista.azimut) < 0.001 &&
      Math.abs(obiettivo.elevazione - vista.elevazione) < 0.001 &&
      Math.abs(obiettivo.distanza - vista.distanza) < 0.002;
    fotogramma++;
    return !soloAmbiente || fotogramma % 2 === 0;
  });

  // L’oscillazione iniziale dura al massimo 8 secondi (poi il ciclo si ferma se nulla si muove).
  const fineOscillazione = window.setTimeout(() => {
    interagito = true;
    stage.sveglia(1500);
  }, 8000);

  const interazione = () => {
    if (!interagito) {
      interagito = true;
      obiettivo.azimut = clamp(vista.azimut, LIMITI.azimut);
    }
    stage.sveglia(1500);
  };

  // Trascinamento (mouse/penna: entrambi gli assi; touch: solo orizzontale, il verticale scorre la pagina)
  const suGiu = (e: PointerEvent) => {
    if (e.button !== 0) return;
    trascina = { x: e.clientX, y: e.clientY, id: e.pointerId, tipo: e.pointerType };
    if (e.pointerType !== 'touch') host.setPointerCapture(e.pointerId);
    host.classList.add('is-trascinando');
  };
  const suMuovi = (e: PointerEvent) => {
    if (!trascina || e.pointerId !== trascina.id) return;
    const dx = e.clientX - trascina.x;
    const dy = e.clientY - trascina.y;
    trascina.x = e.clientX;
    trascina.y = e.clientY;
    interazione();
    obiettivo.azimut = clamp(obiettivo.azimut - dx * 0.007, LIMITI.azimut);
    if (trascina.tipo !== 'touch') obiettivo.elevazione = clamp(obiettivo.elevazione + dy * 0.005, LIMITI.elevazione);
  };
  const suSu = () => {
    trascina = null;
    host.classList.remove('is-trascinando');
  };
  host.addEventListener('pointerdown', suGiu);
  host.addEventListener('pointermove', suMuovi);
  host.addEventListener('pointerup', suSu);
  host.addEventListener('pointercancel', suSu);

  // Tastiera (il contenitore è focalizzabile)
  const zoom = (verso: 1 | -1) => {
    if (mobile) return; // niente zoom su mobile
    interazione();
    obiettivo.distanza = clamp(obiettivo.distanza - verso * 0.6, LIMITI.distanza);
  };
  const reimposta = () => {
    interazione();
    Object.assign(obiettivo, VISTA_INIZIALE);
  };
  const suTasto = (e: KeyboardEvent) => {
    const azioni: Record<string, () => void> = {
      ArrowLeft: () => (obiettivo.azimut = clamp(obiettivo.azimut + 0.18, LIMITI.azimut)),
      ArrowRight: () => (obiettivo.azimut = clamp(obiettivo.azimut - 0.18, LIMITI.azimut)),
      ArrowUp: () => (obiettivo.elevazione = clamp(obiettivo.elevazione + 0.1, LIMITI.elevazione)),
      ArrowDown: () => (obiettivo.elevazione = clamp(obiettivo.elevazione - 0.1, LIMITI.elevazione)),
      '+': () => zoom(1),
      '=': () => zoom(1),
      '-': () => zoom(-1),
      '0': reimposta,
      Home: reimposta,
    };
    const azione = azioni[e.key];
    if (!azione) return;
    e.preventDefault();
    interazione();
    azione();
  };
  host.addEventListener('keydown', suTasto);

  // Pulsanti della pagina (zoom, vista iniziale) e cambio di stato
  const suComando = (e: Event) => {
    const comando = (e as CustomEvent<string>).detail;
    if (comando === 'zoom+') zoom(1);
    else if (comando === 'zoom-') zoom(-1);
    else if (comando === 'reimposta') reimposta();
  };
  const suStato = (e: Event) => {
    const id = (e as CustomEvent<string>).detail;
    if (isIdStato(id)) vaiA(id);
  };
  radiceUi.addEventListener('pelvi:comando', suComando);
  radiceUi.addEventListener('pelvi:stato', suStato);

  const ro = new ResizeObserver(() => {
    calcolaFattore();
    misuraEtichette();
    stage.sveglia(300);
  });
  ro.observe(host);

  // Stato iniziale: quello già scelto nella pagina (es. arrivando da /#prolasso)
  const iniziale = radiceUi.dataset.stato;
  if (iniziale && isIdStato(iniziale)) {
    attuale = { ...statoPerId(iniziale).parametri };
    da = a = attuale;
  }
  aggiornaCamera();
  applicaVisivi(attuale, 0);
  await cedi();
  await stage.compila();
  aggiornaEtichette();
  stage.renderOnce();
  stage.sveglia(1000);

  return {
    dispose() {
      window.clearTimeout(fineOscillazione);
      ro.disconnect();
      radiceUi.removeEventListener('pelvi:comando', suComando);
      radiceUi.removeEventListener('pelvi:stato', suStato);
      host.removeEventListener('keydown', suTasto);
      host.removeEventListener('pointerdown', suGiu);
      host.removeEventListener('pointermove', suMuovi);
      host.removeEventListener('pointerup', suSu);
      host.removeEventListener('pointercancel', suSu);
      livello.remove();
      modello.dispose();
      stage.dispose();
    },
  };
}

export { STATI };
