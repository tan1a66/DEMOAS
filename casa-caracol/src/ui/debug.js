import GUI from 'lil-gui';
import { MATCH_CUT } from '../story/matchcut.js';
import { CONFIG } from '../config.js';
import { U, setSkyColors } from '../gl/uniforms.js';
import { PHOTO_MODES } from '../gl/photoPass.js';

// ─────────────────────────────────────────────────────────────────────────────
//  Panel de depuración (solo con ?debug en la URL).
//  Con "Fijar en el corte" la cámara se queda en la pose del match cut y la foto se
//  superpone: se ajustan cámara/concha hasta que las puntas coinciden y se pulsa
//  "Copiar valores" → pegar en src/story/matchcut.js.
//  Los valores se guardan en este navegador mientras se ajustan (localStorage).
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'cc-matchcut-debug';
const r3 = (v) => Math.round(v * 1000) / 1000;
const r1 = (v) => Math.round(v * 10) / 10;

const deepAssign = (target, src) => {
  Object.keys(src).forEach((k) => {
    if (Array.isArray(src[k])) target[k] = src[k].slice();
    else if (src[k] && typeof src[k] === 'object') deepAssign(target[k], src[k]);
    else target[k] = src[k];
  });
};

const snapshot = () => JSON.parse(JSON.stringify(MATCH_CUT));

export const formatMatchCut = (mc = MATCH_CUT) => `export const MATCH_CUT = {
  camera: {
    position: [${mc.camera.position.map(r3).join(', ')}],
    rotation: [${mc.camera.rotation.map(r1).join(', ')}],
    fov: ${r1(mc.camera.fov)},
  },
  photo: {
    focus: [${mc.photo.focus.map(r3).join(', ')}],
  },
  shell: {
    scale: ${r3(mc.shell.scale)},
    rotation: [${mc.shell.rotation.map(r1).join(', ')}],
    position: [${mc.shell.position.map(r3).join(', ')}],
  },
  sky: {
    zenith: '${mc.sky.zenith}',
    horizon: '${mc.sky.horizon}',
  },
};`;

const showCopyBox = (text) => {
  let box = document.getElementById('cc-copybox');
  if (!box) {
    box = document.createElement('div');
    box.id = 'cc-copybox';
    box.innerHTML = '<textarea readonly></textarea><button type="button">Cerrar</button>';
    box.querySelector('button').addEventListener('click', () => box.remove());
    document.body.appendChild(box);
  }
  const ta = box.querySelector('textarea');
  ta.value = text;
  ta.focus();
  ta.select();
};

