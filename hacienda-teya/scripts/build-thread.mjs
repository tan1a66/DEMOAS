// ─────────────────────────────────────────────────────────────────────────────
//  build-thread.mjs — genera src/data/thread-paths.json
//
//  Converte "Hacienda Teya" (Great Vibes, Google Fonts) nella LINEA CENTRALE
//  delle lettere, nell'ordine in cui le scriverebbe una mano. Il risultato è il
//  percorso che il filo di henequén segue nell'apertura.
//
//  Perché non usare direttamente i tracciati del font? opentype.js restituisce
//  il CONTORNO di ogni lettera (forme chiuse e piene): un tubo su quel contorno
//  disegnerebbe lettere "vuote", a doppia linea. Qui invece:
//    1. opentype.js → tracciati vettoriali del testo
//    2. rasterizzazione ad alta risoluzione (riempimento non-zero)
//    3. assottigliamento Zhang-Suen → scheletro di 1 pixel
//    4. grafo (estremi, incroci) → percorso "a mano": da sinistra a destra,
//       agli incroci prosegue dritto, salti minimi tra tratti staccati
//    5. smoothing + ricampionamento → coordinate in em (y verso l'alto)
//
//  Si esegue una sola volta (npm run thread): il browser legge solo il JSON.
//  Opzione --debug: salva le immagini di controllo nella cartella indicata.
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import opentype from 'opentype.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const FONT_FILE = path.join(ROOT, 'fonts/GreatVibes-latin.woff');
const OUT_FILE = path.join(ROOT, 'src/data/thread-paths.json');
const debugIdx = process.argv.indexOf('--debug');
const DEBUG_DIR = debugIdx > 0 ? process.argv[debugIdx + 1] : null;

const SIZE = 560; // dimensione del font in pixel per la rasterizzazione (più alto = più preciso)
const PAD = 60; // margine attorno al testo nella bitmap

// Le impaginazioni: il nome su una riga (desktop) e su due (mobile), più le
// parole cucite delle sezioni.
// dx/dy in em, relativi all'inizio della prima riga.
const LAYOUTS = {
  wide: [{ text: 'Hacienda Teya', dx: 0, dy: 0 }],
  tall: [
    { text: 'Hacienda', dx: 0, dy: 0 },
    { text: 'Teya', dx: 1.05, dy: 0.84 },
  ],
  // parole "cucite" nelle sezioni (titoli di Eventos e Trova)
  bodas: [{ text: 'Bodas', dx: 0, dy: 0 }],
  corporativos: [{ text: 'Corporativos', dx: 0, dy: 0 }],
  familiares: [{ text: 'Familiares', dx: 0, dy: 0 }],
  trova: [{ text: 'Trova', dx: 0, dy: 0 }],
};

// ── 1. Font → comandi vettoriali ─────────────────────────────────────────────
const buf = fs.readFileSync(FONT_FILE);
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

function layoutCommands(lines) {
  const cmds = [];
  for (const l of lines) {
    const p = font.getPath(l.text, l.dx * SIZE, l.dy * SIZE, SIZE, { kerning: true });
    cmds.push(...p.commands);
  }
  return cmds;
}

// ── 2. Rasterizzazione (scanline, regola non-zero) ───────────────────────────
function flatten(cmds) {
  const contours = [];
  let cur = null;
  let px = 0;
  let py = 0;
  const steps = 16;
  for (const c of cmds) {
    if (c.type === 'M') {
      cur = [[c.x, c.y]];
      contours.push(cur);
      px = c.x;
      py = c.y;
    } else if (c.type === 'L') {
      cur.push([c.x, c.y]);
      px = c.x;
      py = c.y;
    } else if (c.type === 'Q') {
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const a = (1 - t) * (1 - t);
        const b = 2 * (1 - t) * t;
        const d = t * t;
        cur.push([a * px + b * c.x1 + d * c.x, a * py + b * c.y1 + d * c.y]);
      }
      px = c.x;
      py = c.y;
    } else if (c.type === 'C') {
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const a = (1 - t) ** 3;
        const b = 3 * (1 - t) ** 2 * t;
        const e = 3 * (1 - t) * t * t;
        const d = t ** 3;
        cur.push([
          a * px + b * c.x1 + e * c.x2 + d * c.x,
          a * py + b * c.y1 + e * c.y2 + d * c.y,
        ]);
      }
      px = c.x;
      py = c.y;
    }
  }
  return contours;
}

