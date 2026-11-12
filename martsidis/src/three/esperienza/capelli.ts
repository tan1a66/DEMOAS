/**
 * Capelli a fili: centinaia di ciocche sottili che partono dalla riga in mezzo, seguono la testa e
 * scendono lungo la schiena (e, ai lati del viso, davanti alle spalle). Come un disegno a linee:
 * lisci, luminosi, leggeri. Ondeggiano con lo stesso movimento della camminata.
 */
import {
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  Float32BufferAttribute,
  LineSegments,
  ShaderMaterial,
  Vector3,
  type IUniform,
} from 'three';

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};
// pseudo-casuale ripetibile: la chioma è sempre la stessa
let seme = 7;
const caso = () => ((seme = (seme * 16807) % 2147483647) / 2147483647);

const C = new Vector3(0, 7.2, -0.03); // centro del cranio
const R = new Vector3(0.82, 0.99, 0.94); // calotta appena sopra il cranio

/** Punto sulla calotta: polar = 0 in cima, π/2 all'altezza delle orecchie; phi = 0 dietro, ±π davanti. */
const calotta = (polar: number, phi: number) =>
  new Vector3(
    C.x + R.x * Math.sin(polar) * Math.sin(phi),
    C.y + R.y * Math.cos(polar),
    C.z - R.z * Math.sin(polar) * Math.cos(phi),
  );

/** Superficie esterna della chioma lungo la schiena, all'altezza y e all'angolo phi. */
const schiena = (y: number, phi: number) => {
  const zc = -1.02 + 0.52 * smooth(4.0, 7.2, y) + 0.1 * smooth(3.6, 2.4, y);
  const largo = 0.86 + 0.14 * smooth(6.2, 3.4, y);
  const xc = 0.06 * Math.sin(y * 1.3);
  return new Vector3(xc + largo * Math.sin(phi), y, zc - 0.3 * Math.cos(phi));
};

function ciocche(): Vector3[][] {
  const fili: Vector3[][] = [];
  // dietro e ai lati: phi da -1.75 a 1.75
  const N = 1200;
  for (let i = 0; i < N; i++) {
    const phi = (i / (N - 1) - 0.5) * 4.0 + (caso() - 0.5) * 0.03; // fino a ±2: si unisce alle ciocche davanti
    const lato = phi >= 0 ? 1 : -1;
    const fine = 2.25 + 0.55 * (0.98 * Math.sin(phi)) ** 2 + caso() * 0.25;
    const p = [
      new Vector3(0.03 * lato, C.y + R.y - 0.01, C.z + 0.25 - 0.1 * caso()),
      calotta(0.55, phi),
      calotta(1.1, phi),
      calotta(1.62, phi * 1.02),
      schiena(5.9, phi),
      schiena(4.6, phi),
      schiena(3.4, phi),
      schiena(fine, phi),
    ];
    for (const v of p.slice(1)) v.add(new Vector3((caso() - 0.5) * 0.05, 0, (caso() - 0.5) * 0.05));
    fili.push(p);
  }
  // ai lati: fili che coprono il fianco del collo, si appoggiano sulla spalla e ricadono dietro (niente vuoti)
  for (const lato of [-1, 1])
    for (let i = 0; i < 260; i++) {
      const phi = lato * (1.55 + caso() * 0.55);
      const zm = -0.5 + caso() * 0.5;
      const fine = 2.6 + caso() * 0.6;
      fili.push([
        new Vector3(0.03 * lato, C.y + R.y - 0.01, C.z + 0.25 - 0.1 * caso()),
        calotta(0.55, phi),
        calotta(1.15, phi),
        new Vector3(lato * (0.84 + caso() * 0.06), 6.3, zm * 0.6),
        new Vector3(lato * (0.98 + caso() * 0.08), 5.45, zm - 0.12),
        new Vector3(lato * (0.98 + caso() * 0.08), 4.5, -1.0 - caso() * 0.1),
        new Vector3(lato * (0.9 + caso() * 0.1), fine, -1.02 - caso() * 0.08),
      ]);
    }
  // davanti: ciocche ai lati del viso che ricadono davanti alle spalle
  for (const lato of [-1, 1])
    for (let i = 0; i < 280; i++) {
      const phi = lato * (1.85 + caso() * 0.65);
      const sx = (caso() - 0.5) * 0.24, sz = (caso() - 0.5) * 0.2;
        const p = [
          new Vector3(0.03 * lato, C.y + R.y - 0.01, C.z + 0.25 - 0.1 * caso()),
          calotta(0.55, phi),
          calotta(1.15, phi),
          new Vector3(lato * (0.8 + sx * 0.3), 6.35, 0.08 + sz * 0.5),
          new Vector3(lato * (0.95 + sx * 0.5), 5.05, 0.3 + sz * 0.6),
          new Vector3(lato * (0.92 + sx), 4.25 - caso() * 0.3, 0.72 + sz * 0.6),
        ];
        fili.push(p);
    }
  return fili;
}