export const initDebug = ({ world, rig, story, stage, refreshPhoto }) => {
  const defaults = snapshot();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved) deepAssign(MATCH_CUT, saved);
  } catch {
    /* sin almacenamiento */
  }

  const debug = { lock: true, mode: 'mezcla', overlay: 0.5, fps: '' };
  const modeMap = { mezcla: PHOTO_MODES.mix, bordes: PHOTO_MODES.edges, parpadeo: PHOTO_MODES.blink };
  debug.photoMode = () => modeMap[debug.mode];

  let placeholderTimer = 0;
  const apply = () => {
    setSkyColors(MATCH_CUT.sky.zenith, MATCH_CUT.sky.horizon);
    world.applyShellTransform();
    rig.invalidate();
    world.photo.setPose(rig.photoPose.quaternion, rig.photoPose.fov);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(MATCH_CUT));
    } catch {
      /* sin almacenamiento */
    }
    if (world.photo.isPlaceholder) {
      clearTimeout(placeholderTimer);
      placeholderTimer = setTimeout(refreshPhoto, 220);
    }
  };

  const gui = new GUI({ title: 'Match cut · debug' });
  gui.domElement.classList.add('cc-gui');

  const view = gui.addFolder('Vista');
  view.add(debug, 'lock').name('Fijar en el corte');
  view.add(debug, 'mode', Object.keys(modeMap)).name('Foto encima');
  view.add(debug, 'overlay', 0, 1, 0.01).name('Opacidad foto');
  view.add(debug, 'fps').name('fps / dpr').disable().listen();

  const cam = gui.addFolder('Cámara del corte');
  const c = MATCH_CUT.camera;
  ['x', 'y', 'z'].forEach((axis, i) => cam.add(c.position, i, -4, 4, 0.001).name(`posición ${axis}`).onChange(apply));
  ['inclinación X', 'giro Y', 'alabeo Z'].forEach((label, i) =>
    cam.add(c.rotation, i, -180, 180, 0.1).name(`${label} °`).onChange(apply),
  );
  cam.add(c, 'fov', 15, 110, 0.1).name('FOV foto (vertical) °').onChange(apply);
  cam.add(MATCH_CUT.photo.focus, 0, 0, 1, 0.001).name('foco foto x').onChange(apply);
  cam.add(MATCH_CUT.photo.focus, 1, 0, 1, 0.001).name('foco foto y').onChange(apply);

  const shell = gui.addFolder('Concha');
  const s = MATCH_CUT.shell;
  shell.add(s, 'scale', 0.2, 3, 0.001).name('escala').onChange(apply);
  ['X', 'Y', 'Z'].forEach((axis, i) => shell.add(s.rotation, i, -180, 180, 0.1).name(`giro ${axis} °`).onChange(apply));
  ['x', 'y', 'z'].forEach((axis, i) => shell.add(s.position, i, -2, 2, 0.001).name(`posición ${axis}`).onChange(apply));

  const sky = gui.addFolder('Cielo 3D');
  sky.addColor(MATCH_CUT.sky, 'zenith').name('cénit').onChange(apply);
  sky.addColor(MATCH_CUT.sky, 'horizon').name('horizonte').onChange(apply);
  sky.close();

  const fx = gui.addFolder('Cáusticas');
  fx.add(U.uCausticIntensity, 'value', 0, 1.5, 0.01).name('arena seca');
  fx.add(U.uCausticWater, 'value', 0, 2, 0.01).name('bajo el agua');
  fx.add(U.uCausticScale, 'value', 0.8, 6, 0.01).name('tamaño baldosa');
  fx.add(world.caustics, 'speed', 0, 2, 0.01).name('velocidad');
  fx.close();

  const actions = {
    copy: async () => {
      const text = formatMatchCut();
      console.log(text);
      try {
        await navigator.clipboard.writeText(text);
        actions.copyLabel.name('✓ Copiado: pégalo en src/story/matchcut.js');
      } catch {
        showCopyBox(text);
      }
    },
    show: () => showCopyBox(formatMatchCut()),
    goToCut: () => {
      const { trigger, total, marks } = story;
      const y = trigger.start + (marks.tDescent1 / total) * (trigger.end - trigger.start);
      debug.lock = false;
      gui.controllersRecursive().forEach((ctl) => ctl.updateDisplay());
      window.scrollTo({ top: y, behavior: 'smooth' });
    },
    reset: () => {
      deepAssign(MATCH_CUT, defaults);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* nada */
      }
      gui.controllersRecursive().forEach((ctl) => ctl.updateDisplay());
      apply();
    },
  };
  actions.copyLabel = gui.add(actions, 'copy').name('Copiar valores');
  gui.add(actions, 'show').name('Ver valores (texto)');
  gui.add(actions, 'goToCut').name('Ver el corte con scroll');
  gui.add(actions, 'reset').name('Volver a los valores del código');

  // fps
  let frames = 0;
  let last = performance.now();
  const meter = () => {
    frames += 1;
    const now = performance.now();
    if (now - last > 1000) {
      debug.fps = `${Math.round((frames * 1000) / (now - last))} fps · dpr ${stage.dpr}`;
      frames = 0;
      last = now;
    }
    requestAnimationFrame(meter);
  };
  requestAnimationFrame(meter);

  apply();
  console.info('[casa-caracol] debug activo. Valores del corte:\n' + formatMatchCut());
  window.__cc = { MATCH_CUT, rig, world, story, debug, formatMatchCut, CONFIG, apply };
  return debug;
};