function rasterize(cmds) {
  const contours = flatten(cmds);
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const c of contours)
    for (const [x, y] of c) {
      x1 = Math.min(x1, x);
      y1 = Math.min(y1, y);
      x2 = Math.max(x2, x);
      y2 = Math.max(y2, y);
    }
  const ox = Math.floor(x1) - PAD;
  const oy = Math.floor(y1) - PAD;
  const W = Math.ceil(x2 - x1) + PAD * 2;
  const H = Math.ceil(y2 - y1) + PAD * 2;
  const img = new Uint8Array(W * H);
  // lati con direzione per il winding
  const edges = [];
  for (const c of contours) {
    for (let i = 0; i < c.length; i++) {
      const a = c[i];
      const b = c[(i + 1) % c.length];
      if (a[1] === b[1]) continue;
      edges.push([a[0] - ox, a[1] - oy, b[0] - ox, b[1] - oy]);
    }
  }
  const xs = [];
  for (let y = 0; y < H; y++) {
    const sy = y + 0.5;
    xs.length = 0;
    for (const [ax, ay, bx, by] of edges) {
      const up = ay < by;
      const lo = up ? ay : by;
      const hi = up ? by : ay;
      if (sy < lo || sy >= hi) continue;
      const t = (sy - ay) / (by - ay);
      xs.push([ax + t * (bx - ax), up ? 1 : -1]);
    }
    xs.sort((p, q) => p[0] - q[0]);
    let wind = 0;
    for (let i = 0; i < xs.length - 1; i++) {
      wind += xs[i][1];
      if (wind !== 0) {
        const s = Math.max(0, Math.ceil(xs[i][0] - 0.5));
        const e = Math.min(W - 1, Math.floor(xs[i + 1][0] - 0.5));
        for (let x = s; x <= e; x++) img[y * W + x] = 1;
      }
    }
  }
  return { img, W, H, ox, oy };
}

// ── 3. Assottigliamento ──────────────────────────────────────────────────────
// Vicini in senso orario a partire da Nord: N, NE, E, SE, S, SW, W, NW
const DX = [0, 1, 1, 1, 0, -1, -1, -1];
const DY = [-1, -1, 0, 1, 1, 1, 0, -1];

function neighbors(img, W, x, y) {
  const n = new Array(8);
  for (let k = 0; k < 8; k++) n[k] = img[(y + DY[k]) * W + (x + DX[k])] ? 1 : 0;
  return n;
}

function zhangSuen(img, W, H) {
  let changed = true;
  const del = [];
  while (changed) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      del.length = 0;
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          if (!img[y * W + x]) continue;
          const n = neighbors(img, W, x, y);
          const B = n.reduce((a, b) => a + b, 0);
          if (B < 2 || B > 6) continue;
          let A = 0;
          for (let k = 0; k < 8; k++) if (!n[k] && n[(k + 1) % 8]) A++;
          if (A !== 1) continue;
          // P2=N P4=E P6=S P8=W
          if (pass === 0) {
            if (n[0] * n[2] * n[4]) continue;
            if (n[2] * n[4] * n[6]) continue;
          } else {
            if (n[0] * n[2] * n[6]) continue;
            if (n[0] * n[4] * n[6]) continue;
          }
          del.push(y * W + x);
        }
      }
      for (const i of del) img[i] = 0;
      if (del.length) changed = true;
    }
  }
}

// Rimuove i pixel "a scalino" (scheletro spesso 2 pixel in diagonale) senza
// spezzare la connettività: così ogni pixel interno ha esattamente 2 vicini.
function makeEightThin(img, W, H) {
  let changed = true;
  while (changed) {
    changed = false;
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        if (!img[y * W + x]) continue;
        const n = neighbors(img, W, x, y);
        const B = n.reduce((a, b) => a + b, 0);
        if (B < 2) continue;
        let A = 0;
        for (let k = 0; k < 8; k++) if (!n[k] && n[(k + 1) % 8]) A++;
        if (A !== 1) continue;
        const corner = (n[0] && n[2]) || (n[2] && n[4]) || (n[4] && n[6]) || (n[6] && n[0]);
        if (!corner) continue;
        img[y * W + x] = 0;
        changed = true;
      }
    }
  }
}

function degree(img, W, x, y) {
  let d = 0;
  for (let k = 0; k < 8; k++) if (img[(y + DY[k]) * W + (x + DX[k])]) d++;
  return d;
}

// Elimina i "rametti" corti (artefatti dello scheletro agli angoli dei tratti spessi)
function pruneSpurs(img, W, H, maxLen) {
  for (let iter = 0; iter < 3; iter++) {
    let removed = 0;
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        if (!img[y * W + x] || degree(img, W, x, y) !== 1) continue;
        const walk = [[x, y]];
        let px = -1;
        let py = -1;
        let cx = x;
        let cy = y;
        let ended = false;
        while (walk.length <= maxLen) {
          let nx = -1;
          let ny = -1;
          let cnt = 0;
          for (let k = 0; k < 8; k++) {
            const qx = cx + DX[k];
            const qy = cy + DY[k];
            if (!img[qy * W + qx] || (qx === px && qy === py)) continue;
            if (walk.some(([wx, wy]) => wx === qx && wy === qy)) continue;
            cnt++;
            nx = qx;
            ny = qy;
          }
          if (cnt === 0) {
            ended = true; // tratto isolato: non è un rametto
            break;
          }
          if (degree(img, W, nx, ny) >= 3 || cnt > 1) break; // raggiunto un incrocio
          px = cx;
          py = cy;
          cx = nx;
          cy = ny;
          walk.push([cx, cy]);
        }
        if (!ended && walk.length <= maxLen) {
          for (const [wx, wy] of walk) img[wy * W + wx] = 0;
          removed++;
        }
      }
    }
    makeEightThin(img, W, H);
    if (!removed) break;
  }
}

