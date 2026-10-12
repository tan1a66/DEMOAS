import * as THREE from 'three';
import { project } from '../geo/projection.js';
import { NOISE, SKY } from './glsl.js';

// Textura de "cercanía a la costa": R = halo amplio (aguas someras turquesa),
// G = halo estrecho (espuma / arena de playa). Se genera una sola vez en un canvas.
function coastTexture(geojson, size) {
  const [minLng, minLat, maxLng, maxLat] = geojson.bbox;
  const [x0, z1] = project(minLng, minLat);
  const [x1, z0] = project(maxLng, maxLat);
  const bounds = new THREE.Vector4(x0, z0, x1, z1);

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#fff';
  for (const f of geojson.features) {
    for (const poly of f.geometry.coordinates) {
      ctx.beginPath();
      for (const ring of poly) {
        ring.forEach(([lng, lat], i) => {
          const [x, z] = project(lng, lat);
          const u = ((x - x0) / (x1 - x0)) * size;
          const v = ((z - z0) / (z1 - z0)) * size;
          i ? ctx.lineTo(u, v) : ctx.moveTo(u, v);
        });
        ctx.closePath();
      }
      ctx.fill('evenodd');
    }
  }
  const src = ctx.getImageData(0, 0, size, size);
  const mask = new Float32Array(size * size);
  for (let i = 0; i < mask.length; i++) mask[i] = src.data[i * 4] / 255;

  const wide = boxBlur(mask, size, Math.round(size / 70), 3);
  const narrow = boxBlur(mask, size, Math.max(1, Math.round(size / 400)), 2);

  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < mask.length; i++) {
    data[i * 4] = Math.min(255, wide[i] * 2.2 * 255);
    data[i * 4 + 1] = Math.min(255, narrow[i] * 2.0 * 255);
    data[i * 4 + 2] = mask[i] * 255;
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return { tex, bounds };
}

// Desenfoque de caja separable, repetido `passes` veces (≈ gaussiano).
function boxBlur(input, size, r, passes) {
  let a = Float32Array.from(input);
  let b = new Float32Array(a.length);
  const norm = 1 / (2 * r + 1);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < size; y++) {
      let acc = 0;
      const row = y * size;
      for (let x = -r; x <= r; x++) acc += a[row + Math.min(size - 1, Math.max(0, x))];
      for (let x = 0; x < size; x++) {
        b[row + x] = acc * norm;
        acc += a[row + Math.min(size - 1, x + r + 1)] - a[row + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < size; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += b[Math.min(size - 1, Math.max(0, y)) * size + x];
      for (let y = 0; y < size; y++) {
        a[y * size + x] = acc * norm;
        acc += b[Math.min(size - 1, y + r + 1) * size + x] - b[Math.max(0, y - r) * size + x];
      }
    }
  }
  return a;
}

export function buildSea(geojson, sunDir, { texSize = 1024 } = {}) {
  const { tex, bounds } = coastTexture(geojson, texSize);
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uSunDir: { value: sunDir },
      uCoast: { value: null },
      uBounds: { value: bounds },
      uDetail: { value: 1 },
    },
  ]);
  uniforms.uCoast.value = tex;
  uniforms.uSunDir.value = sunDir;

  const mat = new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec3 vWPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWPos = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform sampler2D uCoast;
      uniform vec4 uBounds;
      uniform float uDetail;
      varying vec3 vWPos;
      ${NOISE}
      ${SKY}

      float waves(vec2 p, float t) {
        float h = vnoise(p * 0.35 + vec2(t * 0.20, t * 0.12)) * 0.6;
        h += vnoise(p * 1.1 - vec2(t * 0.35, -t * 0.25)) * 0.3;
        h += vnoise(p * 3.7 + vec2(-t * 0.6, t * 0.5)) * 0.1 * uDetail;
        h += sin(p.x * 0.08 + p.y * 0.05 + t * 0.9) * 0.15;
        return h;
      }

      void main() {
        vec2 p = vWPos.xz;
        vec2 uv = (p - uBounds.xy) / (uBounds.zw - uBounds.xy);
        vec3 coast = vec3(0.0);
        if (all(greaterThan(uv, vec2(0.0))) && all(lessThan(uv, vec2(1.0)))) coast = texture2D(uCoast, uv).rgb;

        vec3 V = normalize(cameraPosition - vWPos);
        float dist = length(cameraPosition - vWPos);
        // Las olas se suavizan con la distancia para evitar aliasing.
        float amp = mix(0.55, 0.08, smoothstep(30.0, 900.0, dist));
        float t = uTime;
        float e = 0.25;
        float h0 = waves(p, t);
        vec3 n = normalize(vec3(-(waves(p + vec2(e, 0.0), t) - h0) / e * amp, 1.0,
                                -(waves(p + vec2(0.0, e), t) - h0) / e * amp));

        vec3 deep = vec3(0.04, 0.30, 0.40);
        vec3 mid = vec3(0.09, 0.56, 0.62);
        vec3 shallow = vec3(0.45, 0.85, 0.80);
        float s = coast.r;
        vec3 water = mix(deep, mid, smoothstep(0.02, 0.45, s));
        water = mix(water, shallow, smoothstep(0.45, 1.0, s));

        // Espuma suave en la línea de costa, animada.
        float foam = smoothstep(0.35, 0.9, coast.g) * (0.55 + 0.45 * vnoise(p * 2.5 + t * 0.6));
        water = mix(water, vec3(0.97, 0.95, 0.90), foam * 0.65);

        vec3 R = reflect(-V, n);
        R.y = abs(R.y);
        float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
        vec3 col = mix(water, skyColor(R), fres * 0.85);

        // Destellos del sol de atardecer.
        float sd = max(dot(R, uSunDir), 0.0);
        col += vec3(1.0, 0.78, 0.5) * (pow(sd, 380.0) * 2.4 + pow(sd, 40.0) * 0.18);

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000, 1, 1).rotateX(-Math.PI / 2), mat);
  mesh.name = 'sea';
  mesh.receiveShadow = false;
  return { mesh, uniforms };
}
