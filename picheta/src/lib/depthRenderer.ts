/**
 * Fotografía con profundidad (2.5D) en WebGL2, sin librerías.
 *
 * Cada foto real lleva un mapa de profundidad (Depth Anything V2, public/depth/: blanco cerca, negro lejos).
 * Un solo pase de pantalla completa busca, de cerca a lejos, qué superficie de la foto se ve en cada píxel
 * cuando la cámara se desplaza (parallax occlusion mapping): el primer plano pasa por delante de la Catedral,
 * la Catedral por delante del cielo. El "dolly" acerca la cámara: lo cercano crece más que lo lejano.
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

uniform sampler2D uTex;
uniform sampler2D uDepth;
uniform vec4 uMap;      // pantalla (0–1) -> uv de la foto: origen.xy, escala.zw
uniform vec4 uCam;      // desplazamiento.xy, dolly, plano de foco
uniform vec2 uDollyC;   // centro del dolly (uv de la foto)
uniform float uTime;
uniform float uSparkle; // luces que titilan (noche)
uniform float uCurve;   // curva de profundidad: < 1 separa los planos lejanos (Catedral / cielo)
uniform int uSteps;

float depthAt(vec2 uv) { return pow(texture(uDepth, uv).r, uCurve); }

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// Un punto a profundidad d se ve desplazado off * (d - foco). Se busca de cerca (1) a lejos (0)
// la primera superficie que alcanza el rayo y se refina entre los dos últimos pasos.
vec2 pom(vec2 uv0, vec2 off, float focus) {
  float prevZ = 1.0;
  vec2 prevUv = uv0 - off * (1.0 - focus);
  float prevD = depthAt(prevUv);
  if (prevD >= 1.0) return prevUv;
  for (int i = 1; i <= 40; i++) {
    if (i > uSteps) break;
    float z = 1.0 - float(i) / float(uSteps);
    vec2 uv = uv0 - off * (z - focus);
    float d = depthAt(uv);
    if (d >= z) {
      float a = prevD - prevZ;
      float b = d - z;
      float zz = mix(prevZ, z, a / (a - b));
      return uv0 - off * (zz - focus);
    }
    prevZ = z;
    prevD = d;
  }
  return uv0 + off * focus;
}

void main() {
  vec2 uv0 = uMap.xy + vec2(vP.x, 1.0 - vP.y) * uMap.zw;
  vec2 off = uCam.xy + (uv0 - uDollyC) * uCam.z;
  vec2 uv = clamp(pom(uv0, off, uCam.w), 0.0, 1.0);
  vec3 c = texture(uTex, uv).rgb;
  if (uSparkle > 0.0) {
    // Solo los puntos más brillantes (farolas, ventanas, lámparas) respiran, cada uno a su ritmo.
    float l = dot(c, vec3(0.3, 0.59, 0.11));
    float hot = smoothstep(0.62, 0.95, l);
    vec2 cell = floor(uv * 320.0);
    float tw = sin(uTime * (1.2 + 2.6 * hash(cell)) + hash(cell + 3.1) * 40.0);
    c *= 1.0 + hot * tw * 0.22 * uSparkle;
  }
  outColor = vec4(c, 1.0);
}`;

export interface DepthUniforms {
  /** Origen y escala del encuadre (cover) en uv de la foto. */
  map: [number, number, number, number];
  offset: [number, number];
  dolly: number;
  focus: number;
  dollyCenter: [number, number];
  time: number;
  sparkle: number;
  curve: number;
}

/**
 * WebGL2 con aceleración real. Los rasterizadores por software (SwiftShader, llvmpipe…) harían la página lenta:
 * en ellos se queda la foto normal. `?gl=force` lo activa igualmente (pruebas).
 */
export function webgl2Supported(): boolean {
  try {
    const force = new URLSearchParams(location.search).get('gl') === 'force';
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return false;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return force || !/swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer);
  } catch {
    return false;
  }
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type);
  if (!s) throw new Error('shader');
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
  return s;
}

export class DepthRenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private textures: WebGLTexture[] = [];
  private loc: Record<string, WebGLUniformLocation | null> = {};
  steps: number;
  disposed = false;

  constructor(
    private canvas: HTMLCanvasElement,
    image: TexImageSource,
    depth: TexImageSource,
    steps: number,
  ) {
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      alpha: false,
      premultipliedAlpha: false,
      powerPreference: 'high-performance',
    });
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
    for (const n of ['uTex', 'uDepth', 'uMap', 'uCam', 'uDollyC', 'uTime', 'uSparkle', 'uCurve', 'uSteps'])
      this.loc[n] = gl.getUniformLocation(p, n);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.textures.push(this.upload(0, image, gl.RGBA8, gl.RGBA, true));
    this.textures.push(this.upload(1, depth, gl.R8, gl.RED, false));
    gl.uniform1i(this.loc.uTex ?? null, 0);
    gl.uniform1i(this.loc.uDepth ?? null, 1);
  }

  private upload(unit: number, src: TexImageSource, internal: number, format: number, mips: boolean): WebGLTexture {
    const gl = this.gl;
    const t = gl.createTexture();
    if (!t) throw new Error('texture');
    gl.activeTexture(gl.TEXTURE0 + unit);
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

  resize(width: number, height: number) {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.gl.viewport(0, 0, width, height);
  }

  render(u: DepthUniforms) {
    if (this.disposed) return;
    const gl = this.gl;
    gl.uniform4f(this.loc.uMap ?? null, ...u.map);
    gl.uniform4f(this.loc.uCam ?? null, u.offset[0], u.offset[1], u.dolly, u.focus);
    gl.uniform2f(this.loc.uDollyC ?? null, ...u.dollyCenter);
    gl.uniform1f(this.loc.uTime ?? null, u.time);
    gl.uniform1f(this.loc.uSparkle ?? null, u.sparkle);
    gl.uniform1f(this.loc.uCurve ?? null, u.curve);
    gl.uniform1i(this.loc.uSteps ?? null, this.steps);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const gl = this.gl;
    this.textures.forEach((t) => gl.deleteTexture(t));
    gl.deleteProgram(this.program);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
