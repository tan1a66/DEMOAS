// Fotos con profundidad (2.5D): cada foto lleva un mapa de profundidad (Depth Anything V2) y la
// cámara se mueve "dentro" de ella. Las guirnaldas pasan por delante de la catedral, la catedral
// por delante del cielo; el titular vive en un plano entre el cielo y las torres.
//
// Mapas de profundidad (public/hero/*-depth.png, gris: blanco cerca, negro cielo): salida de
// Depth Anything V2 (profundidad inversa) normalizada, con curva d' = ((d - 0.008) / 0.992)^0.42
// (separa catedral, árboles y cielo), dilatación de 7 px (5 en la cocina: lo cercano se mueve
// como una pieza, con un halo de cielo) y desenfoque de 1,2 px.
//
// Un solo pase WebGL2 a pantalla completa:
//   · paralaje con oclusión (parallax occlusion mapping) sobre el mapa de profundidad;
//   · cuatro luces de la terraza fundidas por pesos, cocina vertical para la película;
//   · vida: bombillas que titilan con halo (de noche), llamas que bailan y calor sobre el fogón,
//     cielo con nubes que avanzan y estrellas que titilan, zanates, grano de película.

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;

uniform sampler2D uPlate0, uPlate1, uPlate2, uPlate3, uDepthT;
uniform vec4 uW;          // pesos de las cuatro luces
uniform vec4 uMapT;       // píxel de pantalla -> uv: origen.xy, escala.zw
uniform vec4 uCamT;       // cámara: desplazamiento.xy, dolly, foco
uniform vec2 uDollyCT;    // centro del dolly (uv)

uniform sampler2D uKitchen, uDepthK;
uniform vec4 uMapK, uCamK;
uniform vec2 uDollyCK;
uniform float uKitchenA;

uniform sampler2D uText;  // R/G: líneas 1 y 2 · B/A: sus sombras
uniform vec2 uTextA;      // opacidad de cada línea
uniform vec2 uTextY;      // desplazamiento vertical de cada línea (px)
uniform float uTextDepth; // profundidad del plano del titular (0 cielo … 1 primer plano)
uniform vec3 uInk;
uniform float uInkDark;   // 0 tinta crema con sombra · 1 tinta oscura con halo claro

uniform float uNight;     // bombillas encendidas (0–1)
uniform float uSkyFlow;   // nubes en movimiento (0–1)
uniform vec4 uBirds[7];   // x, y (px), tamaño (px), fase del aleteo
uniform float uBirdA;
uniform float uFade;      // fundido a negro (scroll)

out vec4 outColor;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

// Paralaje con oclusión: busca, de cerca a lejos, la superficie que se ve en este píxel.
// Un punto de profundidad d se desplaza off * (d - foco) en pantalla.
vec2 pom(sampler2D depth, vec2 uv0, vec2 off, float focus, const int N, out float hit) {
  float prevZ = 1.0;
  float prevD = texture(depth, uv0 - off * (1.0 - focus)).r;
  if (prevD >= 1.0) { hit = 1.0; return uv0 - off * (1.0 - focus); }
  for (int i = 1; i <= 28; i++) {
    if (i > N) break;
    float z = 1.0 - float(i) / float(N);
    vec2 uv = uv0 - off * (z - focus);
    float d = texture(depth, uv).r;
    if (d >= z) {
      float a = prevD - prevZ, b = d - z;
      float zz = mix(prevZ, z, a / (a - b));
      hit = zz;
      return uv0 - off * (zz - focus);
    }
    prevZ = z;
    prevD = d;
  }
  hit = 0.0;
  return uv0 + off * focus;
}

vec3 plates(vec2 uv, float lod) {
  vec3 c = vec3(0.0);
  if (uW.x > 0.001) c += uW.x * textureLod(uPlate0, uv, lod).rgb;
  if (uW.y > 0.001) c += uW.y * textureLod(uPlate1, uv, lod).rgb;
  if (uW.z > 0.001) c += uW.z * textureLod(uPlate2, uv, lod).rgb;
  if (uW.w > 0.001) c += uW.w * textureLod(uPlate3, uv, lod).rgb;
  return c;
}