export function creaCapelli(uniforms: Record<string, IUniform>, chiaro: Color, scuro: Color, luce: Color) {
  const pos: number[] = [];
  const tono: number[] = [];
  const lungo: number[] = [];
  for (const punti of ciocche()) {
    const curva = new CatmullRomCurve3(punti, false, 'centripetal');
    const n = 30;
    const pts = curva.getPoints(n);
    const t = caso();
    for (let k = 0; k < n; k++) {
      pos.push(pts[k]!.x, pts[k]!.y, pts[k]!.z, pts[k + 1]!.x, pts[k + 1]!.y, pts[k + 1]!.z);
      tono.push(t, t);
      lungo.push(k / n, (k + 1) / n);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('tono', new Float32BufferAttribute(tono, 1));
  geo.setAttribute('lungo', new Float32BufferAttribute(lungo, 1));

  const mat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { ...uniforms, uChiaro: { value: chiaro }, uScuro: { value: scuro }, uLuce: { value: luce } },
    vertexShader: /* glsl */ `
      uniform float uFase; uniform float uPasso; uniform vec3 uGruppoPos; uniform float uGruppoRot;
      uniform float uOndaAmp; uniform float uOndaT;
      attribute float tono; attribute float lungo;
      varying float vTono; varying float vLungo; varying vec3 vMondo; varying float vLuce;
      void main() {
        vec4 m = modelMatrix * vec4(position, 1.0);
        float cg = cos(uGruppoRot), sg = sin(uGruppoRot);
        vec3 f = m.xyz - uGruppoPos;
        f = vec3(cg * f.x - sg * f.z, f.y, sg * f.x + cg * f.z);
        // stesso ondeggiare della camminata: un'onda che scende dalla nuca alle punte
        float lunghi = pow(1.0 - smoothstep(2.4, 7.0, f.y), 1.4);
        float giu = 7.0 - f.y;
        f.x += lunghi * uOndaAmp * 0.38 * sin(uOndaT * 2.1 - giu * 0.85 + tono * 0.6);
        f.x += lunghi * uPasso * 0.16 * sin(uFase - 0.9 - giu * 0.3);
        f.z -= lunghi * uOndaAmp * 0.24 * (0.55 + 0.45 * sin(uOndaT * 1.6 - giu * 0.7 + 1.0 + tono));
        f.z -= lunghi * uPasso * 0.32;
        vec3 w = vec3(cg * f.x + sg * f.z, f.y, -sg * f.x + cg * f.z) + uGruppoPos;
        vMondo = w;
        vTono = tono;
        vLungo = lungo;
        // riflesso: una fascia luminosa che scorre lungo la chioma mentre si muove
        vLuce = smoothstep(0.75, 1.0, sin(f.y * 1.6 - uOndaT * 1.2 + f.x * 0.8) * 0.5 + 0.5);
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uComparsa; uniform float uTaglio; uniform vec3 uCentro;
      uniform vec3 uChiaro; uniform vec3 uScuro; uniform vec3 uLuce;
      varying float vTono; varying float vLungo; varying vec3 vMondo; varying float vLuce;
      void main() {
        if (vMondo.y > uComparsa) discard;
        if (distance(vMondo, uCentro) < uTaglio) discard;
        vec3 col = mix(uScuro, uChiaro, vTono);
        col = mix(col, uLuce, vLuce * 0.55);
        // punte che sfumano, radici appena più tenui
        float a = (1.0 - smoothstep(0.8, 1.0, vLungo)) * (0.3 + 0.7 * smoothstep(0.0, 0.18, vLungo));
        gl_FragColor = vec4(col, a * 0.55);
      }`,
  });
  const linee = new LineSegments(geo, mat);
  linee.renderOrder = 6;
  linee.frustumCulled = false;
  return linee;
}
