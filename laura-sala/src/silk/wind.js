// Vento: una brezza di base con raffiche lente e una turbolenza che viaggia nella direzione
// del vento (così le onde attraversano la seta invece di pulsare sul posto).
// Tutto con somme di sinusoidi: liscio, deterministico e molto economico.

export const createWind = () => {
  const wind = {
    speed: 1.35, // m/s di base: una brezza decisa
    dir: [0.3, 0.1, 0.92], // da dietro-sinistra: gonfia il telo come una vela
    turbulence: 0.32, // poca turbolenza: la seta si muove sicura, non tremola
    gust: 0, // raffica attiva (0..1), animata da fuori
    push: { x: 0, y: 0, z: 0 }, // vento aggiuntivo (m/s), per i passaggi tra le sezioni
    breath: 0, // soffio legato allo scroll (0..1)
    t: 0,
  };
  const n = Math.hypot(...wind.dir);
  wind.dir = wind.dir.map((v) => v / n);

  // raffiche lente e irregolari (somma di tre periodi non commensurabili)
  // il telo "respira": si gonfia, si svuota, ricade e riparte
  // solo onde lente: niente sfarfallio
  const envelope = (t) => {
    const slow = 0.5 + 0.5 * Math.sin(t * 0.3 + 0.7);
    return 0.36 + 0.6 * slow * slow + 0.06 * Math.sin(t * 0.52 + 2.1);
  };

  wind.sample = (x, y, z, out) => {
    const t = wind.t;
    const s = wind.speed * (envelope(t) + wind.gust * 1.4 + wind.breath * 0.5);
    const [dx, dy, dz] = wind.dir;
    // coordinata lungo il vento: le perturbazioni viaggiano con l'aria
    // onde larghe e lente che attraversano la seta (niente componenti fitte che la fanno tremare)
    const a = x * dx + y * dy + z * dz - t * wind.speed * 0.6;
    const tb = wind.turbulence * wind.speed;
    const ux = Math.sin(a * 1.6 + y * 0.9 + 0.4) * 0.7 + Math.sin(a * 2.7 - y * 1.6 + t * 0.2) * 0.15;
    const uy = Math.sin(a * 1.3 + x * 1.5 + 1.9) * 0.6;
    const uz = Math.sin(a * 1.9 - x * 1.2 + y * 0.5 + 2.6) * 0.65 + Math.sin(a * 3.1 + y * 1.8) * 0.12;
    out[0] = dx * s + ux * tb + wind.push.x;
    out[1] = dy * s + uy * tb * 0.7 + wind.push.y;
    out[2] = dz * s + uz * tb + wind.push.z;
  };

  return wind;
};
