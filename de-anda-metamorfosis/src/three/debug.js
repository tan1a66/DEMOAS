// =============================================================================
//  debug.js — attivo con ?debug nell'indirizzo
// =============================================================================
//  - percorso del drone (oro) e punti guardati (blu), con le tappe
//  - sfere delle zone interattive
//  - pannello con fps, scroll, scolpire, capitolo
//  - tasto O: vista dall'alto libera (OrbitControls) per vedere tutto il percorso

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PATH } from '../drone-path.js';

export function createDebug({ scene, camera, renderer, drone, statue }) {
  const group = new THREE.Group();
  group.name = 'debug';
  scene.add(group);

  function drawPath() {
    group.clear();
    const posPts = drone.posCurve.getPoints(400);
    const tgtPts = drone.targetCurve.getPoints(400);
    const line = (pts, color) =>
      new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, toneMapped: false }));
    group.add(line(posPts, 0xb8915a), line(tgtPts, 0x3b6fd8));
    drone.shots.forEach((s, i) => {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), new THREE.MeshBasicMaterial({ color: 0xb8915a, depthTest: false, toneMapped: false }));
      dot.position.copy(s.pos);
      const t = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 6), new THREE.MeshBasicMaterial({ color: 0x3b6fd8, depthTest: false, toneMapped: false }));
      t.position.copy(s.target);
      const link = line([s.pos, s.target], 0xd9c7a7);
      dot.renderOrder = t.renderOrder = 999;
      dot.userData.label = `${i} · ${PATH[i].at}`;
      group.add(dot, t, link);
    });
    // zone
    for (const z of statue.zones) {
      const sph = new THREE.Mesh(
        new THREE.SphereGeometry(z.radius, 18, 12),
        new THREE.MeshBasicMaterial({ color: 0xd7a85f, wireframe: true, transparent: true, opacity: 0.8, toneMapped: false })
      );
      sph.position.copy(z.center);
      const anchor = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3b30, toneMapped: false }));
      anchor.position.copy(z.anchor);
      statue.root.add(sph, anchor);
    }
  }
  drawPath();

  // ---- pannello ----
  const hud = document.createElement('pre');
  hud.className = 'debug-hud';
  document.body.appendChild(hud);

  // ---- vista dall'alto ----
  const overview = new THREE.PerspectiveCamera(40, 1, 0.05, 200);
  overview.position.set(9, 14, 12);
  const controls = new OrbitControls(overview, renderer.domElement);
  controls.target.set(0, 0.8, 0);
  controls.enabled = false;
  let useOverview = false;
  window.addEventListener('keydown', (e) => {
    if (e.key === 'o' || e.key === 'O') {
      useOverview = !useOverview;
      controls.enabled = useOverview;
      document.body.classList.toggle('debug-overview', useOverview);
    }
  });

  let frames = 0, acc = 0, fps = 0;
  return {
    rebuild: drawPath,
    get camera() {
      if (!useOverview) return camera;
      overview.aspect = camera.aspect;
      overview.updateProjectionMatrix();
      controls.update();
      return overview;
    },
    update(dt, info) {
      frames++;
      acc += dt;
      if (acc > 0.5) {
        fps = Math.round(frames / acc);
        frames = 0;
        acc = 0;
      }
      hud.textContent =
        `fps ${fps}   dpr ${renderer.getPixelRatio().toFixed(2)}   dof ${info.dofOn ? 'on' : 'off'}\n` +
        `scroll ${info.scroll.toFixed(4)}   ${info.chapter} ${info.chapterProgress.toFixed(3)}\n` +
        `sole ${info.sculpt.toFixed(2)}   levigatura ${info.polish.toFixed(3)}\n` +
        `triangoli ${renderer.info.render.triangles.toLocaleString('it')}\n` +
        `camera ${camera.position.toArray().map((v) => v.toFixed(2)).join(', ')}\n` +
        `O = vista dall'alto`;
    },
  };
}