vec3 terrace(vec2 p, out float hit) {
  vec2 uv0 = uMapT.xy + p * uMapT.zw;
  vec2 off = uCamT.xy + (uv0 - uDollyCT) * uCamT.z;
  vec2 uv = pom(uDepthT, uv0, off, uCamT.w, 28, hit);
  uv = clamp(uv, 0.0, 1.0);
  vec3 c = plates(uv, 0.0);
  // Cielo vivo: las nubes de la foto avanzan despacio (flujo en dos fases que se relevan),
  // solo donde todo es cielo; si la muestra cae en un edificio, se queda la original.
  float sky = 1.0 - smoothstep(0.03, 0.08, hit);
  if (sky > 0.0 && uSkyFlow > 0.0) {
    vec2 flow = vec2(-0.022, 0.002) * uSkyFlow;
    float ph = uTime * 0.035;
    float f1 = fract(ph), f2 = fract(ph + 0.5);
    vec2 u1 = uv + flow * (f1 - 0.5), u2 = uv + flow * (f2 - 0.5);
    float ok1 = 1.0 - step(0.08, texture(uDepthT, u1).r);
    float ok2 = 1.0 - step(0.08, texture(uDepthT, u2).r);
    vec3 c1 = mix(c, plates(u1, 0.0), ok1), c2 = mix(c, plates(u2, 0.0), ok2);
    float m = abs(f1 - 0.5) * 2.0;
    c = mix(c, mix(c1, c2, m), sky);
  }
  // Estrellas que titilan en el cielo de noche.
  if (uNight > 0.01 && sky > 0.0) {
    vec2 g = uv * vec2(260.0, 260.0);
    vec2 id = floor(g);
    float h = hash(id);
    float star = step(0.985, h) * smoothstep(0.32, 0.0, length(fract(g) - 0.5));
    float tw = 0.55 + 0.45 * sin(uTime * (1.5 + 3.0 * hash(id + 7.0)) + h * 40.0);
    c += vec3(1.0, 0.94, 0.85) * star * tw * 0.55 * sky * uW.w;
  }
  if (uNight > 0.01) {
    // Bombillas y farol: titilan (cada una a su ritmo) y tienen un halo.
    float l = dot(c, vec3(0.3, 0.59, 0.11));
    float hot = smoothstep(0.8, 0.97, l);
    float cell = noise(floor(uv * 90.0) * 0.37 + vec2(uTime * 2.3, -uTime * 1.7));
    float fl = 0.78 + 0.44 * cell;
    c *= 1.0 + hot * (fl - 1.0) * 0.55 * uNight;
    vec3 halo = plates(uv, 4.6);
    c += max(halo - 0.55, 0.0) * 1.3 * uNight * fl;
  }
  return c;
}

vec3 kitchen(vec2 p, out float hit) {
  vec2 uv0 = uMapK.xy + p * uMapK.zw;
  vec2 off = uCamK.xy + (uv0 - uDollyCK) * uCamK.z;
  vec2 uv = clamp(pom(uDepthK, uv0, off, uCamK.w, 16, hit), 0.0, 1.0);
  vec3 c0 = texture(uKitchen, uv).rgb;
  // Fuego: píxeles naranja intenso. Las llamas bailan (distorsión que sube) y respiran.
  float fire = smoothstep(0.25, 0.55, c0.r - c0.b) * smoothstep(0.5, 0.85, c0.r);
  vec2 w = vec2(noise(vec2(uv.x * 140.0, uv.y * 260.0 + uTime * 9.0)) - 0.5,
                noise(vec2(uv.x * 120.0 + 5.0, uv.y * 220.0 + uTime * 11.0)) - 0.5);
  vec3 c = texture(uKitchen, clamp(uv + w * vec2(0.006, 0.0016) * fire, 0.0, 1.0)).rgb;
  float flick = 0.8 + 0.4 * noise(vec2(uTime * 7.0, uv.y * 40.0));
  c *= 1.0 + fire * (flick - 1.0) * 0.8;
  c += max(textureLod(uKitchen, uv, 5.0).rgb - 0.35, 0.0) * 0.7 * flick;
  return c;
}

