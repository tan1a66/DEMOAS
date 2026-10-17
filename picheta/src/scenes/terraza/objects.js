import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { materials, glowPoints, TERRACE } from './terrace.js';
import { wood, softDot } from '../../gl/textures.js';
import { SUN_DIR } from './sky.js';

// Objetos de la terraza que son el menú del sitio. Cada uno es un módulo
// independiente: build() devuelve { group, hit, anchor, focus } y se puede
// sustituir por un GLB real sin tocar el resto (ver README).
//   hit    → volumen invisible para el raycasting (más generoso que el objeto)
//   anchor → punto de la etiqueta
//   focus  → dónde se coloca la cámara al abrir la sección

const hitMat = new THREE.MeshBasicMaterial({ visible: false });

function hitBox(w, h, d, y = h / 2) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), hitMat);
  m.position.y = y;
  return m;
}

// ------------------------------------------------------------ material "grabado en madera"
// Tramado xilográfico que sigue la luz: líneas finas donde da el sol, gruesas
// y cruzadas en la sombra. Homenaje a Picheta grabador.
export function engravingMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uLight: { value: SUN_DIR.clone().setY(0.45).normalize() },
      uPaper: { value: new THREE.Color('#efe4cf') },
      uInk: { value: new THREE.Color('#2a1f18') },
      uDensity: { value: 70 },
      uGlow: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vObj;
      varying vec3 vN;
      varying vec3 vViewN;
      void main() {
        vObj = position;
        vN = normalize(mat3(modelMatrix) * normal);
        vViewN = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uLight, uPaper, uInk;
      uniform float uDensity, uGlow;
      varying vec3 vObj;
      varying vec3 vN;
      varying vec3 vViewN;
      float hatch(float coord, float thick) {
        float l = abs(fract(coord) - 0.5) * 2.0;
        float w = fwidth(coord) * 1.5;
        return 1.0 - smoothstep(thick - w, thick + w, l);
      }
      void main() {
        float lit = clamp(dot(normalize(vN), normalize(uLight)) * 0.5 + 0.5, 0.0, 1.0);
        // Las líneas se curvan con la forma (siguen la normal), como la gubia.
        float c1 = (vObj.y + vN.x * 0.035 + vN.z * 0.02) * uDensity;
        float ink = hatch(c1, mix(0.92, 0.06, lit));
        float c2 = (vObj.x * 0.7 - vObj.y * 0.7 + vN.y * 0.03) * uDensity * 1.1;
        ink = max(ink, hatch(c2, 0.55) * smoothstep(0.45, 0.2, lit));
        float c3 = (vObj.x * 0.7 + vObj.y * 0.7) * uDensity * 1.25;
        ink = max(ink, hatch(c3, 0.5) * smoothstep(0.3, 0.1, lit));
        // Contorno.
        float rim = 1.0 - abs(normalize(vViewN).z);
        ink = max(ink, smoothstep(0.72, 0.9, rim));
        vec3 col = mix(uPaper, uInk, ink);
        col += vec3(1.0, 0.72, 0.42) * uGlow * 0.18;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

// ------------------------------------------------------------ 1. Busto de Picheta → HISTORIA
export function buildBusto() {
  const group = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: '#d9ccb6', roughness: 0.95 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.7), stone);
  base.position.y = 0.06;
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.92, 0.48), stone);
  shaft.position.y = 0.58;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.62), stone);
  cap.position.y = 1.08;
  group.add(base, shaft, cap);

  const bust = new THREE.Group();
  bust.name = 'bust';
  const mat = engravingMaterial();
  // Hombros y pecho (perfil torneado, levemente aplanado de frente a espalda).
  const torsoProfile = [
    [0.0, 0], [0.2, 0], [0.24, 0.05], [0.25, 0.12], [0.2, 0.2], [0.11, 0.26], [0.07, 0.3], [0.0, 0.3],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const torso = new THREE.Mesh(new THREE.LatheGeometry(torsoProfile, 28), mat);
  torso.scale.set(1, 1, 0.62);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.1, 16), mat);
  neck.position.y = 0.33;
  const headGeo = new THREE.SphereGeometry(0.11, 32, 24);
  // Cabeza: alargada, frente amplia, mandíbula y nariz.
  const p = headGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i);
    let y = p.getY(i);
    let z = p.getZ(i);
    y *= 1.22;
    if (y < 0) {
      x *= 1 - Math.min(0.25, -y * 1.6);
      z *= 1 - Math.min(0.15, -y * 0.8);
    }
    const front = Math.max(0, z / 0.11);
    // Nariz.
    const nose = Math.exp(-((x * x) / 0.0004 + ((y + 0.005) ** 2) / 0.0016)) * front;
    z += nose * 0.035;
    // Bigote: un pequeño volumen bajo la nariz (Picheta lo llevaba poblado).
    const stache = Math.exp(-((x * x) / 0.0018 + ((y + 0.045) ** 2) / 0.00012)) * front;
    z += stache * 0.014;
    // Cuencas de los ojos.
    const eyes = Math.exp(-(((Math.abs(x) - 0.038) ** 2) / 0.0003 + ((y - 0.025) ** 2) / 0.0002)) * front;
    z -= eyes * 0.012;
    p.setXYZ(i, x, y, z);
  }
  headGeo.computeVertexNormals();
  const head = new THREE.Mesh(headGeo, mat);
  head.position.y = 0.48;
  // Pelo peinado hacia atrás.
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.115, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), mat);
  hair.position.set(0, 0.5, -0.012);
  hair.scale.set(1, 1.15, 1.05);
  bust.add(torso, neck, head, hair);
  bust.position.y = 1.12;
  bust.rotation.y = 0.5;
  group.add(bust);

  group.traverse((o) => (o.castShadow = true));
  const hit = hitBox(0.9, 1.9, 0.9);
  group.add(hit);
  return {
    group,
    hit,
    anchor: new THREE.Vector3(0, 1.95, 0),
    focus: { offset: new THREE.Vector3(0.9, 1.65, 1.5), target: new THREE.Vector3(0, 1.5, 0) },
    material: mat,
    update(t, glow) {
      mat.uniforms.uGlow.value = glow;
    },
  };
}

