// =============================================================================
//  titles3d.js — i titoli che giocano con la statua
// =============================================================================
//  Le parole dei titoli dei capitoli diventano piccoli piani nella scena.
//  Con lo scroll partono DIETRO la statua (lei le copre), la attraversano e
//  arrivano DAVANTI, esattamente al posto del titolo nella colonna di testo.
//
//  - Il titolo HTML resta nella pagina (impaginazione, lettori di schermo) ma
//    invisibile; ogni parola viene ridisegnata su un canvas con lo stesso
//    carattere, colore e posizione.
//  - Le parole sono disegnate dopo sfocatura e raggi (post.js): sempre nitide.
//    L'occlusione la fanno leggendo la profondità della scena: dove la statua
//    è più vicina la parola sparisce; "davanti" = quell'occlusione si spegne.
//  - I tempi sono in config.js (TITLE_FLIGHTS), in punti dello scroll.

import * as THREE from 'three';
import { resolveAnchor, gsap } from '../core/scroll.js';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
uniform sampler2D map;
uniform sampler2D tDepth;
uniform vec2 uRes;
uniform float uOpacity;
uniform float uFront; // 0 = dietro (la scena la copre), 1 = davanti a tutto
varying vec2 vUv;
void main() {
  vec4 c = texture2D(map, vUv);
  float scene = texture2D(tDepth, gl_FragCoord.xy / uRes).x;
  float hidden = step(scene + 0.000002, gl_FragCoord.z);
  float a = c.a * uOpacity * mix(1.0, uFront, hidden);
  if (a < 0.003) discard;
  gl_FragColor = vec4(c.rgb, a);
  #include <colorspace_fragment>
}`;

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smoothstep = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
// numeri "casuali" ma fissi per ogni parola: ogni parola ha il suo volo
const hash = (i, k) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Una parola del titolo HTML → canvas con la stessa tipografia */
function drawWord(w, dpr) {
  const wi = w.querySelector('.wi');
  const cs = getComputedStyle(wi);
  const ws = getComputedStyle(w);
  const fontSize = parseFloat(cs.fontSize);
  const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const text = wi.textContent;
  const pad = Math.ceil(fontSize * 0.3);
  const padL = parseFloat(ws.paddingLeft), padT = parseFloat(ws.paddingTop);
  const padR = parseFloat(ws.paddingRight), padB = parseFloat(ws.paddingBottom);

  const probe = document.createElement('canvas').getContext('2d');
  probe.font = font;
  const m = probe.measureText(text);
  const ascent = m.fontBoundingBoxAscent ?? fontSize * 0.8;
  const descent = m.fontBoundingBoxDescent ?? fontSize * 0.25;
  const lineHeight = parseFloat(cs.lineHeight) || fontSize * 1.1;
  const boxW = Math.max(m.width, w.offsetWidth - padL - padR);
  const boxH = w.offsetHeight - padT - padB;
  const baseline = (lineHeight - (ascent + descent)) / 2 + ascent;

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil((boxW + pad * 2) * dpr);
  canvas.height = Math.ceil((boxH + pad * 2) * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.font = font;
  ctx.fillStyle = cs.color;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, pad, pad + baseline);
  return { canvas, pad, padL, padT, boxW, boxH, key: `${font}|${cs.color}|${text}|${dpr}` };
}

export function createTitles3D({ flights, depthTexture }) {
  const scene = new THREE.Scene();
  const titles = []; // { layer, words: [{ el, mesh, mat, rect, ... }], anchors }
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const res = new THREE.Vector2(1, 1);
  const tmp = new THREE.Vector3();
  const statueNdc = new THREE.Vector3();
  const qCam = new THREE.Quaternion();
  const qTilt = new THREE.Quaternion();
  const zAxis = new THREE.Vector3(0, 0, 1);
  let fade = 1; // si spengono mentre la camera è nell'acqua
  let snapNext = false; // dopo un salto: niente rincorsa, subito al punto giusto

  function makeMaterial(texture) {
    return new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        map: { value: texture },
        tDepth: { value: depthTexture },
        uRes: { value: res },
        uOpacity: { value: 0 },
        uFront: { value: 0 },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
  }

  /** (Ri)costruisce le parole: all'avvio, al cambio lingua o di dimensione */
  function build() {
    for (const [id, f] of Object.entries(flights)) {
      const layer = document.querySelector(`.layer[data-layer="${id}"]`);
      const title = layer?.querySelector('.title');
      if (!title) continue;
      title.classList.add('is-3d');
      let t = titles.find((x) => x.id === id);
      if (!t) {
        t = { id, layer, title, f, words: [], p: 0, o: 0 };
        titles.push(t);
      }
      const els = [...title.querySelectorAll('.w')];
      // parole nuove o cambiate: nuova texture
      els.forEach((el, i) => {
        const d = drawWord(el, dpr);
        let w = t.words[i];
        if (!w) {
          const mat = makeMaterial(null);
          const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
          mesh.frustumCulled = false;
          mesh.renderOrder = 100 + i;
          scene.add(mesh);
          w = t.words[i] = { mesh, mat, tex: null, key: '' };
        }
        if (w.key !== d.key) {
          // parola o dimensione cambiata: texture nuova (le misure cambiano)
          w.tex?.dispose();
          w.tex = new THREE.CanvasTexture(d.canvas);
          w.tex.colorSpace = THREE.SRGBColorSpace;
          w.tex.generateMipmaps = false;
          w.tex.minFilter = THREE.LinearFilter;
          w.mat.uniforms.map.value = w.tex;
          w.key = d.key;
        }
        Object.assign(w, { el, pad: d.pad, padL: d.padL, padT: d.padT, boxW: d.boxW, boxH: d.boxH, i });
      });
      // parole in più (titolo più corto nell'altra lingua): via
      t.words.splice(els.length).forEach((w) => {
        scene.remove(w.mesh);
        w.mat.dispose();
        w.tex?.dispose();
        w.mesh.geometry.dispose();
      });
    }
    layout();
  }

  /** Posizioni dei titoli sullo schermo e punti dello scroll */
  function layout() {
    for (const t of titles) {
      // il livello quando è nascosto è spostato di qualche pixel (text.js)
      const ty = Number(gsap.getProperty(t.layer, 'y')) || 0;
      for (const w of t.words) {
        const r = w.el.getBoundingClientRect();
        // rettangolo del piano in pixel (con il margine del canvas)
        w.x = r.left + w.padL - w.pad;
        w.y = r.top + w.padT - w.pad - ty;
        w.w = w.boxW + w.pad * 2;
        w.h = w.boxH + w.pad * 2;
      }
      const in0 = resolveAnchor(t.f.in[0]), in1 = resolveAnchor(t.f.in[1]);
      // capitolo in un'altra pagina: il titolo resta spento
      t.off = in0 === null || in1 === null;
      const out0 = t.f.out ? resolveAnchor(t.f.out[0]) : null;
      const out1 = t.f.out ? resolveAnchor(t.f.out[1]) : null;
      t.a = {
        in0: in0 ?? 0,
        in1: Math.max((in1 ?? 1), (in0 ?? 0) + 1e-4),
        out0: out0 ?? 2,
        out1: Math.max(out1 ?? 3, (out0 ?? 2) + 1e-4),
      };
    }
  }

  /**
   * Per frame, dopo il drone.
   * scroll: frazione 0..1; focus: distanza camera → punto guardato;
   * statue: centro della statua (mondo); hidden: true per spegnerle
   */
  function update({ scroll, dt, camera, focus, statue, viewport, drawingBuffer, hidden = false }) {
    res.copy(drawingBuffer);
    fade += ((hidden ? 0 : 1) - fade) * (1 - Math.exp(-9 * Math.min(dt, 0.1)));
    camera.updateMatrixWorld();
    qCam.copy(camera.quaternion);
    const P = camera.projectionMatrix.elements;
    // dove sta la statua sullo schermo e quanto è larga
    statueNdc.copy(statue).project(camera);
    const sr = (0.42 * P[0]) / Math.max(focus, 0.5);
    const depth = focus + 0.8; // il piano sta appena dietro di lei
    let any = false;

    const k = snapNext ? 1 : 1 - Math.exp(-10 * Math.min(dt, 0.1));
    snapNext = false;
    for (const t of titles) {
      const pIn = clamp01((scroll - t.a.in0) / (t.a.in1 - t.a.in0));
      const pOut = clamp01((scroll - t.a.out0) / (t.a.out1 - t.a.out0));
      t.p += (pIn - t.p) * k;
      t.o += (pOut - t.o) * k;
      const n = t.words.length;
      const st = n > 1 ? Math.min(0.15, 0.5 / (n - 1)) : 0;
      const span = 1 - st * (n - 1);
      const W = viewport.x, H = viewport.y;
      // il titolo vola come una frase: tutte le parole partono insieme dietro
      // di lei (con le stesse distanze tra loro) e arrivano una dopo l'altra,
      // così non si sovrappongono mai durante il volo
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const w of t.words) {
        w.sx = ((w.x + w.w / 2) / W) * 2 - 1;
        w.sy = 1 - ((w.y + w.h / 2) / H) * 2;
        w.nw = (w.w / W) * 2;
        w.nh = (w.h / H) * 2;
        minX = Math.min(minX, w.sx - w.nw / 2);
        maxX = Math.max(maxX, w.sx + w.nw / 2);
        minY = Math.min(minY, w.sy);
        maxY = Math.max(maxY, w.sy);
      }
      const gcx = (minX + maxX) / 2, gcy = (minY + maxY) / 2;
      // parte dalla parte opposta al posto finale, oltre la statua
      const side = Math.abs(gcx - statueNdc.x) > 0.25 ? -Math.sign(gcx - statueNdc.x) : 1;
      const dxG = side > 0 ? statueNdc.x + sr * 1.25 + 0.05 - minX : statueNdc.x - sr * 1.25 - 0.05 - maxX;
      const dyG = (statueNdc.y - gcy) * 0.85;
      for (const w of t.words) {
        if (t.off) {
          w.mesh.visible = false;
          continue;
        }
        const q = clamp01((t.p - w.i * st) / span);
        const o = clamp01((t.o - (n - 1 - w.i) * st * 0.5) / (1 - st * 0.5 * (n - 1)));
        const opacity = smoothstep(0, 0.12, q) * (1 - easeOut(o)) * fade;
        w.mesh.visible = opacity > 0.003;
        if (!w.mesh.visible) continue;
        any = true;

        const sx = w.sx, sy = w.sy, nw = w.nw, nh = w.nh;
        const x0 = sx + dxG + (hash(w.i, 1) - 0.5) * 0.03;
        const y0 = sy + dyG;
        const ex = easeInOut(clamp01(q / 0.9));
        // in verticale la frase scende tutta insieme (le righe non si incrociano);
        // in orizzontale le parole arrivano una dopo l'altra
        const ey = smoothstep(0.22, 0.96, t.p);
        let x = x0 + (sx - x0) * ex;
        let y = y0 + (sy - y0) * ey + Math.sin(Math.PI * q) * 0.025 * (hash(w.i, 3) - 0.3);
        y += easeOut(o) * 0.05; // uscita: salgono appena mentre svaniscono
        const scale = 0.84 + 0.16 * smoothstep(0.45, 1, q);
        const tilt = (1 - easeOut(q)) * (hash(w.i, 4) - 0.5) * 0.3;

        // NDC + profondità → spazio camera (tiene conto dello spostamento dell'inquadratura)
        tmp.set(x, y, 0.5).applyMatrix4(camera.projectionMatrixInverse);
        tmp.multiplyScalar(-depth / tmp.z);
        w.mesh.position.copy(camera.localToWorld(tmp));
        w.mesh.quaternion.copy(qCam).multiply(qTilt.setFromAxisAngle(zAxis, tilt));
        w.mesh.scale.set(((nw * depth) / P[0]) * scale, ((nh * depth) / P[5]) * scale, 1);
        w.mat.uniforms.uOpacity.value = opacity;
        w.mat.uniforms.uFront.value = smoothstep(0.56, 0.88, q);
      }
    }
    return any;
  }

  return {
    scene,
    build,
    layout,
    update,
    titles,
    snap() {
      snapNext = true;
    },
  };
}