// ── 4. Grafo dello scheletro ─────────────────────────────────────────────────
function buildGraph(img, W, H) {
  const idx = (x, y) => y * W + x;
  const isNode = new Int32Array(W * H).fill(-1); // id del nodo per i pixel nodo
  const nodes = [];
  // nodi = pixel con grado != 2; gli incroci adiacenti vengono fusi in un solo nodo
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (!img[idx(x, y)]) continue;
      const d = degree(img, W, x, y);
      if (d === 2 || isNode[idx(x, y)] >= 0) continue;
      const id = nodes.length;
      const pix = [[x, y]];
      isNode[idx(x, y)] = id;
      if (d >= 3) {
        for (let i = 0; i < pix.length; i++) {
          const [cx, cy] = pix[i];
          for (let k = 0; k < 8; k++) {
            const qx = cx + DX[k];
            const qy = cy + DY[k];
            if (!img[idx(qx, qy)] || isNode[idx(qx, qy)] >= 0) continue;
            if (degree(img, W, qx, qy) >= 3) {
              isNode[idx(qx, qy)] = id;
              pix.push([qx, qy]);
            }
          }
        }
      }
      const cx = pix.reduce((a, p) => a + p[0], 0) / pix.length;
      const cy = pix.reduce((a, p) => a + p[1], 0) / pix.length;
      nodes.push({ id, x: cx, y: cy, pix, deg: d, edges: [] });
    }
  }
  // archi: dal pixel nodo si cammina lungo i pixel di grado 2 fino al nodo successivo
  const edges = [];
  const usedPix = new Uint8Array(W * H);
  const seenDirect = new Set();
  for (const n of nodes) {
    for (const [sx, sy] of n.pix) {
      for (let k = 0; k < 8; k++) {
        const qx = sx + DX[k];
        const qy = sy + DY[k];
        const qi = idx(qx, qy);
        if (!img[qi]) continue;
        if (isNode[qi] === n.id) continue;
        if (isNode[qi] >= 0) {
          // due nodi adiacenti senza pixel intermedi
          const key = [n.id, isNode[qi]].sort((a, b) => a - b).join('-');
          if (seenDirect.has(key)) continue;
          seenDirect.add(key);
          edges.push({ a: n.id, b: isNode[qi], pts: [[sx, sy], [qx, qy]] });
          continue;
        }
        if (usedPix[qi]) continue;
        const pts = [[sx, sy], [qx, qy]];
        usedPix[qi] = 1;
        let px = sx;
        let py = sy;
        let cx = qx;
        let cy = qy;
        let end = -1;
        for (;;) {
          let moved = false;
          for (let j = 0; j < 8; j++) {
            const rx = cx + DX[j];
            const ry = cy + DY[j];
            const ri = idx(rx, ry);
            if (!img[ri] || (rx === px && ry === py)) continue;
            if (isNode[ri] >= 0) {
              if (isNode[ri] === n.id && pts.length < 3) continue;
              end = isNode[ri];
              pts.push([rx, ry]);
              moved = true;
              break;
            }
            if (usedPix[ri]) continue;
            usedPix[ri] = 1;
            pts.push([rx, ry]);
            px = cx;
            py = cy;
            cx = rx;
            cy = ry;
            moved = true;
            break;
          }
          if (end >= 0 || !moved) break;
        }
        if (end < 0) end = n.id; // anello chiuso che torna allo stesso nodo
        edges.push({ a: n.id, b: end, pts });
      }
    }
  }
  // anelli puri (nessun nodo): si crea un nodo nel pixel più a sinistra
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = idx(x, y);
      if (!img[i] || isNode[i] >= 0 || usedPix[i]) continue;
      const id = nodes.length;
      nodes.push({ id, x, y, pix: [[x, y]], deg: 2, edges: [] });
      isNode[i] = id;
      const pts = [[x, y]];
      let px = x;
      let py = y;
      let cx = x;
      let cy = y;
      for (;;) {
        let moved = false;
        for (let j = 0; j < 8; j++) {
          const rx = cx + DX[j];
          const ry = cy + DY[j];
          const ri = idx(rx, ry);
          if (!img[ri] || (rx === px && ry === py) || usedPix[ri]) continue;
          if (ri === i) continue;
          usedPix[ri] = 1;
          pts.push([rx, ry]);
          px = cx;
          py = cy;
          cx = rx;
          cy = ry;
          moved = true;
          break;
        }
        if (!moved) break;
      }
      pts.push([x, y]);
      usedPix[i] = 1;
      edges.push({ a: id, b: id, pts });
    }
  }
  edges.forEach((e, i) => {
    e.id = i;
    e.len = polyLen(e.pts);
    nodes[e.a].edges.push(i);
    if (e.b !== e.a) nodes[e.b].edges.push(i);
    else nodes[e.a].edges.push(i); // un anello conta due volte nel grado
  });
  return { nodes, edges };
}