// ------------------------------------------------------------ 2. Cuchillos, mandil y tabla → AUTORES
export function buildCuchillos(logoTexture) {
  const M = materials();
  const group = new THREE.Group();
  const frame = new THREE.Group();
  // Panel de madera sobre dos patas.
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.9, 0.05), M.wood);
  board.position.y = 1.45;
  frame.add(board);
  for (const x of [-0.6, 0.6]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.9, 0.06), M.wood);
    leg.position.set(x, 0.95, -0.03);
    frame.add(leg);
  }
  // Barra imantada con cuatro cuchillos.
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.03), M.iron);
  bar.position.set(-0.15, 1.75, 0.045);
  frame.add(bar);
  const steel = new THREE.MeshStandardMaterial({ color: '#c9ccd0', metalness: 1, roughness: 0.25 });
  const blade = (len, wide) => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(wide, 0);
    s.quadraticCurveTo(wide, -len * 0.7, 0.004, -len);
    s.lineTo(0, -len * 0.95);
    s.lineTo(0, 0);
    return new THREE.ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: false });
  };
  [
    [0.22, 0.045],
    [0.3, 0.05],
    [0.17, 0.03],
    [0.26, 0.06],
  ].forEach(([len, wide], i) => {
    const k = new THREE.Group();
    const b = new THREE.Mesh(blade(len, wide), steel);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(wide * 0.75, 0.11, 0.022), M.iron);
    handle.position.set(wide / 2, 0.055, 0);
    k.add(b, handle);
    k.position.set(-0.48 + i * 0.2, 1.68, 0.06);
    frame.add(k);
  });
  // Mandil colgado de un gancho, con el doble círculo bordado.
  const apronGeo = new THREE.PlaneGeometry(0.42, 0.62, 8, 12);
  const ap = apronGeo.attributes.position;
  for (let i = 0; i < ap.count; i++) {
    const x = ap.getX(i);
    const y = ap.getY(i);
    ap.setZ(i, Math.sin(x * 22) * 0.012 + Math.max(0, -y) * 0.05);
    if (y > 0.18) ap.setX(i, x * (0.55 + (0.31 - y) * 1.5));
  }
  apronGeo.computeVertexNormals();
  const apron = new THREE.Mesh(
    apronGeo,
    new THREE.MeshStandardMaterial({ color: '#2d2a28', roughness: 1, side: THREE.DoubleSide }),
  );
  apron.position.set(0.42, 1.36, 0.07);
  frame.add(apron);
  if (logoTexture) {
    const emb = new THREE.Mesh(
      new THREE.PlaneGeometry(0.11, 0.11),
      new THREE.MeshBasicMaterial({ color: '#e9e2d6', alphaMap: logoTexture, transparent: true }),
    );
    emb.position.set(0.42, 1.42, 0.09);
    frame.add(emb);
  }
  // Tabla de picar apoyada en el suelo.
  const tshape = new THREE.Shape();
  const r = 0.05;
  tshape.moveTo(-0.22 + r, 0);
  tshape.lineTo(0.22 - r, 0);
  tshape.quadraticCurveTo(0.22, 0, 0.22, r);
  tshape.lineTo(0.22, 0.6);
  tshape.quadraticCurveTo(0.22, 0.66, 0.12, 0.66);
  tshape.lineTo(-0.12, 0.66);
  tshape.quadraticCurveTo(-0.22, 0.66, -0.22, 0.6);
  tshape.lineTo(-0.22, r);
  tshape.quadraticCurveTo(-0.22, 0, -0.22 + r, 0);
  const cut = new THREE.Mesh(new THREE.ExtrudeGeometry(tshape, { depth: 0.03, bevelEnabled: false }), M.woodLight);
  cut.position.set(-0.2, 0.0, 0.12);
  cut.rotation.x = -0.22;
  frame.add(cut);
  group.add(frame);
  group.traverse((o) => (o.castShadow = true));
  const hit = hitBox(1.5, 2, 0.8);
  group.add(hit);
  return {
    group,
    hit,
    anchor: new THREE.Vector3(0, 2.1, 0.1),
    focus: { offset: new THREE.Vector3(0, 1.55, 1.7), target: new THREE.Vector3(0, 1.4, 0) },
  };
}

