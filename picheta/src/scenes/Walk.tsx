import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useLang } from '../i18n';
import { SITE } from '../config/site';
import { CHAPTERS, FINALE, OVERLAP, WALK_ANCHORS, type Keys, type Transition } from '../data/walk';
import { PHOTOS } from '../data/photos';
import { depthUrl } from '../data/depth';
import { WalkRenderer, type SceneDraw, type SceneTextures } from '../lib/walkRenderer';
import { webgl2Supported } from '../lib/depthRenderer';
import { listenMotion, motionTarget } from '../lib/motion';
import { scrollToId, useReducedMotion } from '../lib/hooks';
import { NAV_IDS } from '../lib/nav';
import { Arrow } from '../components/Arrow';
import { Picture } from '../components/Picture';
import { rich } from '../components/Title';

// ── Línea de tiempo (en "pasos de guion": 1 ≈ una pantalla de desplazamiento) ─────────────────────────────
const STARTS: number[] = [];
let acc = 0;
for (const c of CHAPTERS) {
  STARTS.push(acc);
  acc += c.weight;
}
const WALK_END = acc;
const TOTAL = acc + FINALE;
const LAST = CHAPTERS.length - 1;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (t: number) => t * t * (3 - 2 * t);
const keys = (k: Keys, t: number) => k.from + (k.to - k.from) * smooth(clamp01(t));
const band = (t: number, a: number, b: number, c: number, d: number) =>
  smooth(clamp01((t - a) / (b - a))) * (1 - smooth(clamp01((t - c) / (d - c))));

/** Tiempo local (0–1) de la cámara de un espacio, incluidos los solapes con el anterior y el siguiente. */
const localT = (i: number, u: number) => clamp01((u - ((STARTS[i] ?? 0) - OVERLAP / 2)) / ((CHAPTERS[i]?.weight ?? 1) + OVERLAP));

/** Qué se ve en la posición u: un espacio, o la transición entre dos. */
function at(u: number): { a: number; b: number; m: number } {
  for (let k = 1; k <= LAST; k++) {
    const s = STARTS[k] ?? 0;
    if (Math.abs(u - s) < OVERLAP / 2) return { a: k - 1, b: k, m: (u - (s - OVERLAP / 2)) / OVERLAP };
  }
  let i = 0;
  for (let k = 0; k <= LAST; k++) if (u >= (STARTS[k] ?? 0)) i = k;
  return { a: i, b: -1, m: 0 };
}

function transition(kind: Transition, m: number) {
  switch (kind) {
    case 'dark':
      return { mix: m < 0.5 ? 0 : 1, depth: false, fade: clamp01(1 - Math.abs(m - 0.5) * 2.4), flash: 0 };
    case 'light':
      return { mix: m < 0.5 ? 0 : 1, depth: false, fade: 0, flash: clamp01(1 - Math.abs(m - 0.5) * 2.2) * 0.94 };
    case 'depth':
      return { mix: m, depth: true, fade: 0, flash: 0 };
    default:
      return { mix: smooth(m), depth: false, fade: 0, flash: 0 };
  }
}

/** Encuadre "cover" con margen (para balanceo, mirada e inclinación), en uv de la foto. */
function coverMap(iw: number, ih: number, cw: number, ch: number, position: string, k: number): [number, number, number, number] {
  const [px = 50, py = 50] = position.split(/\s+/).map((v) => parseFloat(v));
  const imgAR = iw / ih;
  const canAR = cw / Math.max(1, ch);
  let sx = 1;
  let sy = 1;
  if (canAR > imgAR) sy = imgAR / canAR;
  else sx = canAR / imgAR;
  const ox = (1 - sx) * (px / 100);
  const oy = (1 - sy) * (py / 100);
  return [ox + (sx - sx / k) / 2, oy + (sy - sy / k) / 2, sx / k, sy / k];
}

/** URL de la foto para la textura: AVIF (con respaldo JPEG) al tamaño de la pantalla. */
function photoUrls(i: number, compact: boolean): [string, string] {
  const p = PHOTOS[CHAPTERS[i]!.photo];
  const want = compact ? 1600 : 2000;
  const avif = p.widths.filter((w) => w <= want).pop() ?? p.widths[p.widths.length - 1] ?? 1080;
  const jpg = p.jpeg[p.jpeg.length - 1] ?? 1080;
  return [`${p.base}-${avif}.avif`, `${p.base}-${jpg}.jpg`];
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () =>
      im.decode().then(
        () => res(im),
        () => res(im),
      );
    im.onerror = rej;
    im.src = src;
  });
}