function polyLen(pts) {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return l;
}

// Grafo "pulito" su cui si lavora: nodi = estremi e incroci, archi = tratti tra di essi
class Graph {
  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
    this.nextN = 0;
    this.nextE = 0;
  }
  addNode(x, y) {
    const id = this.nextN++;
    this.nodes.set(id, { id, x, y, edges: new Set() });
    return id;
  }
  addEdge(a, b, pts) {
    const id = this.nextE++;
    this.edges.set(id, { id, a, b, pts, len: polyLen(pts) });
    this.nodes.get(a).edges.add(id);
    this.nodes.get(b).edges.add(id);
    return id;
  }
  removeEdge(id) {
    const e = this.edges.get(id);
    this.edges.delete(id);
    this.nodes.get(e.a).edges.delete(id);
    this.nodes.get(e.b).edges.delete(id);
  }
  degree(nid, skip) {
    let d = 0;
    for (const ei of this.nodes.get(nid).edges) {
      if (skip && skip.has(ei)) continue;
      const e = this.edges.get(ei);
      d += e.a === e.b ? 2 : 1;
    }
    return d;
  }
  other(e, nid) {
    return e.a === nid ? e.b : e.a;
  }
}

const MERGE_LEN = 9; // px: archi più corti tra due incroci → un solo incrocio
const BUBBLE_LEN = 34; // px: anellini e "bolle" più corti di così sono artefatti

function simplify(raw) {
  const g = new Graph();
  const map = new Map();
  for (const n of raw.nodes) map.set(n.id, g.addNode(n.x, n.y));
  for (const e of raw.edges) g.addEdge(map.get(e.a), map.get(e.b), e.pts);

  const mergeNodes = (a, b, via) => {
    g.removeEdge(via);
    const na = g.nodes.get(a);
    const nb = g.nodes.get(b);
    na.x = (na.x + nb.x) / 2;
    na.y = (na.y + nb.y) / 2;
    for (const ei of [...nb.edges]) {
      const e = g.edges.get(ei);
      if (e.a === b) e.a = a;
      if (e.b === b) e.b = a;
      nb.edges.delete(ei);
      na.edges.add(ei);
    }
    g.nodes.delete(b);
  };

  let changed = true;
  while (changed) {
    changed = false;
    for (const e of [...g.edges.values()]) {
      if (!g.edges.has(e.id) || e.a === e.b || e.len > MERGE_LEN) continue;
      mergeNodes(e.a, e.b, e.id);
      changed = true;
    }
    for (const e of [...g.edges.values()]) {
      if (e.a === e.b && e.len < BUBBLE_LEN) {
        g.removeEdge(e.id);
        changed = true;
      }
    }
    const byPair = new Map();
    for (const e of g.edges.values()) {
      if (e.a === e.b) continue;
      const k = e.a < e.b ? `${e.a}-${e.b}` : `${e.b}-${e.a}`;
      if (!byPair.has(k)) byPair.set(k, []);
      byPair.get(k).push(e);
    }
    for (const list of byPair.values()) {
      if (list.length < 2) continue;
      list.sort((p, q) => p.len - q.len);
      for (const e of list.slice(1)) {
        if (e.len < BUBBLE_LEN) {
          g.removeEdge(e.id);
          changed = true;
        }
      }
    }
    // nodi con esattamente due archi: non sono veri incroci, si uniscono i due tratti
    for (const n of [...g.nodes.values()]) {
      if (!g.nodes.has(n.id) || n.edges.size !== 2) continue;
      const [e1, e2] = [...n.edges].map((id) => g.edges.get(id));
      if (e1.a === e1.b || e2.a === e2.b) continue;
      const a = g.other(e1, n.id);
      const b = g.other(e2, n.id);
      const p1 = e1.b === n.id ? e1.pts : [...e1.pts].reverse(); // da a verso n
      const p2 = e2.a === n.id ? e2.pts : [...e2.pts].reverse(); // da n verso b
      g.removeEdge(e1.id);
      g.removeEdge(e2.id);
      g.nodes.delete(n.id);
      g.addEdge(a, b, [...p1, ...p2.slice(1)]);
      changed = true;
    }
  }
  return g;
}

// direzione di uscita da un nodo lungo i punti (già orientati in uscita)
function headDir(pts, reach = 12) {
  const p0 = pts[0];
  const p1 = pts[Math.min(reach, pts.length - 1)];
  const l = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
  return [(p1[0] - p0[0]) / l, (p1[1] - p0[1]) / l];
}

