import { ui } from '../i18n.js';

/*
  Modalità debug (?debug=1), per posizionare passi e finiture nel JSON.
  - clic sulla foto: copia un passo pronto  { "to": "", "x": .., "y": .. }
  - Maiusc + clic (o Alt + clic): copia una finitura pronta, con un ritaglio proposto intorno al punto
  - tasto D: mostra la mappa di profondità al posto della foto
  - sul plastico: clic = coordinate in metri del punto [x, y, z] (x verso la strada, z verso sud, y quota)
  Le coordinate tengono conto della parallasse del momento (stessa mappa di profondità del visore).
*/

const round = (v) => Math.round(v * 10) / 10;

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export function setupDebug({ app, viewer, plastico, chrome, getMode }) {
  document.body.classList.add('is-debug');
  const hud = document.createElement('div');
  hud.className = 'debug-hud';
  app.appendChild(hud);

  const cross = document.createElement('div');
  cross.className = 'debug-cross';
  app.appendChild(cross);

  let frames = 0;
  let acc = 0;
  let fps = 0;
  viewer.onFrame((dt) => {
    frames += 1;
    acc += dt;
    if (acc > 0.5) { fps = Math.round(frames / acc); frames = 0; acc = 0; }
    const s = viewer.currentScene;
    hud.textContent = `${s ? s.id : '—'} · ${viewer.hasDepth ? 'profundidad OK' : 'SIN profundidad'} · ${fps} fps · D = mapa`;
  });
  plastico.onFrame((dt) => {
    frames += 1;
    acc += dt;
    if (acc > 0.5) { fps = Math.round(frames / acc); frames = 0; acc = 0; }
    const c = plastico.camera.position;
    hud.textContent = `maqueta · ${fps} fps · cámara ${c.x.toFixed(1)}, ${c.y.toFixed(1)}, ${c.z.toFixed(1)}`;
  });

  app.addEventListener('pointermove', (e) => {
    cross.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
  });

  app.addEventListener('click', async (e) => {
    if (e.target.closest('button, .panel, .lang')) return;
    if (getMode() === 'model') {
      const hit = plastico.pick(e.clientX, e.clientY);
      if (!hit) return;
      const pt = [hit.x, hit.y, hit.z].map((v) => Math.round(v * 100) / 100);
      const ok = await copy(JSON.stringify(pt));
      chrome.toast(`${ok ? ui('debugPoint') : '⚠'} · x ${pt[0]} · y ${pt[1]} · z ${pt[2]} m`);
      console.info('[debug] punto (m):', pt);
      return;
    }
    const p = viewer.unproject(e.clientX, e.clientY);
    if (!p) return;
    const x = round(p.x);
    const y = round(p.y);
    let text;
    let label;
    if (e.shiftKey || e.altKey) {
      const cw = 0.24;
      const ch = 0.24;
      const cx = Math.min(1 - cw, Math.max(0, x / 100 - cw / 2));
      const cy = Math.min(1 - ch, Math.max(0, y / 100 - ch / 2));
      const crop = [cx, cy, cw, ch].map((v) => Math.round(v * 100) / 100);
      text = JSON.stringify({ x, y, title: { es: '', it: '' }, text: { es: '', it: '' }, crop });
      label = ui('debugHotspot');
    } else {
      text = JSON.stringify({ to: '', x, y });
      label = ui('debugStep');
    }
    const ok = await copy(text);
    chrome.toast(`${ok ? label : '⚠'} · x ${x} · y ${y}`);
    console.info('[debug]', text);
  });

  addEventListener('keydown', (e) => {
    if (e.key === 'd' || e.key === 'D') viewer.showDepth = !viewer.showDepth;
  });
}