let glOk: boolean | null = null;
const FORCED = typeof location !== 'undefined' && new URLSearchParams(location.search).get('gl') === 'force';

interface WalkProps {
  /** La portada ya se retiró: el recorrido aparece desde la oscuridad. */
  entered: boolean;
}

/**
 * EL RECORRIDO — la experiencia principal: una persona llega al centro, cruza una entrada discreta, camina por el
 * salón, se asoma al balcón, sale a la terraza, se sienta, ve caer la tarde y la noche, y se eleva sobre la ciudad.
 * Todo con las fotos reales de Picheta y su profundidad (WebGL2). Sin WebGL2 o con movimiento reducido, el mismo
 * relato como una secuencia de fotos a pantalla completa.
 */
export function Walk({ entered }: WalkProps) {
  const { t, lang } = useLang();
  const w = t.walk;
  const reduced = useReducedMotion();
  const [mode, setMode] = useState<'live' | 'static'>(() => {
    if (typeof window === 'undefined') return 'static';
    glOk ??= webgl2Supported();
    return glOk ? 'live' : 'static';
  });
  const live = mode === 'live' && !reduced;

  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const beatRefs = useRef<(HTMLDivElement | null)[]>([]);
  const entranceRef = useRef<HTMLDivElement>(null);
  const finaleRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef<HTMLAnchorElement>(null);
  const railRef = useRef<HTMLOListElement>(null);
  const noteRef = useRef<HTMLParagraphElement>(null);
  const anchorRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const enteredRef = useRef(entered);
  enteredRef.current = entered;

  useEffect(() => {
    if (!live) return;
    const section = sectionRef.current;
    const stage = stageRef.current;
    if (!section || !stage) return;
    listenMotion();
    const compact = matchMedia('(max-width: 760px)').matches;
    const unit = compact ? 0.9 : 1.05; // pantallas de desplazamiento por paso de guion

    let renderer: WalkRenderer;
    const canvas = document.createElement('canvas');
    canvas.className = 'walk__canvas';
    canvas.setAttribute('aria-hidden', 'true');
    try {
      renderer = new WalkRenderer(canvas, compact ? 12 : 22);
    } catch {
      setMode('static');
      return;
    }
    stage.prepend(canvas);

    // Escenas: se cargan las cercanas y se liberan las lejanas (memoria de GPU acotada).
    type Slot = { state: 'idle' | 'loading' | 'ready'; tex: SceneTextures | null };
    const slots: Slot[] = CHAPTERS.map(() => ({ state: 'idle', tex: null }));
    let maps: [number, number, number, number][] = CHAPTERS.map(() => [0, 0, 1, 1]);
    let disposed = false;
    const ensure = async (i: number) => {
      const s = slots[i];
      if (!s || s.state !== 'idle') return;
      s.state = 'loading';
      try {
        const [avif, jpg] = photoUrls(i, compact);
        const [img, depth] = await Promise.all([loadImage(avif).catch(() => loadImage(jpg)), loadImage(depthUrl(CHAPTERS[i]!.photo))]);
        if (disposed || s.state !== 'loading') return;
        s.tex = renderer.upload(img, depth);
        s.state = 'ready';
      } catch {
        s.state = 'idle';
      }
    };
    const release = (i: number) => {
      const s = slots[i];
      if (!s || s.state !== 'ready' || !s.tex) {
        if (s && s.state === 'loading') s.state = 'idle';
        return;
      }
      renderer.release(s.tex);
      s.tex = null;
      s.state = 'idle';
    };

    // Medidas: altura del recorrido, lienzo, encuadres y anclas de navegación.
    let vh = window.innerHeight;
    let quality = 1;
    const measure = () => {
      vh = window.innerHeight;
      section.style.height = `${Math.round(vh * (1 + TOTAL * unit))}px`;
      const cw = stage.clientWidth;
      const ch = stage.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, compact ? 1.15 : 1.3) * quality;
      renderer.resize(Math.max(2, Math.round(cw * dpr)), Math.max(2, Math.round(ch * dpr)));
      maps = CHAPTERS.map((c) => {
        const p = PHOTOS[c.photo];
        return coverMap(p.width, p.height, cw, ch, c.position, 1.12);
      });
      const span = section.offsetHeight - vh;
      for (const [anchor, chapter] of Object.entries(WALK_ANCHORS)) {
        const el = anchorRefs.current[anchor];
        const i = CHAPTERS.findIndex((c) => c.id === chapter);
        if (el && i >= 0) el.style.top = `${Math.round((((STARTS[i] ?? 0) + (i ? OVERLAP / 2 : 0)) / TOTAL) * span)}px`;
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    window.addEventListener('resize', measure);

    let near = false;
    const io = new IntersectionObserver(([e]) => (near = Boolean(e?.isIntersecting)), { rootMargin: '30% 0px' });
    io.observe(section);

    // Estado de la cámara "humana": avance con inercia, pasos, cabeza.
    let u = -1;
    let walking = 0;
    let phase = 0;
    let last = performance.now();
    let introAt = 0;
    const head = { x: 0, y: 0 };
    const shown: number[] = [];
    let activeRail = -1;
    const slow: number[] = [];
    let raf = 0;

    const setOpacity = (el: HTMLElement | null, key: number, o: number, lift = 22) => {
      if (!el) return;
      if (Math.abs((shown[key] ?? -1) - o) < 0.004) return;
      shown[key] = o;
      el.style.opacity = o.toFixed(3);
      el.style.transform = `translate3d(0, ${((1 - o) * lift).toFixed(1)}px, 0)`;
      el.style.visibility = o < 0.01 ? 'hidden' : 'visible';
    };

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      // Calidad adaptable (como en las fotos 2.5D): si los fotogramas tardan, menos resolución y pasos.
      if (near && !document.hidden && !FORCED) {
        slow.push(now - last);
        if (slow.length >= 30) {
          const median = [...slow].sort((a, b) => a - b)[15] ?? 0;
          slow.length = 0;
          if (median > 34) {
            if (quality > 0.6) {
              quality *= 0.8;
              renderer.steps = Math.max(8, Math.round(renderer.steps * 0.8));
              measure();
            } else {
              setMode('static');
              return;
            }
          }
        }
      }
      last = now;
      if (!near || document.hidden) return;

      if (enteredRef.current && !introAt) introAt = now;
      const intro = introAt ? smooth(clamp01((now - introAt) / 1400)) : 0;

      // Progreso del desplazamiento → posición en el guion, con inercia (la cámara tiene peso).
      const r = section.getBoundingClientRect();
      const span = Math.max(1, r.height - vh);
      const target = clamp01(-r.top / span) * TOTAL;
      if (u < 0) u = target;
      const prev = u;
      u += (target - u) * (1 - Math.pow(1 - 0.085, dt * 60));
      const du = Math.abs(u - prev);
      const speed = du / Math.max(dt, 1e-3);
      walking += (clamp01(speed / 0.55) - walking) * (1 - Math.pow(1 - 0.08, dt * 60));
      phase += du * 10 * Math.PI * 2; // ~10 pasos por pantalla recorrida

      const { a, b, m } = at(u);
      const dominant = b >= 0 && m > 0.5 ? b : a;
      const stepAmt = walking * (CHAPTERS[dominant]?.steps ?? 1);

      // Precarga: el espacio actual, el anterior y los dos siguientes; libera el resto.
      for (let i = 0; i <= LAST; i++) {
        if (i >= a - 1 && i <= a + 2) void ensure(i);
        else if (i < a - 2 || i > a + 3) release(i);
      }

      // Cabeza: ratón o giroscopio, más el balanceo de los pasos y la respiración en reposo.
      const mt = motionTarget();
      head.x += (mt.x - head.x) * (1 - Math.pow(1 - 0.06, dt * 60));
      head.y += (mt.y - head.y) * (1 - Math.pow(1 - 0.06, dt * 60));
      const time = now / 1000;
      const breathe = 1 - walking;
      const shared = {
        x: -head.x * 0.022 + Math.sin(phase / 2) * 0.0045 * stepAmt + Math.sin(time * 0.31) * 0.003 * breathe,
        y: -head.y * 0.013 + Math.abs(Math.sin(phase)) * -0.0065 * stepAmt + Math.sin(time * 0.47) * 0.0022 * breathe,
      };
      const roll = Math.sin(phase / 2) * 0.006 * stepAmt + Math.sin(time * 0.23) * 0.0012 * breathe;

      const draw = (i: number): SceneDraw | null => {
        const s = slots[i];
        const c = CHAPTERS[i];
        if (!s?.tex || !c) return null;
        const tt = localT(i, u);
        return {
          textures: s.tex,
          map: maps[i] ?? [0, 0, 1, 1],
          offset: [keys(c.lookX, tt) + shared.x, keys(c.lookY, tt) + shared.y],
          dolly: keys(c.dolly, tt),
          focus: c.focus,
          center: c.center,
          curve: c.curve,
          sparkle: c.sparkle,
        };
      };

      const tr = b >= 0 ? transition(CHAPTERS[a]!.next, m) : { mix: 0, depth: false, fade: 0, flash: 0 };
      const sceneA = draw(a);
      const sceneB = b >= 0 ? draw(b) : null;
      const pending = (!sceneA && tr.mix < 1) || (b >= 0 && !sceneB && tr.mix > 0);
      renderer.render({
        a: sceneA,
        b: sceneB,
        mix: tr.mix,
        depthMix: tr.depth,
        roll,
        fade: Math.max(tr.fade, 1 - intro, pending ? 1 : 0),
        flash: tr.flash,
        time,
      });

      // Textos: cada espacio dice lo suyo mientras se camina por él.
      for (let i = 0; i <= LAST; i++) {
        const tt = localT(i, u);
        // La llegada se lee desde el primer instante; el resto aparece al caminar por su espacio.
        const o = i === 0 ? band(tt, -1, 0, 0.62, 0.78) : i === LAST ? band(tt, 0.12, 0.24, 0.62, 0.74) : band(tt, 0.16, 0.28, 0.66, 0.8);
        setOpacity(beatRefs.current[i] ?? null, i, o * intro);
      }
      setOpacity(entranceRef.current, 100, b === 1 ? clamp01((tr.fade - 0.55) / 0.35) : 0, 10);
      const fin = smooth(clamp01((u - WALK_END - 0.05) / 0.35));
      setOpacity(finaleRef.current, 101, fin, 26);
      if (finaleRef.current) finaleRef.current.style.pointerEvents = fin > 0.5 ? 'auto' : 'none';
      setOpacity(hintRef.current, 102, intro * (1 - smooth(clamp01(u / 0.18))), 0);
      // "Saltar" aparece cuando ya se camina (no compite con la invitación a caminar).
      setOpacity(skipRef.current, 103, intro * (1 - fin) * smooth(clamp01((u - 0.14) / 0.16)), 0);
      setOpacity(railRef.current, 104, intro, 0);
      setOpacity(noteRef.current, 105, intro * (1 - fin), 0);

      const railIdx = u >= WALK_END ? LAST : dominant;
      if (railIdx !== activeRail && railRef.current) {
        activeRail = railIdx;
        railRef.current.querySelectorAll('li').forEach((li, i) => li.toggleAttribute('data-active', i === railIdx));
      }
    };
    frame();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('resize', measure);
      section.style.removeProperty('height');
      renderer.dispose();
      canvas.remove();
    };
  }, [live]);

  const goChapter = (i: number) => {
    const section = sectionRef.current;
    if (!section) return;
    const span = section.offsetHeight - window.innerHeight;
    const u = (STARTS[i] ?? 0) + (i ? OVERLAP / 2 + 0.05 : 0);
    window.scrollTo({ top: section.offsetTop + (u / TOTAL) * span, behavior: reduced ? 'auto' : 'smooth' });
  };

  const finale = (
    <div className="walk__finale-inner">
      <h2 className="display walk__finale-title">
        <span className="visually-hidden">{w.finale.title.map((l) => l.replace(/\*/g, '')).join(' ')}</span>
        {w.finale.title.map((l, i) => (
          <span key={i} className="walk__line" aria-hidden="true">
            {rich(l)}
          </span>
        ))}
      </h2>
      <div className="walk__finale-actions">
        <a className="btn btn--solid btn--lg" href={SITE.reservations.url} target="_blank" rel="noopener">
          <span>{w.finale.primary}</span>
          <Arrow />
          <span className="visually-hidden"> {t.common.newTab}</span>
        </a>
        <a
          className="btn btn--ghost btn--lg"
          href={`#${NAV_IDS.place}`}
          onClick={(e) => {
            e.preventDefault();
            scrollToId(NAV_IDS.place, true);
          }}
        >
          <span>{w.finale.secondary}</span>
        </a>
      </div>
      <p className="walk__finale-note">{w.finale.note}</p>
    </div>
  );

  const beatContent = (i: number) => {
    const beat = w.beats[i];
    if (!beat) return null;
    return (
      <>
        <p className="label walk__kicker">
          <span className="walk__kicker-n">0{i + 1}</span>
          <span className="walk__kicker-rule" />
          {beat.kicker}
        </p>
        <h2 className="display walk__title">
          <span className="visually-hidden">{beat.title.map((l) => l.replace(/\*/g, '')).join(' ')}</span>
          {beat.title.map((l, k) => (
            <span key={k} className="walk__line" aria-hidden="true">
              {rich(l)}
            </span>
          ))}
        </h2>
        {beat.sub && <p className="walk__sub">{beat.sub}</p>}
        {beat.quote && (
          <figure className="walk__quote">
            <blockquote>“{beat.quote}”</blockquote>
            <figcaption className="label">— {beat.source}</figcaption>
          </figure>
        )}
        <p className="visually-hidden">{PHOTOS[CHAPTERS[i]!.photo].alt[lang]}</p>
      </>
    );
  };

  // ── Sin WebGL2 o con movimiento reducido: el mismo relato, foto a foto ───────────────────────────────────
  if (!live) {
    return (
      <section ref={sectionRef} className="walk walk--static" data-theme="dark" aria-label={w.label}>
        {CHAPTERS.map((c, i) => (
          <div key={c.id}>
            {i === 1 && (
              <div className="walk__still walk__still--dark">
                <p className="walk__entrance-line">{w.entrance.line}</p>
                <p className="walk__entrance-sub">{w.entrance.sub}</p>
              </div>
            )}
            <article
              className="walk__still"
              id={Object.entries(WALK_ANCHORS).find(([, ch]) => ch === c.id)?.[0]}
              aria-label={w.beats[i]?.kicker}
            >
              <Picture id={c.photo} sizes="100vw" className="walk__still-img" position={c.position} decorative />
              <div className="walk__beat walk__beat--static">{beatContent(i)}</div>
            </article>
          </div>
        ))}
        <div className="walk__still walk__still--finale">{finale}</div>
      </section>
    );
  }

  return (
    <section ref={sectionRef} className="walk" data-theme="dark" aria-label={w.label}>
      {Object.keys(WALK_ANCHORS).map((anchor) => (
        <span
          key={anchor}
          id={anchor}
          className="walk__anchor"
          ref={(el) => {
            anchorRefs.current[anchor] = el;
          }}
        />
      ))}
      <div ref={stageRef} className="walk__stage">
        {CHAPTERS.map((c, i) => (
          <div
            key={c.id}
            className={`walk__beat ${i === LAST ? 'walk__beat--high' : ''}`}
            ref={(el) => {
              beatRefs.current[i] = el;
            }}
            style={{ opacity: 0, visibility: 'hidden' } as CSSProperties}
          >
            {beatContent(i)}
          </div>
        ))}

        <div ref={entranceRef} className="walk__entrance" style={{ opacity: 0, visibility: 'hidden' }}>
          <p className="walk__entrance-line">{w.entrance.line}</p>
          <p className="walk__entrance-sub">{w.entrance.sub}</p>
        </div>

        <div ref={finaleRef} className="walk__finale" style={{ opacity: 0, visibility: 'hidden', pointerEvents: 'none' }}>
          {finale}
        </div>

        <ol ref={railRef} className="walk__rail" aria-label={w.label} style={{ opacity: 0 }}>
          {w.rail.map((label, i) => (
            <li key={label}>
              <button type="button" onClick={() => goChapter(i)}>
                <span className="walk__rail-dot" aria-hidden="true" />
                <span className="walk__rail-label">{label}</span>
              </button>
            </li>
          ))}
        </ol>

        <div ref={hintRef} className="walk__hint label" aria-hidden="true" style={{ opacity: 0 }}>
          <span className="walk__hint-icon" />
          <span className="hint--pointer">{w.hint.pointer}</span>
          <span className="hint--touch">{w.hint.touch}</span>
        </div>

        <a
          ref={skipRef}
          className="walk__skip label"
          href={`#${NAV_IDS.gastronomy}`}
          style={{ opacity: 0 }}
          onClick={(e) => {
            e.preventDefault();
            scrollToId(NAV_IDS.gastronomy, reduced);
          }}
        >
          {w.skip} ↓
        </a>
        <p ref={noteRef} className="walk__note" aria-hidden="true" style={{ opacity: 0 }}>
          {w.photoNote}
        </p>
      </div>
    </section>
  );
}
