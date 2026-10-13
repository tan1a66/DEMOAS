// Sceneggiatura del video demo (≈80 s a 60 fps). Ogni riga è un gesto del "visitatore".
module.exports = async function scene(f, { W, H }) {
  const page = f.page;
  const P = (sel) => `.plate[data-open="${sel}"]`;
  const has = (expr) => page.evaluate(expr);

  // 0 — intro: logo, poi Roma dall'alto. Il cursore entra dolcemente.
  f.mouse = [W * 0.74, H * 0.62];
  await f.wait(1.6);
  await f.play(1.6, { mouse: [[W * 0.66, H * 0.52]], e: 'out' });
  // 1 — hero: il cursore passa sul titolo (parallasse) e sull'aereo, che lo segue con il muso
  await f.play(2.4, { mouse: [[W * 0.3, H * 0.4], [W * 0.2, H * 0.55]], e: 'sine' });
  await f.play(2.0, { mouse: [[W * 0.45, H * 0.7], [W * 0.66, H * 0.66]], e: 'sine' });
  await f.play(1.2, { mouse: [[W * 0.78, H * 0.58]], e: 'sine' });
  // 2 — decollo dal Colosseo
  await f.play(4.6, { scroll: 0.17, mouse: [[W * 0.62, H * 0.5], [W * 0.5, H * 0.46]], se: 'inOut', me: 'sine' });
  // 3 — crociera: Tirreno → Mediterraneo → Atlantico. Il cursore guida l'aereo e apre le nuvole
  await f.play(5.0, { scroll: 0.33, mouse: [[W * 0.32, H * 0.42], [W * 0.18, H * 0.5]], se: 'lin', me: 'sine' });
  await f.play(5.0, { scroll: 0.49, mouse: [[W * 0.45, H * 0.3], [W * 0.8, H * 0.4]], se: 'lin', me: 'sine' });
  await f.play(4.6, { scroll: 0.62, mouse: [[W * 0.86, H * 0.55], [W * 0.6, H * 0.35]], se: 'lin', me: 'sine' });
  f.mark('safe');
  // 4 — Yucatán e avvicinamento a Mérida
  await f.play(4.0, { scroll: 0.71, mouse: [[W * 0.5, H * 0.42]], se: 'out', me: 'sine' });
  await f.play(3.4, { scroll: 0.8, mouse: [[W * 0.56, H * 0.3]], se: 'inOut', me: 'sine' });
  await f.wait(0.5);
  // 5 — gli ingredienti cadono dall'aereo, tuffo nel monumento → tavola
  await f.play(2.8, { scroll: 0.862, mouse: [[W * 0.55, H * 0.34]], se: 'lin', me: 'sine' }); // gli ingredienti escono dall'aereo
  await f.play(3.2, { scroll: 0.966, mouse: [[W * 0.52, H * 0.24]], se: 'sine', me: 'sine' });  // tuffo nel monumento → piatto
  await f.play(1.6, { scroll: 1.0, se: 'out' });
  await f.wait(0.8);
  f.mark('safe');
  // 6 — il cursore sposta gli ingredienti e accende la luce sulla tovaglia
  await f.play(2.2, { mouse: [[W * 0.2, H * 0.14], [W * 0.08, H * 0.2], [W * 0.18, H * 0.84]], e: 'sine' });
  await f.play(2.2, { mouse: [[W * 0.36, H * 0.92], [W * 0.5, H * 0.84], [W * 0.62, H * 0.9]], e: 'sine' });
  // 7 — i piatti si sollevano al passaggio
  await f.play(1.6, { mouse: [[W * 0.86, H * 0.5], [W * 0.62, H * 0.5]], e: 'sine' });
  await f.moveTo(P('reserva'), 0.9);
  await f.moveTo(P('menu'), 1.0, 10, -8);
  await f.wait(0.6);

  if (!(await has(() => !!(window.AR && AR.modals)))) { await f.wait(2); return; }

  // 8 — MENÚ: si apre il libro
  await f.click();
  await f.wait(1.6);
  const book = await has(() => !!document.querySelector('#modal-root .bk-book'));
  if (book) {
    // il cursore si avvicina all'angolo della pagina destra: la pagina si solleva
    const [bx, by, bw, bh] = await f.center('#modal-root .bk-book');
    await f.play(1.4, { mouse: [[bx + bw * 0.38, by + bh * 0.3], [bx + bw * 0.47, by + bh * 0.45]], e: 'sine' });
    await f.wait(0.5);
    await f.click(); // gira la copertina
    await f.wait(1.5);
    await f.play(0.9, { mouse: [[bx + bw * 0.46, by + bh * 0.44]], e: 'sine' });
    // trascina una pagina con il cursore
    await page.mouse.down();
    await f.play(1.8, { mouse: [[bx + bw * 0.3, by + bh * 0.36], [bx + bw * 0.02, by + bh * 0.3], [bx - bw * 0.3, by + bh * 0.38]], e: 'sine' });
    await page.mouse.up();
    await f.wait(1.3);
    await f.play(0.8, { mouse: [[bx + bw * 0.44, by + bh * 0.5]], e: 'sine' });
    await f.click();
    await f.wait(1.6);
    await f.click();
    await f.wait(1.6);
  } else { await f.wait(4); }
  await f.key('Escape');
  await f.wait(1.0);

  f.mark('safe');
  // 9 — RESERVA AHORA: modulo WhatsApp
  await f.moveTo(P('reserva'), 1.0);
  await f.wait(0.3);
  await f.click();
  await f.wait(1.2);
  const R = {
    'res-plus': '#modal-root button.rs-step[data-step="1"]',
    'res-day-tomorrow': '#modal-root .rs-chip--day[data-day="manana"]',
    'res-time-2030': '#modal-root .rs-chip--time[data-time="20:30"]',
    'res-name': '#modal-root input.rs-name',
    'res-send': '#modal-root a.rs-cta',
  };
  const r = (k) => R[k];
  if (await has(() => !!document.querySelector('#modal-root button.rs-step[data-step="1"]'))) {
    await f.moveTo(r('res-plus'), 0.9); await f.click(); await f.wait(0.35); await f.click(); await f.wait(0.5);
    await f.moveTo(r('res-day-tomorrow'), 0.8); await f.click(); await f.wait(0.5);
    await f.moveTo(r('res-time-2030'), 0.8); await f.click(); await f.wait(0.5);
    await f.moveTo(r('res-name'), 0.8); await f.click(); await f.wait(0.2);
    await f.type('Lucía', 7); await f.wait(0.6);
    await f.moveTo(r('res-send'), 1.0); await f.wait(1.4);
  } else { await f.wait(4); }
  await f.key('Escape');
  await f.wait(1.0);

  // 10 — UBICACIÓN
  await f.moveTo(P('ubicacion'), 1.0);
  await f.wait(0.3);
  await f.click();
  await f.wait(1.4);
  await f.play(2.6, { mouse: [[W * 0.32, H * 0.36], [W * 0.42, H * 0.62], [W * 0.66, H * 0.5]], e: 'sine' });
  await f.wait(0.8);
  await f.key('Escape');
  await f.wait(1.0);

  f.mark('safe');
  // 11 — MÁS DE NUESTRA HISTORIA
  await f.moveTo(P('historia'), 1.0);
  await f.wait(0.3);
  await f.click();
  await f.wait(1.5);
  await f.play(2.4, { mouse: [[W * 0.3, H * 0.4], [W * 0.62, H * 0.6]], e: 'sine' });
  if (await has(() => { const n = document.querySelector('#modal-root .hs-grid'); return !!n && n.scrollHeight > n.clientHeight + 40; })) {
    const [sx, sy] = await f.center('#modal-root .hs-grid');
    await f.play(0.8, { mouse: [[sx, sy]], e: 'sine' });
    for (let i = 0; i < 24; i++) { await page.mouse.wheel(0, 34); await f.step(); }
    await f.wait(1.6);
  } else { await f.wait(2); }
  await f.key('Escape');
  await f.wait(1.0);

  // 12 — chiusura sulla tavola
  await f.play(2.6, { mouse: [[W * 0.5, H * 0.3], [W * 0.5, H * 0.16]], e: 'sine' });
  await f.wait(1.6);
};
