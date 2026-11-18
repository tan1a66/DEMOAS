// Vento: una brezza di base con raffiche lente e una turbolenza che viaggia nella direzione
// del vento (così le onde attraversano la seta invece di pulsare sul posto).
// Tutto con somme di sinusoidi: liscio, deterministico e molto economico.

export const createWind = () => {
  const wind = {
    speed: 1.5, // m/s di base: una brezza
    dir: [0.3, 0.1, 0.92], // da dietro-sinistra: gonfia il telo come una vela
    turbulence: 0.6,
    gust: 0, // raffica attiva (0..1), animata da fuori
    push: { x: 0, y: 0, z: 0 }, // vento aggiuntivo (m/s), per i passaggi tra le sezioni
    t: 0,
  };
  const n = Math.hypot(...wind.dir);
  wind.dir = wind.dir.map((v) => v / n);

  // raffiche lente e irregolari (somma di tre periodi non commensurabili)
  // il telo "respira": si gonfia, si svuota, ricade e riparte
  const envelope = (t) => {
    const slow = 0.5 + 0.5 * Math.sin(t * 0.33 + 0.7);
    return 0.28 + 0.62 * slow * slow + 0.12 * Math.sin(t * 0.71 + 2.1) + 0.06 * Math.sin(t * 1.53);
  };

  wind.sample = (x, y, z, out) => {
    const t = wind.t;
    const s = wind.speed * (envelope(t) + wind.gust * 1.4);
    const [dx, dy, dz] = wind.dir;
    // coordinata lungo il vento: le perturbazioni viaggiano con l'aria
    const a = x * dx + y * dy + z * dz - t * wind.speed * 0.8;
    const tb = wind.turbulence * wind.speed;
    const ux = Math.sin(a * 2.1 + y * 1.3 + 0.4) * 0.6 + Math.sin(a * 4.7 - y * 2.9 + t * 0.3) * 0.25;
    const uy = Math.sin(a * 1.7 + x * 2.3 + 1.9) * 0.55 + Math.sin(a * 3.9 + x * 4.1 - 0.8) * 0.2;
    const uz = Math.sin(a * 2.6 - x * 1.9 + y * 0.7 + 2.6) * 0.5 + Math.sin(a * 5.3 + y * 3.3) * 0.2;
    out[0] = dx * s + ux * tb + wind.push.x;
    out[1] = dy * s + uy * tb * 0.7 + wind.push.y;
    out[2] = dz * s + uz * tb + wind.push.z;
  };

  return wind;
};
