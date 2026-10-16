// Enredaderas que cuelgan de los balcones: hojas instanciadas con balanceo en el shader.
import * as THREE from 'three';
import { vineLeafCanvas } from '../../util/textures.js?v=2';

// strands: [{ x, y, z, len, nx, nz }] puntos de anclaje en el borde del balcón.
export function makeVines(strands, { maxLeaves = 2400, hq = true } = {}) {
  const tex = new THREE.CanvasTexture(vineLeafCanvas(hq ? 128 : 96));
  tex.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.PlaneGeometry(0.13, 0.17);
  geo.translate(0, -0.07, 0);
  const uTime = { value: 0 };
  const mat = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, color: '#ffffff' });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aSway;\nuniform float uTime;')
      .replace('#include <project_vertex>', /* glsl */`
        vec4 mvPosition = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif
        float sd = aSway.y * aSway.y;
        mvPosition.x += sin(uTime * 0.7 + aSway.x) * 0.06 * sd;
        mvPosition.z += cos(uTime * 0.53 + aSway.x * 1.3) * 0.05 * sd;
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;
      `);
  };
  const leaves = [];
  // reparte el presupuesto de hojas entre todas las ramas
  const total = strands.reduce((acc, s) => acc + s.len, 0);
  const spacing = Math.max(0.05, total / maxLeaves);
  for (const s of strands) {
    const n = Math.floor(s.len / spacing);
    const phase = Math.random() * 10;
    // mata frondosa donde la rama sale del balcón
    for (let k = 0; k < 9 && leaves.length < maxLeaves; k++) {
      leaves.push({
        x: s.x + s.nx * (0.03 + Math.random() * 0.12) + (Math.random() - 0.5) * 0.34 * Math.abs(s.nz),
        y: s.y + (Math.random() - 0.3) * 0.22,
        z: s.z + s.nz * (0.03 + Math.random() * 0.12) + (Math.random() - 0.5) * 0.34 * Math.abs(s.nx),
        ry: Math.random() * Math.PI * 2, rz: (Math.random() - 0.5) * 2.4, rx: (Math.random() - 0.5) * 1.2,
        s: 0.9 + Math.random() * 0.5, phase, d: 0,
      });
    }
    for (let i = 0; i < n; i++) {
      const d = i / Math.max(1, n - 1);
      // la rama se separa un poco del muro y zigzaguea
      const off = 0.04 + Math.sin(i * 0.9 + phase) * 0.03;
      leaves.push({
        x: s.x + s.nx * off + Math.sin(i * 1.7 + phase) * 0.04 + (Math.random() - 0.5) * 0.07,
        y: s.y - d * s.len,
        z: s.z + s.nz * off + Math.cos(i * 1.3 + phase) * 0.04 + (Math.random() - 0.5) * 0.07,
        ry: Math.random() * Math.PI * 2,
        rz: (i % 2 ? 1 : -1) * (0.5 + Math.random() * 0.6),
        rx: (Math.random() - 0.5) * 0.6,
        s: (0.75 + Math.random() * 0.55) * (1 - d * 0.35),
        phase, d,
      });
      if (leaves.length >= maxLeaves) break;
    }
    if (leaves.length >= maxLeaves) break;
  }
  const mesh = new THREE.InstancedMesh(geo, mat, leaves.length);
  const sway = new Float32Array(leaves.length * 2);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  const tint = new THREE.Color();
  leaves.forEach((l, i) => {
    e.set(l.rx, l.ry, l.rz);
    q.setFromEuler(e);
    m.compose(p.set(l.x, l.y, l.z), q, sc.set(l.s, l.s, l.s));
    mesh.setMatrixAt(i, m);
    sway[i * 2] = l.phase; sway[i * 2 + 1] = l.d;
    tint.setHSL(0.24 + Math.random() * 0.08, 0.32 + Math.random() * 0.2, 0.42 + Math.random() * 0.22);
    mesh.setColorAt(i, tint);
  });
  geo.setAttribute('aSway', new THREE.InstancedBufferAttribute(sway, 2));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  return { mesh, uTime };
}
