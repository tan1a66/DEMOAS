import * as THREE from 'three';

// Nubes ligeras de la intro: sprites con textura procedural.
// Solo en escritorio (en móvil se usa únicamente la niebla CSS).

function cloudTexture() {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26; i++) {
    const x = s * (0.25 + rnd() * 0.5);
    const y = s * (0.3 + rnd() * 0.4);
    const r = s * (0.12 + rnd() * 0.2);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,250,244,0.38)');
    g.addColorStop(1, 'rgba(255,250,244,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildClouds(count, center) {
  const group = new THREE.Group();
  if (!count) return { group, update() {} };
  const map = cloudTexture();
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const sprites = [];
  for (let i = 0; i < count; i++) {
    const mat = new THREE.SpriteMaterial({
      map,
      color: new THREE.Color().setHSL(0.08, 0.5, 0.92 + rnd() * 0.06),
      transparent: true,
      depthWrite: false,
      opacity: 0,
      fog: false,
    });
    const s = new THREE.Sprite(mat);
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * 520;
    s.position.set(center.x + Math.cos(a) * r, 260 + rnd() * 380, center.z + Math.sin(a) * r);
    const size = 220 + rnd() * 320;
    s.scale.set(size, size * 0.62, 1);
    s.userData.base = 0.55 + rnd() * 0.45;
    s.userData.drift = (rnd() - 0.5) * 3;
    sprites.push(s);
    group.add(s);
  }
  return {
    group,
    // Las nubes solo se ven mientras la cámara está alta; luego se ocultan (rendimiento).
    update(camera, dt) {
      const h = camera.position.y;
      const vis = THREE.MathUtils.smoothstep(h, 200, 420);
      group.visible = vis > 0.001;
      if (!group.visible) return;
      for (const s of sprites) {
        s.position.x += s.userData.drift * dt;
        // Se desvanecen al acercarse demasiado a la cámara.
        const d = s.position.distanceTo(camera.position);
        const near = THREE.MathUtils.smoothstep(d, 40, 220);
        s.material.opacity = s.userData.base * vis * near;
      }
    },
  };
}