function components(g) {
  const seen = new Set();
  const list = [];
  for (const n of g.nodes.values()) {
    if (seen.has(n.id)) continue;
    const ids = [];
    const stack = [n.id];
    seen.add(n.id);
    while (stack.length) {
      const id = stack.pop();
      ids.push(id);
      for (const ei of g.nodes.get(id).edges) {
        const o = g.other(g.edges.get(ei), id);
        if (!seen.has(o)) {
          seen.add(o);
          stack.push(o);
        }
      }
    }
    const edgeIds = [...new Set(ids.flatMap((id) => [...g.nodes.get(id).edges]))];
    const pts = edgeIds.length ? edgeIds.flatMap((ei) => g.edges.get(ei).pts) : ids.map((id) => [g.nodes.get(id).x, g.nodes.get(id).y]);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [x, y] of pts) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    list.push({ nodes: ids, edges: edgeIds, minX, maxX, minY, maxY });
  }
  return list;
}

// cammini minimi (Dijkstra) da un nodo: distanze e arco di provenienza
function dijkstra(g, src) {
  const dist = new Map([[src, 0]]);
  const prev = new Map();
  const open = new Set([src]);
  while (open.size) {
    let u = null;
    let du = Infinity;
    for (const id of open)
      if (dist.get(id) < du) {
        du = dist.get(id);
        u = id;
      }
    open.delete(u);
    for (const ei of g.nodes.get(u).edges) {
      const e = g.edges.get(ei);
      const v = g.other(e, u);
      const dv = du + e.len;
      if (dv < (dist.has(v) ? dist.get(v) : Infinity)) {
        dist.set(v, dv);
        prev.set(v, ei);
        open.add(v);
      }
    }
  }
  return { dist, prev };
}

// Percorso di un componente come UN tratto continuo il più possibile:
//  - i nodi "dispari" (estremi e incroci a T) vengono abbinati e il tratto più
//    corto tra loro viene raddoppiato: il filo ripassa su se stesso, come la
//    penna che risale e riscende l'asta di una "d". Se il ripasso sarebbe più
//    lungo di JUMP, il filo invece "passa dietro" (come l'ago nel tessuto);
//  - poi Fleury: non si brucia mai un ponte se c'è un'alternativa, e agli
//    incroci si sceglie la direzione più dritta (come fa la mano).

const JUMP = SIZE * 1.0;

