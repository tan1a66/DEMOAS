// Render, luz de día, cielo yucateco y sombra única que sigue a la cámara.
import * as THREE from 'three';
import { createMaterials, uniforms } from './materials.js';
import { setMaxAnisotropy } from './textures.js';
import { buildHouse } from './house.js';
import { buildPlants } from './plants.js';
import { buildFurniture } from './furniture.js';
import { buildAO } from './ao.js';
import { buildCurtain } from './foliage.js';

const SUN_DIR = new THREE.Vector3(0.45, 0.72, 0.53).normalize();

function skyDome() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color('#4f8fcb') },
      mid: { value: new THREE.Color('#9cc3e3') },
      horizon: { value: new THREE.Color('#e8f0f1') },
      sun: { value: SUN_DIR.clone() },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * p;
        gl_Position.z = gl_Position.w; // siempre al fondo
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 sun;
      varying vec3 vDir;
      void main() {
        float h = max(vDir.y, 0.0);
        vec3 c = mix(horizon, mid, smoothstep(0.0, 0.22, h));
        c = mix(c, top, smoothstep(0.18, 0.85, h));
        float s = max(dot(normalize(vDir), sun), 0.0);
        c += vec3(1.0, 0.93, 0.8) * (pow(s, 64.0) * 0.35 + pow(s, 8.0) * 0.06);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), mat);
  m.frustumCulled = false;
  m.renderOrder = -10;
  return m;
}

export class World {
  constructor(canvas, { mobile = false } = {}) {
    this.mobile = mobile;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false, stencil: false });
    const r = this.renderer;
    this.maxDpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = this.maxDpr;
    r.setPixelRatio(this.dpr);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    setMaxAnisotropy(r.capabilities.getMaxAnisotropy());

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#e8f0f1');
    this.scene.fog = new THREE.Fog('#e4ecee', 70, 320);
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 900);
    this.shift = { x: 0, y: 0 };

    // luces
    this.hemi = new THREE.HemisphereLight('#dfeaf5', '#e9e1d3', 1.9);
    this.sun = new THREE.DirectionalLight('#fff3df', 3.6);
    this.fill = new THREE.DirectionalLight('#fff1de', 0.55);
    this.fill.position.set(-0.4, 0.35, -0.6);
    const sun = this.sun;
    sun.castShadow = true;
    const size = mobile ? 1536 : 2048;
    sun.shadow.mapSize.set(size, size);
    this.shadowHalf = 17;
    const sc = sun.shadow.camera;
    sc.left = -this.shadowHalf; sc.right = this.shadowHalf; sc.top = this.shadowHalf; sc.bottom = -this.shadowHalf;
    sc.near = 1; sc.far = 140;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.035;
    this.scene.add(this.hemi, sun, sun.target, this.fill);
    this._lightRot = new THREE.Matrix4().lookAt(SUN_DIR, new THREE.Vector3(), new THREE.Vector3(0, 1, 0));
    this._lightRotInv = this._lightRot.clone().invert();

    this.scene.add(skyDome());
    this.clouds = [];

    // cielo como luz ambiental para los materiales con brillo (mármol, vidrio, hojas)
    this.env = this._environment();
    this.scene.environment = this.env;

    const { m } = createMaterials();
    this.M = m;
    m.marmol.envMapIntensity = 0.22;
    m.marmol.roughness = 0.5;
    m.marmolSombra.envMapIntensity = 0.14;
    m.marmolSombra.roughness = 0.45;
    m.vidrio.envMapIntensity = 1.1;
    const root = new THREE.Group();
    this.scene.add(root);
    this.house = buildHouse(root, m);
    this.plants = buildPlants(root, m, { quality: mobile ? 0.85 : 1 });
    this.furniture = buildFurniture(root, m);
    buildAO(root, { pots: this.plants.pots, tables: this.furniture.tables });
    this.curtain = buildCurtain(this.env);
    this.scene.add(this.curtain.group);
    this._addClouds();
    this.root = root;
  }

  _environment() {
    const envScene = new THREE.Scene();
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec3 vD;
        void main(){
          float h = vD.y;
          vec3 sky = mix(vec3(0.86,0.91,0.93), vec3(0.42,0.62,0.84), smoothstep(0.0, 0.7, h));
          vec3 ground = mix(vec3(0.86,0.82,0.74), vec3(0.62,0.58,0.5), smoothstep(0.0, -0.6, h));
          vec3 c = h > 0.0 ? sky : ground;
          float s = max(dot(vD, normalize(vec3(0.45,0.72,0.53))), 0.0);
          c += vec3(1.0,0.95,0.85) * pow(s, 40.0) * 2.0;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 24, 12), mat));
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const tex = pmrem.fromScene(envScene, 0, 0.1, 50).texture;
    pmrem.dispose();
    return tex;
  }

  _addClouds() {
    const pos = [[-120, 95, -260], [60, 110, -300], [200, 90, -150], [-230, 80, -60], [140, 120, -320], [-60, 100, -340], [0, 85, 280], [-150, 90, 220]];
    for (const [x, y, z] of pos) {
      const s = new THREE.Sprite(this.M.nube);
      s.position.set(x, y, z);
      s.scale.set(110, 44, 1);
      this.scene.add(s);
      this.clouds.push(s);
    }
  }

  resize(w, h, shift) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    const portrait = w / h < 0.8;
    this.camera.fov = portrait ? 64 : w / h < 1.25 ? 56 : 48;
    if (shift) this.shift = shift;
    this._applyProjection();
  }

  _applyProjection() {
    const c = this.camera;
    c.updateProjectionMatrix();
    c.projectionMatrix.elements[8] = -this.shift.x;
    c.projectionMatrix.elements[9] = -this.shift.y;
    c.projectionMatrixInverse.copy(c.projectionMatrix).invert();
  }

  setDpr(d) {
    this.dpr = d;
    this.renderer.setPixelRatio(d);
    const s = this.renderer.getSize(new THREE.Vector2());
    this.renderer.setSize(s.x, s.y, false);
  }

  // La sombra cubre ~34 m alrededor de lo que se mira; se ajusta a la rejilla de texeles (sin parpadeo).
  updateShadow() {
    const c = this.camera;
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(c.quaternion);
    f.y = 0; f.normalize();
    const focus = c.position.clone().addScaledVector(f, 9);
    focus.y = 1.5;
    const ls = focus.clone().applyMatrix4(this._lightRotInv);
    const texel = (this.shadowHalf * 2) / this.sun.shadow.mapSize.x;
    ls.x = Math.round(ls.x / texel) * texel;
    ls.y = Math.round(ls.y / texel) * texel;
    const snapped = ls.applyMatrix4(this._lightRot);
    this.sun.target.position.copy(snapped);
    this.sun.position.copy(snapped).addScaledVector(SUN_DIR, 70);
    this.sun.target.updateMatrixWorld();
  }

  update(time, state) {
    uniforms.uTime.value = time;
    if (state) {
      const g = Math.min(1, Math.max(0, Math.max(state.gate, this.gateOverride || 0)));
      this.house.gateL.rotation.y = g * 1.72;
      this.house.gateR.rotation.y = -g * 1.72;
      const d = Math.min(1, Math.max(0, state.doors));
      this.house.doorL.rotation.y = d * 1.62;
      this.house.doorR.rotation.y = -d * 1.62;
      this.furniture.setEvent(state.event);
    }
    this.furniture.updateFans(time);
    for (let i = 0; i < this.clouds.length; i++) this.clouds[i].position.x += 0.012 * (1 + (i % 3) * 0.3);
    this.updateShadow();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