// ------------------------------------------------------------ 3. Platillo humeante → MENÚ
export function buildPlato() {
  const M = materials();
  const group = new THREE.Group();
  const table = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.04, 32), M.wood);
  table.position.y = 0.75;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.73, 10), M.iron);
  stem.position.y = 0.37;
  group.add(table, stem);
  const plateProfile = [
    [0, 0], [0.09, 0], [0.1, 0.008], [0.16, 0.012], [0.17, 0.02], [0.165, 0.024], [0.1, 0.016], [0, 0.014],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const plate = new THREE.Mesh(new THREE.LatheGeometry(plateProfile, 32), new THREE.MeshStandardMaterial({ color: '#2b2928', roughness: 0.4 }));
  plate.position.y = 0.77;
  group.add(plate);
  // Cochinita: montículo deshebrado con cebolla morada encima.
  const meat = new THREE.MeshStandardMaterial({ color: '#7d3a1f', roughness: 0.8 });
  const onion = new THREE.MeshStandardMaterial({ color: '#c24a6a', roughness: 0.5 });
  const bits = [];
  for (let i = 0; i < 26; i++) {
    const g = new THREE.SphereGeometry(0.02 + Math.random() * 0.012, 6, 4);
    g.scale(1.6, 0.7, 1);
    g.rotateY(Math.random() * 3);
    const a = Math.random() * 6.28;
    const rr = Math.random() * 0.07;
    g.translate(Math.cos(a) * rr, 0.8 + Math.random() * 0.03, Math.sin(a) * rr);
    bits.push(g);
  }
  group.add(new THREE.Mesh(mergeGeometries(bits), meat));
  for (let i = 0; i < 7; i++) {
    const o = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 4, 10, Math.PI), onion);
    o.position.set((Math.random() - 0.5) * 0.08, 0.84, (Math.random() - 0.5) * 0.08);
    o.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    group.add(o);
  }
  // Tortillas en su servilleta.
  const tort = new THREE.MeshStandardMaterial({ color: '#d8c49a', roughness: 0.9 });
  for (let i = 0; i < 3; i++) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.006, 20), tort);
    t.position.set(0.28, 0.775 + i * 0.006, 0.05);
    group.add(t);
  }
  // Vapor: motas suaves que suben y se enroscan.
  const steamN = 46;
  const seeds = new Float32Array(steamN * 4).map(() => Math.random());
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(steamN * 3), 3));
  sg.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  const steamU = { uTime: { value: 0 }, uMap: { value: softDot() }, uPixelRatio: { value: 1 } };
  const steam = new THREE.Points(
    sg,
    new THREE.ShaderMaterial({
      uniforms: steamU,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        uniform float uTime, uPixelRatio;
        attribute vec4 aSeed;
        varying float vA;
        void main() {
          float t = fract(uTime * (0.16 + aSeed.x * 0.08) + aSeed.y);
          vec3 p = vec3((aSeed.z - 0.5) * 0.1, 0.83 + t * 0.55, (aSeed.w - 0.5) * 0.1);
          p.x += sin(t * 6.0 + aSeed.y * 10.0) * 0.04 * t;
          p.z += cos(t * 5.0 + aSeed.x * 10.0) * 0.04 * t;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (14.0 + t * 40.0) * uPixelRatio / -mv.z;
          vA = sin(t * 3.14159) * 0.22;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        varying float vA;
        void main() { gl_FragColor = vec4(vec3(0.97, 0.95, 0.92), texture2D(uMap, gl_PointCoord).r * vA); }
      `,
    }),
  );
  steam.frustumCulled = false;
  group.add(steam);
  group.traverse((o) => o.isMesh && (o.castShadow = true));
  const hit = hitBox(1.2, 1.4, 1.2);
  group.add(hit);
  return {
    group,
    hit,
    anchor: new THREE.Vector3(0, 1.35, 0),
    focus: { offset: new THREE.Vector3(-0.4, 1.45, 1.1), target: new THREE.Vector3(0, 0.8, 0) },
    steam: steamU,
    update(t) {
      steamU.uTime.value = t;
    },
  };
}

// ------------------------------------------------------------ 4. La mesa con la mejor vista → RESERVA
export function buildMesaVista() {
  const M = materials();
  const group = new THREE.Group();
  const table = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.7), M.wood);
  table.position.y = 0.75;
  group.add(table);
  for (const [x, z] of [
    [-0.34, -0.29],
    [0.34, -0.29],
    [-0.34, 0.29],
    [0.34, 0.29],
  ]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.73, 0.04), M.wood);
    leg.position.set(x, 0.365, z);
    group.add(leg);
  }
  // Mantel.
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.012, 0.42), M.cloth);
  cloth.position.set(0, 0.777, 0);
  group.add(cloth);
  // Vela encendida con su luz.
  const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 12), new THREE.MeshStandardMaterial({ color: '#f1e9d8' }));
  candle.position.set(0, 0.84, 0);
  const holder = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 16, 1, true), new THREE.MeshStandardMaterial({ color: '#d4a05e', transparent: true, opacity: 0.45 }));
  holder.position.set(0, 0.82, 0);
  const flame = glowPoints([new THREE.Vector3(0, 0.92, 0)], 0.9, new THREE.Color(1.0, 0.66, 0.3));
  flame.uniforms.uOn.value = 1;
  const light = new THREE.PointLight(0xffa860, 0.9, 3, 2);
  light.position.set(0, 0.98, 0);
  group.add(candle, holder, flame.points, light);
  // Copas.
  const glassProfile = [
    [0, 0], [0.035, 0], [0.035, 0.004], [0.004, 0.01], [0.004, 0.09], [0.03, 0.12], [0.038, 0.17], [0.036, 0.19],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const glassMat = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.1 });
  for (const x of [-0.2, 0.2]) {
    const g = new THREE.Mesh(new THREE.LatheGeometry(glassProfile, 16), glassMat);
    g.position.set(x, 0.775, -0.08);
    group.add(g);
  }
  // Dos sillas mirando a la catedral (de espaldas a la cámara).
  const chairParts = [];
  for (const x of [-0.24, 0.24]) {
    const seat = new THREE.BoxGeometry(0.4, 0.04, 0.4);
    seat.translate(x, 0.46, 0.5);
    const back = new THREE.BoxGeometry(0.4, 0.42, 0.03);
    back.translate(x, 0.7, 0.7);
    chairParts.push(seat, back);
    for (const [lx, lz] of [
      [-0.17, 0.33],
      [0.17, 0.33],
      [-0.17, 0.67],
      [0.17, 0.67],
    ]) {
      const leg = new THREE.BoxGeometry(0.03, 0.46, 0.03);
      leg.translate(x + lx, 0.23, lz);
      chairParts.push(leg);
    }
  }
  group.add(new THREE.Mesh(mergeGeometries(chairParts), M.woodLight));
  group.traverse((o) => o.isMesh && (o.castShadow = true));
  const hit = hitBox(1.1, 1.3, 1.6, 0.65);
  hit.position.z = 0.3;
  group.add(hit);
  return {
    group,
    hit,
    anchor: new THREE.Vector3(0, 1.3, 0),
    focus: { offset: new THREE.Vector3(0.2, 1.45, 1.9), target: new THREE.Vector3(0, 0.9, -1.5) },
    flame: flame.uniforms,
    light,
    update(t) {
      flame.uniforms.uTime.value = t;
      light.intensity = 0.8 + Math.sin(t * 9) * 0.08 + Math.sin(t * 23) * 0.05;
    },
  };
}

// ------------------------------------------------------------ 5. Copa sobre la barra → CONCURSO
export function buildTrofeo() {
  const M = materials();
  const group = new THREE.Group();
  const counter = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.05, 0.62), M.wood);
  counter.position.y = 0.525;
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.05, 0.7), new THREE.MeshStandardMaterial({ color: '#d8ccb8', roughness: 0.5 }));
  top.position.y = 1.075;
  group.add(counter, top);
  const gold = new THREE.MeshStandardMaterial({ color: '#d9a441', metalness: 1, roughness: 0.28, emissive: '#3a2408' });
  const cupProfile = [
    [0, 0], [0.07, 0], [0.07, 0.025], [0.03, 0.035], [0.018, 0.1], [0.025, 0.13], [0.07, 0.17], [0.09, 0.24], [0.088, 0.26], [0.06, 0.2], [0, 0.18],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const cup = new THREE.Mesh(new THREE.LatheGeometry(cupProfile, 28), gold);
  cup.position.set(0.3, 1.1, 0);
  const handleGeo = new THREE.TorusGeometry(0.045, 0.008, 6, 16, Math.PI * 1.2);
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(handleGeo, gold);
    h.position.set(0.3 + s * 0.085, 1.31, 0);
    h.rotation.z = s > 0 ? -0.6 : Math.PI + 0.6;
    group.add(h);
  }
  group.add(cup);
  // Botellas detrás, contra el muro.
  const bottleProfile = [
    [0, 0], [0.04, 0], [0.04, 0.2], [0.015, 0.26], [0.013, 0.32], [0, 0.32],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const bottleGeo = new THREE.LatheGeometry(bottleProfile, 10);
  const colors = ['#3b4a37', '#5b3b24', '#2c3240', '#6d5a3a', '#3b4a37', '#4a2a2a'];
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.03, 0.18), M.wood);
  shelf.position.set(-0.5, 1.45, -0.45);
  group.add(shelf);
  colors.forEach((c, i) => {
    const b = new THREE.Mesh(bottleGeo, new THREE.MeshStandardMaterial({ color: c, roughness: 0.15, metalness: 0.2 }));
    b.position.set(-1.0 + i * 0.18, 1.465, -0.45);
    group.add(b);
  });
  group.traverse((o) => o.isMesh && (o.castShadow = true));
  const hit = hitBox(1.2, 0.8, 0.9, 1.3);
  hit.position.x = 0.3;
  group.add(hit);
  return {
    group,
    hit,
    anchor: new THREE.Vector3(0.3, 1.65, 0),
    focus: { offset: new THREE.Vector3(0.1, 1.55, 1.3), target: new THREE.Vector3(0.3, 1.25, 0) },
    material: gold,
    update(t, glow) {
      gold.emissiveIntensity = 1 + glow * 2.5;
    },
  };
}

// ------------------------------------------------------------ 6. Tunkul con guirnalda → EVENTOS
export function buildTunkul() {
  const M = materials();
  const group = new THREE.Group();
  const logMat = new THREE.MeshStandardMaterial({ map: wood({ tint: '#7a5235', seed: 12, vertical: false }), roughness: 0.8 });
  const log = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 1.0, 24), logMat);
  log.rotation.z = Math.PI / 2;
  log.position.y = 0.62;
  group.add(log);
  // Ranura en H de las lengüetas que se golpean.
  const slot = new THREE.MeshBasicMaterial({ color: '#120d0a' });
  for (const z of [-0.05, 0.05]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.016), slot);
    s.position.set(0, 0.81, z);
    group.add(s);
  }
  const mid = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.02, 0.11), slot);
  mid.position.set(0, 0.81, 0);
  group.add(mid);
  // Caballete en X.
  for (const x of [-0.36, 0.36]) {
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.75, 0.05), M.wood);
      leg.position.set(x, 0.33, s * 0.1);
      leg.rotation.x = s * 0.45;
      group.add(leg);
    }
  }
  // Baquetas con punta de hule.
  for (const k of [-1, 1]) {
    const stick = new THREE.Group();
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.36, 6), M.woodLight);
    rod.rotation.z = Math.PI / 2;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), M.iron);
    tip.position.x = 0.18;
    stick.add(rod, tip);
    stick.position.set(k * 0.12, 0.83, 0.12 + k * 0.02);
    stick.rotation.y = 0.3 * k;
    group.add(stick);
  }
  // Guirnalda de luces en espiral.
  const pts = [];
  for (let i = 0; i < 26; i++) {
    const u = i / 25;
    const a = u * Math.PI * 6;
    pts.push(new THREE.Vector3(-0.5 + u, 0.62 + Math.sin(a) * 0.23, Math.cos(a) * 0.23));
  }
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.014, 6, 4), M.bulb, pts.length);
  const m4 = new THREE.Matrix4();
  pts.forEach((p, i) => bulbs.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z)));
  const wire = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.003, 3), M.iron);
  const glow = glowPoints(pts, 0.35, new THREE.Color(1.0, 0.75, 0.45));
  glow.uniforms.uOn.value = 1;
  group.add(bulbs, wire, glow.points);
  group.traverse((o) => o.isMesh && (o.castShadow = true));
  const hit = hitBox(1.3, 1.2, 0.8);
  group.add(hit);
  return {
    group,
    hit,
    anchor: new THREE.Vector3(0, 1.2, 0),
    focus: { offset: new THREE.Vector3(0.4, 1.3, 1.3), target: new THREE.Vector3(0, 0.65, 0) },
    update(t, glowAmt) {
      glow.uniforms.uTime.value = t;
      glow.uniforms.uOn.value = 1 + glowAmt;
    },
  };
}

// ------------------------------------------------------------ 7. Los dos círculos pintados en el piso → INICIO
export function buildLogoPiso(logoTexture) {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#f4efe6'),
    alphaMap: logoTexture,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.25), mat);
  decal.rotation.x = -Math.PI / 2;
  decal.position.y = 0.004;
  group.add(decal);
  const hit = hitBox(1.3, 0.25, 1.3, 0.1);
  group.add(hit);
  return {
    group,
    hit,
    anchor: new THREE.Vector3(0, 0.35, 0),
    focus: null, // vuelve a la intro
    update(t, glow) {
      mat.opacity = 0.62 + 0.1 * Math.sin(t * 2.6) + glow * 0.25;
    },
  };
}

// Posición de cada objeto en la terraza (y su sección).
export const PLACEMENT = [
  { id: 'historia', build: buildBusto, pos: [-5.5, 0, -1.2], rot: 0.7 },
  { id: 'autores', build: buildCuchillos, pos: [TERRACE.x1 - 0.55, 0, 0.4], rot: -Math.PI / 2 },
  { id: 'menu', build: buildPlato, pos: [2.2, 0, -1.5], rot: -0.3 },
  { id: 'reserva', build: buildMesaVista, pos: [-1.3, 0, -2.85], rot: 0.08 },
  { id: 'concurso', build: buildTrofeo, pos: [3.6, 0, TERRACE.z1 - 0.4], rot: Math.PI },
  { id: 'eventos', build: buildTunkul, pos: [-5.6, 0, 2.4], rot: Math.PI / 2 },
  { id: 'inicio', build: buildLogoPiso, pos: [0.5, 0, -1.4], rot: 0.15 },
];