function traverseComponent(g, comp) {
  const odd = comp.nodes.filter((id) => g.degree(id) % 2 === 1);
  // distanze lungo il tracciato tra tutti i nodi dispari
  const paths = new Map();
  const D = new Map();
  for (const a of odd) {
    const { dist, prev } = dijkstra(g, a);
    paths.set(a, prev);
    D.set(a, dist);
  }
  const dist = (a, b) => (a === b ? 0 : (D.get(a).get(b) ?? Infinity));
  const cost = (a, b) => Math.min(dist(a, b), JUMP); // oltre JUMP conviene "passare dietro"

  // abbinamento a costo minimo (greedy + miglioramento 2-opt)
  const matchOf = (free) => {
    const pairs = [];
    for (let i = 0; i < free.length; i++)
      for (let j = i + 1; j < free.length; j++) pairs.push([cost(free[i], free[j]), free[i], free[j]]);
    pairs.sort((p, q) => p[0] - q[0]);
    const done = new Set();
    const m = [];
    for (const [, x, y] of pairs) {
      if (done.has(x) || done.has(y)) continue;
      done.add(x);
      done.add(y);
      m.push([x, y]);
    }
    for (let improved = true; improved; ) {
      improved = false;
      for (let i = 0; i < m.length; i++)
        for (let j = i + 1; j < m.length; j++) {
          const [x, y] = m[i];
          const [z, w] = m[j];
          const now = cost(x, y) + cost(z, w);
          if (cost(x, z) + cost(y, w) < now - 1e-6) {
            m[i] = [x, z];
            m[j] = [y, w];
            improved = true;
          } else if (cost(x, w) + cost(y, z) < now - 1e-6) {
            m[i] = [x, w];
            m[j] = [y, z];
            improved = true;
          }
        }
    }
    return { m, total: m.reduce((acc, [x, y]) => acc + cost(x, y), 0) };
  };

  // scelta di inizio e fine: ripassi minimi, ma si preferisce iniziare a sinistra
  // e finire a destra (come chi scrive)
  let start = comp.nodes.reduce((p, q) => (g.nodes.get(p).x <= g.nodes.get(q).x ? p : q));
  let match = [];
  if (odd.length >= 2) {
    let best = Infinity;
    for (const s of odd)
      for (const e of odd) {
        if (s === e) continue;
        const { m, total } = matchOf(odd.filter((id) => id !== s && id !== e));
        const sx = g.nodes.get(s).x;
        const ex = g.nodes.get(e).x;
        const score = total + 0.35 * (sx - comp.minX) + 0.35 * (comp.maxX - ex);
        if (score < best) {
          best = score;
          start = s;
          match = m;
        }
      }
  }
  if (process.env.STATS) console.log('   odd', odd.length, 'ripassi', match.map(([x, y]) => Math.round(dist(x, y))).join(','));
  for (const [x, y] of match) {
    if (dist(x, y) > JUMP) continue; // troppo lontani: il filo passerà dietro
    // raddoppia gli archi del cammino minimo y → x
    const prev = paths.get(x);
    let v = y;
    while (v !== x) {
      const e = g.edges.get(prev.get(v));
      comp.edges.push(g.addEdge(e.a, e.b, e.pts));
      v = g.other(e, v);
    }
  }

  let cur = start;
  const used = new Set();
  const remainingAt = (nid) => [...g.nodes.get(nid).edges].filter((ei) => !used.has(ei));
  const anyLeft = () => comp.edges.some((ei) => !used.has(ei));
  const reachable = (from, to) => {
    const seen = new Set([from]);
    const stack = [from];
    while (stack.length) {
      const u = stack.pop();
      if (u === to) return true;
      for (const ei of remainingAt(u)) {
        const v = g.other(g.edges.get(ei), u);
        if (!seen.has(v)) {
          seen.add(v);
          stack.push(v);
        }
      }
    }
    return false;
  };

  const strokes = [];
  let stroke = [];
  let inDir = null;
  while (anyLeft()) {
    const opts = remainingAt(cur);
    if (!opts.length) {
      // nessun tratto libero qui: il filo passa "dietro" al punto libero più vicino
      strokes.push(stroke);
      stroke = [];
      const here = g.nodes.get(cur);
      // si riparte da un nodo dispari se esiste (altrimenti servirebbero altri salti)
      const cands = new Set();
      for (const ei of comp.edges) {
        if (used.has(ei)) continue;
        const e = g.edges.get(ei);
        cands.add(e.a);
        cands.add(e.b);
      }
      const oddC = [...cands].filter((nid) => g.degree(nid, used) % 2 === 1);
      let best = null;
      let bestD = Infinity;
      for (const nid of oddC.length ? oddC : cands) {
        const n = g.nodes.get(nid);
        const d = Math.hypot(n.x - here.x, n.y - here.y);
        if (d < bestD) {
          bestD = d;
          best = nid;
        }
      }
      cur = best;
      inDir = null;
      continue;
    }
    // opzioni: ogni arco nella sua direzione d'uscita (gli anelli in entrambe)
    const choices = [];
    for (const ei of opts) {
      const e = g.edges.get(ei);
      if (e.a === e.b) {
        choices.push({ ei, pts: e.pts });
        choices.push({ ei, pts: [...e.pts].reverse() });
      } else choices.push({ ei, pts: e.a === cur ? e.pts : [...e.pts].reverse() });
    }
    let best = null;
    let bestScore = -Infinity;
    for (const c of choices) {
      const d = headDir(c.pts);
      let s = inDir ? d[0] * inDir[0] + d[1] * inDir[1] : d[0] * 0.7 - d[1] * 0.3;
      const e = g.edges.get(c.ei);
      if (opts.length > 1 && e.a !== e.b) {
        used.add(c.ei);
        const bridge = !reachable(e.a, e.b);
        used.delete(c.ei);
        if (bridge) s -= 10;
      }
      if (s > bestScore) {
        bestScore = s;
        best = c;
      }
    }
    used.add(best.ei);
    stroke.push(...(stroke.length ? best.pts.slice(1) : best.pts));
    const tail = best.pts.slice(-13).reverse();
    const back = headDir(tail);
    inDir = [-back[0], -back[1]];
    const e = g.edges.get(best.ei);
    cur = e.a === e.b ? cur : g.other(e, cur);
  }
  strokes.push(stroke);
  return strokes.filter((s) => s.length > 1);
}

// ── 6. Smoothing e ricampionamento ───────────────────────────────────────────
function resample(pts, step) {
  const out = [pts[0]];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    let [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    let seg = Math.hypot(bx - ax, by - ay);
    while (acc + seg >= step) {
      const t = (step - acc) / seg;
      ax = ax + (bx - ax) * t;
      ay = ay + (by - ay) * t;
      out.push([ax, ay]);
      seg = Math.hypot(bx - ax, by - ay);
      acc = 0;
    }
    acc += seg;
  }
  const last = pts[pts.length - 1];
  if (Math.hypot(last[0] - out[out.length - 1][0], last[1] - out[out.length - 1][1]) > step * 0.3) out.push(last);
  return out;
}