float seg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}
float bird(vec2 p, vec4 b) {
  if (b.z <= 0.0) return 0.0;
  vec2 q = (p - b.xy) / b.z;
  if (abs(q.x) > 1.4 || abs(q.y) > 1.2) return 0.0;
  q.x = abs(q.x);
  float f = sin(b.w);
  vec2 elbow = vec2(0.5, -0.12 - 0.35 * f);
  vec2 tip = vec2(1.05, 0.05 - 0.75 * f);
  float d = min(seg(q, vec2(0.0), elbow), seg(q, elbow, tip));
  d = min(d, length(q * vec2(1.6, 1.0)) - 0.09);
  return 1.0 - smoothstep(0.045, 0.11, d);
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);

  float hitT = 0.0, hitK = 0.0;
  vec3 col = vec3(0.0);
  if (uKitchenA < 0.999) col = terrace(p, hitT);
  if (uKitchenA > 0.001) col = mix(col, kitchen(p, hitK), uKitchenA);

  // Zanates: en el cielo, detrás de las torres.
  if (uBirdA > 0.01) {
    float b = 0.0;
    for (int i = 0; i < 7; i++) b = max(b, bird(p, uBirds[i]));
    float behind = 1.0 - smoothstep(0.08, 0.16, hitT);
    col = mix(col, col * 0.12, b * behind * uBirdA * 0.9);
  }

  // Titular: un plano a la profundidad uTextDepth. En la terraza, lo más cercano lo tapa.
  vec2 uv0 = uMapT.xy + p * uMapT.zw;
  vec2 offT = (uCamT.xy + (uv0 - uDollyCT) * uCamT.z) * (uTextDepth - uCamT.w) / uMapT.zw;
  vec2 tp = p - offT * (1.0 - uKitchenA);
  vec4 t1 = texture(uText, (tp - vec2(0.0, uTextY.x)) / uRes);
  vec4 t2 = texture(uText, (tp - vec2(0.0, uTextY.y)) / uRes);
  float occ = smoothstep(uTextDepth + 0.01, uTextDepth + 0.07, hitT) * (1.0 - uKitchenA);
  float sh = max(t1.b * uTextA.x, t2.a * uTextA.y) * (1.0 - occ);
  col = mix(col, mix(col * 0.3, mix(col, vec3(1.0), 0.55), uInkDark), sh * 0.6);
  float g = max(t1.r * uTextA.x, t2.g * uTextA.y) * (1.0 - occ);
  col = mix(col, uInk, g);

  // Película: viñeta suave y grano.
  vec2 q = gl_FragCoord.xy / uRes - 0.5;
  col *= 1.0 - 0.32 * dot(q, q) * 1.6;
  col += (hash(gl_FragCoord.xy + fract(uTime * 13.0) * 100.0) - 0.5) * 0.035;
  col *= 1.0 - uFade;
  outColor = vec4(col, 1.0);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
  return s;
}

