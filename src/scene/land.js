import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { project, LAND_TOP, CONTEXT_TOP, toVec3 } from '../geo/projection.js';
import { NOISE } from './glsl.js';

const BASE = 3; // la tierra baja por debajo del mar para no dejar huecos

const ringToPoints = (ring) =>
  ring.map(([lng, lat]) => {
    const [x, z] = project(lng, lat);
    return new THREE.Vector2(x, -z); // y de la forma = norte
  });

function shapesOf(feature) {
  return feature.geometry.coordinates.map((poly) => {
    const shape = new THREE.Shape(ringToPoints(poly[0]));
    poly.slice(1).forEach((hole) => shape.holes.push(new THREE.Path(ringToPoints(hole))));
    return shape;
  });
}

function extrude(shapes, top) {
  const bevel = 0.35;
  const geo = new THREE.ExtrudeGeometry(shapes, {
    depth: top + BASE - bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: 0.5,
    bevelSegments: 2,
    curveSegments: 1,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -BASE, 0);
  geo.computeBoundingSphere();
  return geo;
}

// Material arena con relieve estilizado (hillshade por ruido) y trama urbana sutil.
function landMaterial({ tint, relief, cities }) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0 });
  const uniforms = {
    uTint: { value: new THREE.Color(tint) },
    uRelief: { value: relief },
    uCities: { value: cities.map((c) => new THREE.Vector4(c.x, c.z, c.r, 0)) },
    uFocus: { value: 0 }, // 0 = vista lejana, 1 = zoom de ciudad (muestra trama urbana)
  };
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNormal;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
         vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
         vWNormal = normalize(mat3(modelMatrix) * objectNormal);`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vWPos;
         varying vec3 vWNormal;
         uniform vec3 uTint;
         uniform float uRelief;
         uniform float uFocus;
         uniform vec4 uCities[3];
         ${NOISE}
         float relief(vec2 p) {
           float h = fbm(p * 0.018) * 1.0 + fbm(p * 0.11) * 0.35 + fbm(p * 0.6) * 0.08;
           // Sierrita de Ticul / Puuc: un poco más de relieve al sur de Mérida
           float puuc = exp(-pow(length((p - vec2(-100.0, 8.0)) / vec2(80.0, 30.0)), 2.0));
           return h * (1.0 + puuc * 2.5);
         }
         float cityGrid(vec2 p) {
           float g = 0.0;
           for (int i = 0; i < 3; i++) {
             vec4 c = uCities[i];
             float d = length(p - c.xy);
             float m = 1.0 - smoothstep(c.z * 0.4, c.z, d);
             vec2 q = (p - c.xy) * 3.2;
             vec2 gv = abs(fract(q) - 0.5);
             float line = 1.0 - smoothstep(0.0, 0.06, min(gv.x, gv.y));
             g = max(g, line * m);
           }
           return g;
         }`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         {
           float top = smoothstep(0.6, 0.95, vWNormal.y);
           float n = fbm(vWPos.xz * 0.02);
           float n2 = fbm(vWPos.xz * 0.15 + 3.0);
           vec3 sand = uTint;
           vec3 sage = vec3(0.80, 0.81, 0.70);
           vec3 clay = vec3(0.82, 0.72, 0.60);
           vec3 col = mix(sand, sage, smoothstep(0.45, 0.78, n) * 0.4);
           col *= 0.97 + n2 * 0.06;
           col = mix(clay * 0.9, col, top);
           col = mix(col, vec3(1.0, 0.98, 0.94), cityGrid(vWPos.xz) * 0.7 * uFocus * top);
           diffuseColor.rgb = col;
         }`
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
         if (vWNormal.y > 0.7 && uRelief > 0.0) {
           float e = 0.8;
           vec2 p = vWPos.xz;
           float h0 = relief(p);
           float hx = relief(p + vec2(e, 0.0));
           float hz = relief(p + vec2(0.0, e));
           vec3 nW = normalize(vec3(-(hx - h0) / e * uRelief, 1.0, -(hz - h0) / e * uRelief));
           normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
         }`
      );
  };
  return mat;
}

function borderLines(features, resolution) {
  const group = new THREE.Group();
  const mat = new LineMaterial({
    color: 0xfffaf0,
    linewidth: 1.1,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    resolution,
  });
  for (const f of features) {
    for (const poly of f.geometry.coordinates) {
      const ring = poly[0];
      if (ring.length < 20) continue; // islotes: sin contorno
      const pos = [];
      [...ring, ring[0]].forEach(([lng, lat]) => {
        const [x, z] = project(lng, lat);
        pos.push(x, LAND_TOP + 0.04, z);
      });
      const geo = new LineGeometry();
      geo.setPositions(pos);
      const line = new Line2(geo, mat);
      line.computeLineDistances();
      line.renderOrder = 2;
      group.add(line);
    }
  }
  group.userData.material = mat;
  return group;
}

export function buildLand(geojson, places, resolution) {
  const group = new THREE.Group();
  const main = geojson.features.filter((f) => f.properties.main);
  const context = geojson.features.filter((f) => !f.properties.main);

  const cityR = { merida: 11, playa: 4.5, costa: 3 };
  const cities = places.ciudades.map((c) => {
    const v = toVec3(c);
    return { x: v.x, z: v.z, r: cityR[c.id] ?? 3 };
  });

  const mainMat = landMaterial({ tint: 0xf3e9d6, relief: 1.5, cities });
  const mainMesh = new THREE.Mesh(extrude(main.flatMap(shapesOf), LAND_TOP), mainMat);
  mainMesh.receiveShadow = true;
  mainMesh.name = 'peninsula';
  group.add(mainMesh);

  const ctxMat = landMaterial({ tint: 0xe4dccf, relief: 0.7, cities: [{ x: 9e9, z: 9e9, r: 1 }, { x: 9e9, z: 9e9, r: 1 }, { x: 9e9, z: 9e9, r: 1 }] });
  const ctxMesh = new THREE.Mesh(extrude(context.flatMap(shapesOf), CONTEXT_TOP), ctxMat);
  ctxMesh.receiveShadow = true;
  group.add(ctxMesh);

  const borders = borderLines(main, resolution);
  group.add(borders);

  return {
    group,
    mainMesh,
    borders,
    materials: [mainMat, ctxMat],
    setFocus(v) {
      mainMat.userData.uniforms.uFocus.value = v;
    },
  };
}