function smooth(pts, sigma) {
  const r = Math.ceil(sigma * 2.5);
  const w = [];
  for (let k = -r; k <= r; k++) w.push(Math.exp(-(k * k) / (2 * sigma * sigma)));
  return pts.map((p, i) => {
    if (i === 0 || i === pts.length - 1) return p;
    // vicino ai capi la finestra si restringe in modo simmetrico (i capi restano fermi)
    const rr = Math.min(r, i, pts.length - 1 - i);
    let sx = 0;
    let sy = 0;
    let sw = 0;
    for (let k = -rr; k <= rr; k++) {
      sx += pts[i + k][0] * w[k + r];
      sy += pts[i + k][1] * w[k + r];
      sw += w[k + r];
    }
    return [sx / sw, sy / sw];
  });
}

// Dove il filo ripassa su un tratto già cucito, sale sopra (z verso la camera),
// così gli incroci e i ripassi non si compenetrano.
function liftOverlaps(strokes, near, lift, minGap) {
  const all = [];
  strokes.forEach((s, si) => s.forEach((p, pi) => all.push({ p, si, pi, z: 0 })));
  const cell = near;
  const grid = new Map();
  const key = (x, y) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
  all.forEach((q, i) => {
    q.i = i;
    let z = 0;
    const cx = Math.floor(q.p[0] / cell);
    const cy = Math.floor(q.p[1] / cell);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        const list = grid.get(`${cx + dx},${cy + dy}`);
        if (!list) continue;
        for (const o of list) {
          if (o.i > i - minGap) continue; // i punti appena precedenti sono lo stesso tratto
          if (Math.hypot(o.p[0] - q.p[0], o.p[1] - q.p[1]) < near) z = Math.max(z, o.z + lift);
        }
      }
    q.z = z;
    const k = key(q.p[0], q.p[1]);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(q);
  });
  // rampa morbida: dilatazione + media, così il filo sale prima dell'incrocio
  const out = strokes.map((s) => s.map(() => 0));
  for (const q of all) out[q.si][q.pi] = q.z;
  return out.map((zs) => {
    const R = 6;
    const dil = zs.map((_, i) => Math.max(...zs.slice(Math.max(0, i - R), i + R + 1)));
    return dil.map((_, i) => {
      const win = dil.slice(Math.max(0, i - R), i + R + 1);
      return win.reduce((a, b) => a + b, 0) / win.length;
    });
  });
}

// ── Debug: immagine PNG (via ffmpeg) ─────────────────────────────────────────
function savePNG(file, W, H, draw) {
  const rgb = new Uint8Array(W * H * 3).fill(18);
  draw((x, y, r, g, b) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3;
    rgb[i] = r;
    rgb[i + 1] = g;
    rgb[i + 2] = b;
  });
  const ppm = path.join(DEBUG_DIR, 'tmp.ppm');
  fs.writeFileSync(ppm, Buffer.concat([Buffer.from(`P6 ${W} ${H} 255\n`), Buffer.from(rgb)]));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', ppm, file]);
  fs.unlinkSync(ppm);
}

