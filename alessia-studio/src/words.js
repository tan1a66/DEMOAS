import * as THREE from 'three';
import { GLSL_COMMON } from './materials.js';
import { FOG_GLSL } from './water-glsl.js';
import { WORD_SIZE } from './camera-path.js';

// Sott'acqua, i servizi: ogni servizio è un testo grande che galleggia nell'acqua. Un piano con il
// testo disegnato in una texture (numero, titolo in Syne verde, una riga di dettaglio) che ondeggia
// appena, tremola come visto attraverso l'acqua e se ne vela con la distanza: dalla sosta di un
// testo si intravede dietro il successivo, sbiadito. Un tocco lo fa increspare.
// Due formati di texture: orizzontale (schermi larghi) e verticale (telefoni).

const GREEN = '#B8F03A', IVORY = '#FFF6F2';
const TEX = { land: [2048, 1152], port: [1440, 1800] };

// testo su più righe che sta in larghezza: riduce il corpo finché la riga più lunga entra
function fit(ctx, lines, font, size, maxW) {
  for (let s = size; s > 8; s *= 0.94) {
    ctx.font = font(s);
    if (Math.max(...lines.map((l) => ctx.measureText(l).width)) <= maxW) return s;
  }
  return 8;
}

// parole di una riga lunga, a capo entro maxW
function wrap(ctx, text, maxW) {
  const out = [];
  let line = '';
  for (const w of text.split(' ')) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) {
      out.push(line);
      line = w;
    } else line = t;
  }
  if (line) out.push(line);
  return out;
}

