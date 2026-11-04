// "Comparte tu cima": un'immagine in formato storia (1080 × 1920) con la vista 3D della cima,
// il logo, i dati della salita e il profilo vero; si condivide dal telefono (Web Share) o si
// scarica. Viene preparata quando si arriva alla tappa, così il tocco la condivide subito
// (iOS vuole la condivisione dentro il gesto).
import { CONFIG } from '../config.js';
import logoUrl from '../assets/nomads-logo.png';

const W = 1080, H = 1920;

/** testo su più righe entro maxW; restituisce le righe */
function wrap(g, text, maxW) {
  const out = [];
  let line = '';
  for (const word of text.split(' ')) {
    const tryLine = line ? `${line} ${word}` : word;
    if (g.measureText(tryLine).width > maxW && line) { out.push(line); line = word; } else line = tryLine;
  }
  if (line) out.push(line);
  return out;
}

/** testo spaziato (letter-spacing) anche dove il canvas non lo supporta */
function spaced(g, text, x, y, sp) {
  if ('letterSpacing' in g) { g.letterSpacing = `${sp}px`; g.fillText(text, x, y); g.letterSpacing = '0px'; return; }
  for (const ch of text) { g.fillText(ch, x, y); x += g.measureText(ch).width + sp; }
}

export function createShare({ canvas, road, render }) {
  const btn = document.getElementById('share');
  const card = CONFIG.copy.card;
  const { cream, orange } = CONFIG.brand;
  const logo = new Image();
  logo.src = logoUrl;
  let file = null, job = null;

  async function make() {
    await Promise.all([
      document.fonts.load('400 84px Unbounded'), document.fonts.load('500 26px Unbounded'),
      logo.decode().catch(() => {}),
    ]);
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    // il fotogramma 3D va copiato subito dopo averlo disegnato
    render();
    const s = Math.max(W / canvas.width, H / canvas.height);
    g.drawImage(canvas, (W - canvas.width * s) / 2, (H - canvas.height * s) / 2, canvas.width * s, canvas.height * s);

    let gr = g.createLinearGradient(0, 0, 0, 420);
    gr.addColorStop(0, 'rgba(20,20,20,0.55)'); gr.addColorStop(1, 'rgba(20,20,20,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, 420);
    gr = g.createLinearGradient(0, H * 0.45, 0, H);
    gr.addColorStop(0, 'rgba(20,20,20,0)'); gr.addColorStop(0.55, 'rgba(20,20,20,0.55)'); gr.addColorStop(1, 'rgba(20,20,20,0.9)');
    g.fillStyle = gr; g.fillRect(0, H * 0.45, W, H * 0.55);

    if (logo.naturalWidth) g.drawImage(logo, 80, 112, 330, (330 * logo.naturalHeight) / logo.naturalWidth);

    const x = 80;
    // profilo della salita, dal porto al Coll
    const px = (k) => x + (k / 120) * (W - 2 * x);
    const y0 = road.y(road.count - 1), y1 = road.y(0);
    const py = (i) => H - 150 - ((road.y(i) - y0) / (y1 - y0)) * 150;
    g.beginPath();
    for (let k = 0; k <= 120; k++) {
      const i = Math.round((road.count - 1) * (1 - k / 120));
      k ? g.lineTo(px(k), py(i)) : g.moveTo(px(k), py(i));
    }
    g.strokeStyle = orange; g.lineWidth = 5; g.lineJoin = 'round'; g.lineCap = 'round';
    g.shadowColor = 'rgba(232,98,44,0.8)'; g.shadowBlur = 18;
    g.stroke();
    g.shadowBlur = 0;
    g.beginPath(); g.arc(px(120), py(0), 13, 0, Math.PI * 2); g.fillStyle = orange; g.fill();

    // testi
    g.textBaseline = 'alphabetic';
    g.font = '400 84px Unbounded, "Arial Black", sans-serif';
    const title = card.title.split('\n').flatMap((par) => wrap(g, par, W - 2 * x));
    let y = H - 400 - (title.length - 1) * 96;
    g.fillStyle = orange; g.fillRect(x, y - 150 - 10, 48, 4);
    g.font = '500 26px Unbounded, "Arial Black", sans-serif';
    g.fillStyle = cream;
    spaced(g, card.kicker.toUpperCase(), x + 70, y - 150, 6);
    g.font = '400 84px Unbounded, "Arial Black", sans-serif';
    for (const line of title) { g.fillText(line, x, y); y += 96; }
    g.font = '500 34px Unbounded, "Arial Black", sans-serif';
    g.fillStyle = orange;
    spaced(g, card.stats, x, y + 4, 4);

    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
    return new File([blob], 'nomads-sa-calobra.jpg', { type: 'image/jpeg' });
  }

  const deliver = async (f) => {
    if (navigator.canShare?.({ files: [f] })) {
      try { await navigator.share({ files: [f], title: card.title.replace('\n', ' ') }); } catch { /* annullato */ }
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(f);
    a.download = f.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  btn.addEventListener('click', () => {
    if (file) { deliver(file); return; }
    btn.setAttribute('aria-busy', 'true');
    (job ||= make().then((f) => (file = f))).then(deliver).finally(() => btn.removeAttribute('aria-busy'));
  });

  return {
    /** da chiamare quando la cima è inquadrata e ferma */
    prepare() { job ||= make().then((f) => (file = f)).catch(() => { job = null; }); },
    /** per le anteprime: l'immagine come data URL */
    async dataURL() { const f = file || (await (job ||= make().then((x) => (file = x)))); return new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); }); },
  };
}