export class DepthRenderer {
  constructor(canvas, { maxDpr = 2 } = {}) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('Sin WebGL2');
    this.gl = gl;
    this.canvas = canvas;
    this.maxDpr = maxDpr;
    this.dpr = Math.min(devicePixelRatio || 1, maxDpr);
    this.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);

    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || 'link');
    gl.useProgram(prog);
    this.prog = prog;

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    this.u = {};
    const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const name = gl.getActiveUniform(prog, i).name.replace(/\[0\]$/, '');
      this.u[name] = gl.getUniformLocation(prog, name);
    }
    // Unidades de textura fijas.
    this.units = { uPlate0: 0, uPlate1: 1, uPlate2: 2, uPlate3: 3, uDepthT: 4, uKitchen: 5, uDepthK: 6, uText: 7 };
    for (const [name, unit] of Object.entries(this.units)) gl.uniform1i(this.u[name], unit);
    // Texturas vacías (1×1 negro) hasta que llegan las fotos.
    for (const name of Object.keys(this.units)) this.setTexture(name, null);

    this.textCanvas = document.createElement('canvas');
    this.birds = new Float32Array(7 * 4);
  }

  /** Sube una imagen (o canvas) a una unidad de textura. Reduce lo que no quepa en la GPU. */
  setTexture(name, source, { mips = false } = {}) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + this.units[name]);
    const tex = this[`tex_${name}`] ?? gl.createTexture();
    this[`tex_${name}`] = tex;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    if (!source) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    } else {
      let src = source;
      const w = source.naturalWidth || source.width;
      const h = source.naturalHeight || source.height;
      if (Math.max(w, h) > this.maxTex) {
        const k = this.maxTex / Math.max(w, h);
        src = document.createElement('canvas');
        src.width = Math.floor(w * k);
        src.height = Math.floor(h * k);
        src.getContext('2d').drawImage(source, 0, 0, src.width, src.height);
      }
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (mips && source) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
  }

  resize(vw, vh) {
    this.vw = vw;
    this.vh = vh;
    const w = Math.round(vw * this.dpr);
    const h = Math.round(vh * this.dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, w, h);
  }

  /**
   * Titular en una textura (en píxeles de pantalla): cada línea en su canal, para animarlas
   * por separado. `layout`: { lines: [{ text, font, x, y, align }], ink }.
   */
  setTitle(layout) {
    const c = this.textCanvas;
    const d = this.dpr;
    c.width = Math.round(this.vw * d);
    c.height = Math.round(this.vh * d);
    const g = c.getContext('2d');
    const layer = (fn) => {
      const l = document.createElement('canvas');
      l.width = c.width;
      l.height = c.height;
      const x = l.getContext('2d');
      x.scale(d, d);
      fn(x);
      return x.getImageData(0, 0, c.width, c.height).data;
    };
    const draw = (line, shadow) => (x) => {
      x.font = line.font;
      x.textAlign = line.align || 'center';
      x.textBaseline = 'alphabetic';
      x.fillStyle = '#fff';
      if (shadow) {
        x.shadowColor = '#fff';
        x.shadowBlur = 28;
        x.globalAlpha = 0.8;
      }
      x.fillText(line.text, line.x, line.y);
    };
    const [l1, l2] = layout.lines;
    const a = layer(draw(l1, false));
    const b = layer(draw(l2, false));
    const sa = layer(draw(l1, true));
    const sb = layer(draw(l2, true));
    const img = g.createImageData(c.width, c.height);
    const o = img.data;
    for (let i = 0; i < o.length; i += 4) {
      o[i] = a[i + 3];
      o[i + 1] = b[i + 3];
      o[i + 2] = sa[i + 3];
      o[i + 3] = sb[i + 3];
    }
    // Sin premultiplicar: cada canal es una máscara independiente.
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + this.units.uText);
    gl.bindTexture(gl.TEXTURE_2D, this.tex_uText);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, c.width, c.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, o);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  }

  /** Píxel de pantalla (búfer) → uv de una foto: cubrir + posición + zoom (como object-fit: cover). */
  mapFor(iw, ih, { px, py, zoom, dx = 0, dy = 0 }) {
    const d = this.dpr;
    const vw = this.vw * d;
    const vh = this.vh * d;
    const k = Math.max(vw / iw, vh / ih) * zoom;
    const W = iw * k;
    const H = ih * k;
    const x0 = Math.min(0, Math.max(vw - W, px * (vw - W) + dx * d));
    const y0 = Math.min(0, Math.max(vh - H, py * (vh - H) + dy * d));
    const map = [-x0 / W, -y0 / H, 1 / W, 1 / H];
    const center = [(vw / 2 - x0) / W, (vh / 2 - y0) / H];
    return { map, center, k: k / d, x0: x0 / d, y0: y0 / d, W: W / d, H: H / d };
  }

  render(s) {
    const gl = this.gl;
    const u = this.u;
    gl.uniform2f(u.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1f(u.uTime, s.time);
    gl.uniform4fv(u.uW, s.weights);
    gl.uniform4fv(u.uMapT, s.terrace.map);
    gl.uniform4f(u.uCamT, s.terrace.cam[0], s.terrace.cam[1], s.terrace.dolly, s.terrace.focus);
    gl.uniform2fv(u.uDollyCT, s.terrace.center);
    if (s.kitchen) {
      gl.uniform4fv(u.uMapK, s.kitchen.map);
      gl.uniform4f(u.uCamK, s.kitchen.cam[0], s.kitchen.cam[1], s.kitchen.dolly, s.kitchen.focus);
      gl.uniform2fv(u.uDollyCK, s.kitchen.center);
    }
    gl.uniform1f(u.uKitchenA, s.kitchenAlpha);
    gl.uniform2fv(u.uTextA, s.textAlpha);
    gl.uniform2f(u.uTextY, s.textY[0] * this.dpr, s.textY[1] * this.dpr);
    gl.uniform1f(u.uTextDepth, s.textDepth);
    gl.uniform3fv(u.uInk, s.ink);
    gl.uniform1f(u.uInkDark, s.inkDark);
    gl.uniform1f(u.uNight, s.night);
    gl.uniform1f(u.uSkyFlow, s.skyFlow);
    gl.uniform4fv(u.uBirds, s.birds);
    gl.uniform1f(u.uBirdA, s.birdAlpha);
    gl.uniform1f(u.uFade, s.fade);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
