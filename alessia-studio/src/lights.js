import * as THREE from 'three';
import { SUN_EXT, SUN_INT, PIT } from './layout.js';

// Luci della scena: due "soli" statici (esterno basso sul mare, interno dal lucernario),
// esposizione condivisa e mappe d'ombra calcolate una sola volta al caricamento.

export function createLights({ shadowInt = 1024 } = {}) {
  const uniforms = {
    uTime: { value: 0 },
    uExposure: { value: 1 },
    uSunExtDir: { value: new THREE.Vector3(...SUN_EXT.dir) },
    uSunExtColor: { value: new THREE.Color(SUN_EXT.color) },
    uSunExtI: { value: SUN_EXT.intensity },
    uSunIntDir: { value: new THREE.Vector3(...SUN_INT.dir) },
    uSunIntColor: { value: new THREE.Color(SUN_INT.color) },
    // in runtime un po' più tenue: con l'esposizione degli interni il cerchio resta leggibile, non bruciato
    uSunIntI: { value: SUN_INT.intensity * 0.7 },
    // modulazione lenta della luce (nuvole altissime che passano): rende viva la scena a scroll fermo
    uCloud: { value: 0 },
  };

  // le ombre principali sono nella lightmap; questa mappa (opzionale) rifinisce solo il pit
  const shadows = {};
  Object.defineProperty(shadows, 'int', { get() { return this._int || (this._int = makeShadow(shadowInt)); } });

  function makeShadow(size) {
    const depthTexture = new THREE.DepthTexture(size, size);
    depthTexture.compareFunction = THREE.LessEqualCompare;
    depthTexture.minFilter = depthTexture.magFilter = THREE.LinearFilter;
    const rt = new THREE.WebGLRenderTarget(size, size, { depthTexture, depthBuffer: true });
    rt.texture.generateMipmaps = false;
    const cam = new THREE.OrthographicCamera();
    return { rt, cam, matrix: new THREE.Matrix4(), texel: 1 / size, size };
  }

  // Inquadra la camera d'ombra sui punti dati, guardando lungo la direzione della luce.
  function fit(sh, dir, points, nearClipY = null) {
    const L = new THREE.Vector3(...dir).normalize();
    const center = new THREE.Vector3();
    points.forEach((p) => center.add(p));
    center.divideScalar(points.length);
    const cam = sh.cam;
    cam.position.copy(center).addScaledVector(L, 120);
    cam.up.set(0, 1, 0);
    if (Math.abs(L.y) > 0.9) cam.up.set(0, 0, -1);
    cam.lookAt(center);
    cam.updateMatrixWorld();
    const inv = cam.matrixWorldInverse;
    const box = new THREE.Box3();
    points.forEach((p) => box.expandByPoint(p.clone().applyMatrix4(inv)));
    cam.left = box.min.x - 0.5;
    cam.right = box.max.x + 0.5;
    cam.bottom = box.min.y - 0.5;
    cam.top = box.max.y + 0.5;
    cam.near = -box.max.z - 1;
    cam.far = -box.min.z + 1;
    if (nearClipY !== null) {
      // piano near sotto il soffitto: il soffitto non proietta ombra (lo fa il lucernario, in modo analitico)
      cam.near = Math.max(cam.near, 120 - (nearClipY - center.y) / L.y);
    }
    cam.updateProjectionMatrix();
    sh.matrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
      .multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);
  }

  // Disegna la mappa d'ombra una volta sola (scena statica).
  function bakeShadows(renderer, intCasters) {
    const corners = (b) => {
      const out = [];
      for (let i = 0; i < 8; i++) {
        out.push(new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z));
      }
      return out;
    };
    const intBox = new THREE.Box3(
      new THREE.Vector3(PIT.cx - PIT.half - 0.6, PIT.floorY - 0.1, PIT.cz - PIT.half - 0.6),
      new THREE.Vector3(PIT.cx + PIT.half + 0.6, 3.4, PIT.cz + PIT.half + 0.6),
    );
    fit(shadows.int, SUN_INT.dir, corners(intBox), 7.2);

    const mat = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
    const scene = new THREE.Scene();
    scene.overrideMaterial = mat;
    const prevTarget = renderer.getRenderTarget();
    const render = (sh, meshes) => {
      const proxies = meshes.map((m) => new THREE.Mesh(m.geometry, mat));
      meshes.forEach((m, i) => proxies[i].matrix.copy(m.matrixWorld));
      proxies.forEach((p) => {
        p.matrixAutoUpdate = false;
        p.frustumCulled = false;
        scene.add(p);
      });
      renderer.setRenderTarget(sh.rt);
      renderer.clear();
      renderer.render(scene, sh.cam);
      proxies.forEach((p) => scene.remove(p));
    };
    render(shadows.int, intCasters);
    renderer.setRenderTarget(prevTarget);
    mat.dispose();
  }

  const shadowUniforms = (sh) => ({
    uShadow: { value: sh.rt.depthTexture },
    uShadowMatrix: { value: sh.matrix },
    uShadowTexel: { value: sh.texel },
  });

  function update(time) {
    uniforms.uTime.value = time;
    // leggero respiro della luce: varia di pochi punti percentuali in decine di secondi
    uniforms.uCloud.value = time;
  }

  return { uniforms, shadows, bakeShadows, shadowUniforms, update };
}