function hue(h) {
  const f = (n) => {
    const k = (n + h * 12) % 12;
    return Math.round(255 * (0.5 - 0.5 * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}

// ── Pipeline per ogni impaginazione ──────────────────────────────────────────
const THREAD_R = 0.016; // raggio del filo in em (deve coincidere con config.js → thread.radius)
const result = { font: 'Great Vibes', unit: 'em', threadRadius: THREAD_R, layouts: {} };

for (const [name, lines] of Object.entries(LAYOUTS)) {
  const { img, W, H, ox, oy } = rasterize(layoutCommands(lines));
  const fill = img.slice();
  zhangSuen(img, W, H);
  makeEightThin(img, W, H);
  pruneSpurs(img, W, H, Math.round(SIZE * 0.035));
  const g = simplify(buildGraph(img, W, H));
  const comps = components(g);

  // i puntini (la "i") si cuciono dopo la parola che li contiene, come a mano
  const DOT = SIZE * 0.07;
  const isDot = (c) => c.maxX - c.minX < DOT && c.maxY - c.minY < DOT;
  const main = comps.filter((c) => !isDot(c)).sort((a, b) => a.minX - b.minX);
  const dots = comps.filter(isDot);
  const order = [...main];
  for (const d of dots) {
    const cx = (d.minX + d.maxX) / 2;
    // la parola = componenti principali sulla stessa riga che si toccano in orizzontale
    let at = order.findIndex((c) => !isDot(c) && c.minX <= cx && c.maxX >= cx && c.maxY > d.maxY);
    if (at < 0) at = order.length - 1;
    while (at + 1 < order.length && !isDot(order[at + 1]) && order[at + 1].minX < order[at].maxX + SIZE * 0.08 && Math.abs(order[at + 1].maxY - order[at].maxY) < SIZE * 0.6) at++;
    order.splice(at + 1, 0, d);
  }

  const strokes = [];
  for (const c of order) {
    if (isDot(c)) {
      strokes.push({ dot: [(c.minX + c.maxX) / 2, (c.minY + c.maxY) / 2] });
      continue;
    }
    const ss = traverseComponent(g, c);
    if (process.env.STATS) console.log(`  comp x ${Math.round(c.minX)}-${Math.round(c.maxX)} nodes ${c.nodes.length} odd ${c.nodes.filter((id) => g.degree(id) % 2).length} strokes ${ss.length}`);
    for (const s of ss) strokes.push({ pts: s });
  }

  // smoothing: lo scheletro è fatto di pixel, il filo deve essere fluido
  for (const s of strokes) {
    if (s.dot) continue;
    let p = resample(s.pts, 2);
    p = smooth(p, 5);
    p = smooth(p, 3);
    s.pts = resample(p, 5);
  }
  const lines2 = strokes.filter((s) => !s.dot);
  const zs = liftOverlaps(
    lines2.map((s) => s.pts),
    THREAD_R * 2.3 * SIZE,
    THREAD_R * 2.2 * SIZE,
    Math.ceil((THREAD_R * 8 * SIZE) / 5),
  );
  lines2.forEach((s, i) => (s.z = zs[i]));

  // da pixel a em: y verso l'alto, origine sulla linea di base della prima riga
  const r4 = (v) => +v.toFixed(4);
  const out = strokes.map((s) => {
    if (s.dot) return { dot: [r4((s.dot[0] + ox) / SIZE), r4(-(s.dot[1] + oy) / SIZE)] };
    const flat = [];
    s.pts.forEach(([x, y], i) => flat.push(r4((x + ox) / SIZE), r4(-(y + oy) / SIZE), r4(s.z[i] / SIZE)));
    return { p: flat };
  });
  let bx1 = Infinity;
  let by1 = Infinity;
  let bx2 = -Infinity;
  let by2 = -Infinity;
  for (const s of out) {
    const arr = s.dot || s.p;
    const st = s.dot ? 2 : 3;
    for (let i = 0; i < arr.length; i += st) {
      bx1 = Math.min(bx1, arr[i]);
      bx2 = Math.max(bx2, arr[i]);
      by1 = Math.min(by1, arr[i + 1]);
      by2 = Math.max(by2, arr[i + 1]);
    }
  }
  result.layouts[name] = { bbox: [bx1, by1, bx2, by2].map(r4), strokes: out };

  const totalLen = lines2.reduce((a, s) => a + polyLen(s.pts), 0);
  console.log(
    `${name}: ${g.nodes.size} nodi, ${g.edges.size} archi, ${strokes.length} tratti ` +
      `(${strokes.filter((s) => s.dot).length} puntini), lunghezza ${(totalLen / SIZE).toFixed(2)} em`,
  );

  if (DEBUG_DIR) {
    fs.mkdirSync(DEBUG_DIR, { recursive: true });
    // ordine di scrittura: colore dal blu (inizio) al rosso (fine); salti in grigio;
    // inizio di ogni tratto = quadratino bianco; punti sollevati = più chiari
    const total = lines2.reduce((a, s) => a + s.pts.length, 0);
    savePNG(path.join(DEBUG_DIR, `${name}-order.png`), W, H, (set) => {
      for (let i = 0; i < W * H; i++) if (fill[i]) set(i % W, Math.floor(i / W), 55, 45, 38);
      for (const n of g.nodes.values()) for (let a = 0; a < 6.28; a += 0.2) set(n.x + Math.cos(a) * 6, n.y + Math.sin(a) * 6, 90, 90, 90);
      let n = 0;
      let prev = null;
      for (const s of strokes) {
        const first = s.dot || s.pts[0];
        if (prev) {
          const steps = Math.ceil(Math.hypot(first[0] - prev[0], first[1] - prev[1]));
          for (let k = 0; k < steps; k += 4) set(prev[0] + ((first[0] - prev[0]) * k) / steps, prev[1] + ((first[1] - prev[1]) * k) / steps, 140, 140, 140);
        }
        if (s.dot) {
          for (let a = 0; a < 6.28; a += 0.05) set(s.dot[0] + Math.cos(a) * 9, s.dot[1] + Math.sin(a) * 9, 255, 255, 255);
          prev = s.dot;
          continue;
        }
        s.pts.forEach((p, i) => {
          let [r, gg, b] = hue(0.66 - (0.66 * n++) / total);
          if (s.z[i] > 1) [r, gg, b] = [r / 2 + 127, gg / 2 + 127, b / 2 + 127];
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) set(p[0] + dx, p[1] + dy, r, gg, b);
        });
        for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) set(first[0] + dx, first[1] + dy, 255, 255, 255);
        prev = s.pts.at(-1);
      }
    });
  }
}

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(result));
console.log(`→ ${path.relative(ROOT, OUT_FILE)} (${(fs.statSync(OUT_FILE).size / 1024).toFixed(1)} KB)`);
