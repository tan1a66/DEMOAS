/**
 * El recorrido: un solo lienzo WebGL2 a pantalla completa por el que se "camina" a través de las fotos reales.
 *
 * Cada espacio es una foto con su mapa de profundidad (Depth Anything V2). La cámara avanza dentro de la foto
 * (dolly con oclusión: lo cercano pasa a los lados), se balancea con los pasos y gira la cabeza con el ratón o el
 * giroscopio. Entre dos espacios se mezclan las dos escenas en el mismo pase: fundido a oscuras (una entrada),
 * a luz (salir a la terraza) o por profundidad (lo cercano del espacio nuevo aparece primero, como al entrar en él).
 */

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vP;
void main() {
  vP = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 vP;
out vec4 outColor;

uniform sampler2D uTexA;
uniform sampler2D uDepthA;
uniform sampler2D uTexB;
uniform sampler2D uDepthB;
uniform vec4 uMapA;     // pantalla -> uv de la foto: origen.xy, escala.zw
uniform vec4 uMapB;
uniform vec4 uCamA;     // desplazamiento.xy, dolly, plano de foco
uniform vec4 uCamB;
uniform vec2 uCenA;     // centro del dolly
uniform vec2 uCenB;
uniform vec4 uLook;     // curva A, curva B, titileo A, titileo B
uniform float uMix;     // 0 = A … 1 = B
uniform int uMode;      // 0 fundido, 1 por profundidad
uniform float uRoll;    // inclinación de la cabeza al caminar (rad)
uniform float uAspect;
uniform float uFade;    // hacia la oscuridad
uniform float uFlash;   // hacia la luz
uniform float uTime;
uniform int uSteps;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float depthAt(sampler2D d, vec2 uv, float curve) { return pow(texture(d, uv).r, curve); }

// Paralaje con oclusión: de cerca a lejos, la primera superficie que alcanza el rayo.
vec2 pom(sampler2D d, float curve, vec2 uv0, vec2 off, float focus) {
  float prevZ = 1.0;
  vec2 prevUv = uv0 - off * (1.0 - focus);
  float prevD = depthAt(d, prevUv, curve);
  if (prevD >= 1.0) return prevUv;
  for (int i = 1; i <= 32; i++) {
    if (i > uSteps) break;
    float z = 1.0 - float(i) / float(uSteps);
    vec2 uv = uv0 - off * (z - focus);
    float dd = depthAt(d, uv, curve);
    if (dd >= z) {
      float a = prevD - prevZ;
      float b = dd - z;
      float zz = mix(prevZ, z, a / (a - b));
      return uv0 - off * (zz - focus);
    }
    prevZ = z;
    prevD = dd;
  }
  return uv0 + off * focus;
}

vec3 scene(sampler2D tex, sampler2D d, vec4 map, vec4 cam, vec2 cen, float curve, float sparkle, vec2 p, out float near) {
  vec2 uv0 = map.xy + p * map.zw;
  vec2 off = cam.xy + (uv0 - cen) * cam.z;
  vec2 uv = clamp(pom(d, curve, uv0, off, cam.w), 0.0, 1.0);
  near = depthAt(d, uv, curve);
  vec3 c = texture(tex, uv).rgb;
  if (sparkle > 0.0) {
    float l = dot(c, vec3(0.3, 0.59, 0.11));
    float hot = smoothstep(0.62, 0.95, l);
    vec2 cell = floor(uv * 320.0);
    c *= 1.0 + hot * sin(uTime * (1.2 + 2.6 * hash(cell)) + hash(cell + 3.1) * 40.0) * 0.22 * sparkle;
  }
  return c;
}

void main() {
  // Cabeza que se inclina levemente con cada paso.
  vec2 q = vP - 0.5;
  q.x *= uAspect;
  float cs = cos(uRoll), sn = sin(uRoll);
  q = vec2(cs * q.x - sn * q.y, sn * q.x + cs * q.y);
  q.x /= uAspect;
  vec2 p = vec2(q.x + 0.5, 0.5 - q.y);

  vec3 c;
  float nA, nB;
  if (uMix <= 0.001) {
    c = scene(uTexA, uDepthA, uMapA, uCamA, uCenA, uLook.x, uLook.z, p, nA);
  } else if (uMix >= 0.999) {
    c = scene(uTexB, uDepthB, uMapB, uCamB, uCenB, uLook.y, uLook.w, p, nB);
  } else {
    vec3 a = scene(uTexA, uDepthA, uMapA, uCamA, uCenA, uLook.x, uLook.z, p, nA);
    vec3 b = scene(uTexB, uDepthB, uMapB, uCamB, uCenB, uLook.y, uLook.w, p, nB);
    float m = uMix;
    // Por profundidad: lo cercano del espacio nuevo llega antes que el fondo.
    if (uMode == 1) m = smoothstep(0.0, 1.0, clamp(uMix * 1.7 - (1.0 - nB) * 0.7, 0.0, 1.0));
    c = mix(a, b, m);
  }

  // Lente: viñeta suave y grano de película.
  float vig = smoothstep(1.25, 0.3, length((vP - 0.5) * vec2(uAspect, 1.0) * 0.95));
  c *= mix(0.72, 1.0, vig);
  c += (hash(vP * vec2(1913.0, 1471.0) + fract(uTime * 7.0)) - 0.5) * 0.03;
  c = mix(c, vec3(0.0), uFade);
  c = mix(c, vec3(1.0, 0.95, 0.88), uFlash);
  outColor = vec4(c, 1.0);
}`;

export interface SceneTextures {
  tex: WebGLTexture;
  depth: WebGLTexture;
}

export interface SceneDraw {
  textures: SceneTextures;
  map: [number, number, number, number];
  offset: [number, number];
  dolly: number;
  focus: number;
  center: [number, number];
  curve: number;
  sparkle: number;
}

export interface FrameDraw {
  a: SceneDraw | null;
  b: SceneDraw | null;
  mix: number;
  depthMix: boolean;
  roll: number;
  fade: number;
  flash: number;
  time: number;
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type);
  if (!s) throw new Error('shader');
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
  return s;
}

const UNIFORMS = [
  'uTexA',
  'uDepthA',
  'uTexB',
  'uDepthB',
  'uMapA',
  'uMapB',
  'uCamA',
  'uCamB',
  'uCenA',
  'uCenB',
  'uLook',
  'uMix',
  'uMode',
  'uRoll',
  'uAspect',
  'uFade',
  'uFlash',
  'uTime',
  'uSteps',
] as const;

export class WalkRenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private loc = {} as Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;
  private black: SceneTextures;
  steps: number;
  disposed = false;

  constructor(
    private canvas: HTMLCanvasElement,
    steps: number,
  ) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('webgl2');
    this.gl = gl;
    this.steps = steps;
    const p = gl.createProgram();
    if (!p) throw new Error('program');
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link');
    this.program = p;
    gl.useProgram(p);
    for (const n of UNIFORMS) this.loc[n] = gl.getUniformLocation(p, n);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1i(this.loc.uTexA, 0);
    gl.uniform1i(this.loc.uDepthA, 1);
    gl.uniform1i(this.loc.uTexB, 2);
    gl.uniform1i(this.loc.uDepthB, 3);
    // Escena vacía (negro) para cuando un espacio aún no ha cargado.
    const px = new Uint8Array([0, 0, 0, 255]);
    this.black = { tex: this.raw(px, gl.RGBA8, gl.RGBA), depth: this.raw(new Uint8Array([0]), gl.R8, gl.RED) };
  }

  private raw(data: Uint8Array, internal: number, format: number): WebGLTexture {
    const gl = this.gl;
    const t = gl.createTexture();
    if (!t) throw new Error('texture');
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, 1, 1, 0, format, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    return t;
  }

  private image(src: TexImageSource, internal: number, format: number, mips: boolean): WebGLTexture {
    const gl = this.gl;
    const t = gl.createTexture();
    if (!t) throw new Error('texture');
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, format, gl.UNSIGNED_BYTE, src);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (mips) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    return t;
  }

  upload(image: TexImageSource, depth: TexImageSource): SceneTextures {
    const gl = this.gl;
    return { tex: this.image(image, gl.RGBA8, gl.RGBA, true), depth: this.image(depth, gl.R8, gl.RED, false) };
  }

  release(t: SceneTextures) {
    if (this.disposed) return;
    this.gl.deleteTexture(t.tex);
    this.gl.deleteTexture(t.depth);
  }

  resize(width: number, height: number) {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.gl.viewport(0, 0, width, height);
  }

  private bind(unit: number, t: WebGLTexture) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
  }

  render(f: FrameDraw) {
    if (this.disposed) return;
    const gl = this.gl;
    const L = this.loc;
    const empty: SceneDraw = {
      textures: this.black,
      map: [0, 0, 1, 1],
      offset: [0, 0],
      dolly: 0,
      focus: 0.5,
      center: [0.5, 0.5],
      curve: 1,
      sparkle: 0,
    };
    const a = f.a ?? empty;
    const b = f.b ?? empty;
    this.bind(0, a.textures.tex);
    this.bind(1, a.textures.depth);
    this.bind(2, b.textures.tex);
    this.bind(3, b.textures.depth);
    gl.uniform4f(L.uMapA, ...a.map);
    gl.uniform4f(L.uMapB, ...b.map);
    gl.uniform4f(L.uCamA, a.offset[0], a.offset[1], a.dolly, a.focus);
    gl.uniform4f(L.uCamB, b.offset[0], b.offset[1], b.dolly, b.focus);
    gl.uniform2f(L.uCenA, ...a.center);
    gl.uniform2f(L.uCenB, ...b.center);
    gl.uniform4f(L.uLook, a.curve, b.curve, a.sparkle, b.sparkle);
    gl.uniform1f(L.uMix, f.mix);
    gl.uniform1i(L.uMode, f.depthMix ? 1 : 0);
    gl.uniform1f(L.uRoll, f.roll);
    gl.uniform1f(L.uAspect, this.canvas.width / Math.max(1, this.canvas.height));
    gl.uniform1f(L.uFade, f.fade);
    gl.uniform1f(L.uFlash, f.flash);
    gl.uniform1f(L.uTime, f.time);
    gl.uniform1i(L.uSteps, this.steps);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const gl = this.gl;
    gl.deleteTexture(this.black.tex);
    gl.deleteTexture(this.black.depth);
    gl.deleteProgram(this.program);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