function spaced(ctx, px) {
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`;
}

function draw(canvas, layout, item, i, n) {
  const [W, H] = TEX[layout];
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const port = layout === 'port';
  const cx = W / 2;
  // alone scuro morbido: il testo resta leggibile anche sui raggi di luce
  ctx.shadowColor = 'rgba(8, 34, 44, 0.55)';
  ctx.shadowBlur = H * 0.04;

  // misure: numero, titolo (in verde, su più righe) e dettaglio, tutto centrato in altezza
  const kSize = H * (port ? 0.026 : 0.034);
  const tl = item.title.split('\n');
  const tFont = (s) => `800 ${s}px Syne, 'Helvetica Neue', Arial, sans-serif`;
  const tSize = fit(ctx, tl, tFont, H * (port ? 0.15 : 0.22), W * 0.9);
  const dSize = H * (port ? 0.032 : 0.044);
  ctx.font = `500 ${dSize}px Inter, sans-serif`;
  const dl = wrap(ctx, item.lines, W * 0.86);
  const gap = tSize * 0.5 + dSize * 1.1; // dalla base dell'ultima riga del titolo a quella del dettaglio
  const block = kSize + tSize * 1.12 + tSize * 0.98 * (tl.length - 1) + gap + dSize * 1.45 * (dl.length - 1);
  let y = (H - block) / 2 + kSize;

  // numero (01 / 02)
  const nn = (k) => String(k).padStart(2, '0');
  ctx.font = `600 ${kSize}px Inter, sans-serif`;
  spaced(ctx, kSize * 0.3);
  ctx.fillStyle = IVORY;
  ctx.fillText(`${nn(i + 1)} / ${nn(n)}`, cx, y);
  spaced(ctx, 0);

  // titolo
  ctx.font = tFont(tSize);
  spaced(ctx, -tSize * 0.035);
  ctx.fillStyle = GREEN;
  y += tSize * 1.12;
  for (const l of tl) {
    ctx.fillText(l, cx, y);
    y += tSize * 0.98;
  }
  spaced(ctx, 0);

  // dettaglio
  ctx.font = `500 ${dSize}px Inter, sans-serif`;
  ctx.fillStyle = IVORY;
  y += gap - tSize * 0.98;
  for (const l of dl) {
    ctx.fillText(l, cx, y);
    y += dSize * 1.45;
  }
}

export function createWords(shared, { positions, items, quality }) {
  const group = new THREE.Group();
  let layout = 'land';
  const geo = new THREE.PlaneGeometry(1, 1, 40, 24);
  geo.rotateY(Math.PI / 2); // il piano guarda verso +x, da dove arriva la telecamera
  const meshes = positions.map((P, i) => {
    const canvas = document.createElement('canvas');
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = quality.tier === 'low' ? 2 : 8;
    const uniforms = { ...shared, uMap: { value: tex }, uHover: { value: 0 }, uPoke: { value: 0 }, uSeed: { value: i * 2.3 }, uVis: { value: 1 } };
    const mat = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform float uSeed;
        uniform float uPoke;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec3 p = position;
          // il testo galleggia: un'onda lenta lo piega appena (più forte quando lo si tocca)
          float w = sin(p.z * 1.6 + uTime * 0.7 + uSeed) * 0.035 + sin(p.y * 2.2 - uTime * 0.9 + uSeed) * 0.02;
          w += sin(length(p.yz) * 7.0 - uTime * 6.0) * 0.03 * uPoke;
          p.x += w;
          vec4 wp = modelMatrix * vec4(p, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D uMap;
        uniform float uTime;
        uniform float uExposure;
        uniform float uHover;
        uniform float uPoke;
        uniform float uSeed;
        uniform float uVis;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        ${GLSL_COMMON}
        ${FOG_GLSL}
        void main() {
          // tremolio dell'acqua: le lettere si increspano appena, come viste attraverso il mare
          float k = 0.0016 + 0.0016 * uHover + 0.004 * uPoke;
          vec2 uv = vUv + k * vec2(sin(vUv.y * 38.0 + uTime * 1.7 + uSeed), cos(vUv.x * 30.0 + uTime * 1.3 + uSeed));
          vec4 t = texture2D(uMap, uv);
          if (t.a < 0.004) discard;
          vec3 col = t.rgb * (1.0 + 0.12 * uHover);
          vec3 V = normalize(cameraPosition - vWorldPos);
          float dist = length(cameraPosition - vWorldPos);
          float f = waterFog(dist, -vWorldPos.y);
          col = mix(waterColor(-V), col, f);
          gl_FragColor = vec4(softClip(col * uExposure), t.a * uVis * smoothstep(0.08, 0.6, f));
          #include <colorspace_fragment>
        }
      `,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(P);
    mesh.renderOrder = 9;
    mesh.userData = { canvas, tex, base: P };
    group.add(mesh);
    return mesh;
  });

  let texts = null;
  function redraw() {
    if (!texts) return;
    meshes.forEach((m, i) => {
      draw(m.userData.canvas, layout, texts[i], i, meshes.length);
      m.userData.tex.needsUpdate = true;
      const [w, h] = WORD_SIZE[layout];
      m.scale.set(1, h, w); // il piano (ruotato) ha larghezza lungo z e altezza lungo y
    });
  }

  // testi nella lingua scelta ([{ title, lines }])
  async function setTexts(list) {
    texts = list;
    redraw();
    // ridisegna quando i font del sito sono pronti (Syne per il titolo, Inter per il resto)
    try {
      await Promise.all(['800 100px Syne', '500 40px Inter', '600 40px Inter'].map((f) => document.fonts.load(f)));
      redraw();
    } catch (e) {
      /* font non disponibili: resta il disegno con i font di sistema */
    }
  }

  function setLayout(l) {
    if (l === layout) return;
    layout = l;
    redraw();
  }

  // i testi lontani (i successivi, dietro) restano una velatura: si accendono avvicinandosi, così non
  // si sovrappongono a quello che si sta leggendo
  function update(time, focusIndex, dt, camPos) {
    meshes.forEach((m, i) => {
      const d = camPos ? m.userData.base.distanceTo(camPos) : 0;
      m.material.uniforms.uVis.value = THREE.MathUtils.lerp(0.16, 1, 1 - THREE.MathUtils.smoothstep(d, 8.5, 12.5));
      const b = m.userData.base;
      // galleggia: sale e scende piano
      m.position.set(b.x, b.y + Math.sin(time * 0.5 + i * 1.7) * 0.08, b.z);
      const u = m.material.uniforms;
      u.uHover.value += ((i === focusIndex ? 1 : 0) - u.uHover.value) * (1 - Math.exp(-dt * 6));
      u.uPoke.value *= Math.exp(-dt * 1.8);
    });
  }

  // un tocco vicino fa increspare il testo
  function poke(at) {
    meshes.forEach((m) => {
      if (m.position.distanceTo(at) < 3.5) m.material.uniforms.uPoke.value = 1;
    });
  }

  setTexts(items);
  return { group, meshes, update, poke, setTexts, setLayout };
}
