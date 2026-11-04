// L'acqua cristallina sotto il pannello di Mallorca: come il fondo di una piscina, turchese che
// sfuma nel verde acqua, con le reti di luce (caustiche) che si muovono piano. Un piccolo
// shader in un canvas a parte, disegnato solo mentre il pannello è aperto.
import gsap from 'gsap';

const vert = `attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`;
const frag = `
  precision highp float;
  uniform vec2 uRes;
  uniform float uTime;
  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
  }
  // un rumore morbido: deforma le celle, così i bordi diventano curve
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  vec2 warp(vec2 p, float t) {
    return vec2(noise(p * 0.8 + vec2(t * 0.12, 0.0)) + 0.5 * noise(p * 1.7 - vec2(0.0, t * 0.1)),
                noise(p * 0.8 + vec2(5.2, -t * 0.11)) + 0.5 * noise(p * 1.7 + vec2(t * 0.09, 3.1))) - 0.75;
  }
  // la rete di luce: i bordi tra celle che si muovono (distanza tra la cella più vicina e la seconda)
  float net(vec2 p, float t) {
    vec2 i = floor(p), f = fract(p);
    float d1 = 8.0, d2 = 8.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = 0.5 + 0.42 * sin(t + 6.2831 * hash2(i + g));
      float d = length(g + o - f);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
    }
    return d2 - d1;
  }
  void main() {
    vec2 uv = gl_FragCoord.xy / uRes.y;
    float t = uTime;
    // l'acqua ondeggia: la rete si deforma piano
    vec2 p = uv * 4.0;
    vec2 pa = p + warp(p * 0.85, t * 0.8) * 1.3;
    vec2 pb = p * 1.27 + vec2(3.1, 1.7) + warp(p * 1.1 + 7.0, t * 0.9) * 1.3;
    float a = net(pa, t * 0.32);
    float b = net(pb, t * 0.4 + 1.3);
    // linee curve, larghe e sfumate: la luce si scioglie ai lati, come quella rifratta sul fondo
    float light = exp(-pow(a / 0.13, 2.0)) * 0.5 + exp(-pow(b / 0.11, 2.0)) * 0.34;
    // turchese in alto, verde acqua in basso, appena più profondo ai bordi
    float y = gl_FragCoord.y / uRes.y;
    vec3 green = vec3(0.40, 0.85, 0.70), aqua = vec3(0.33, 0.83, 0.86), teal = vec3(0.16, 0.66, 0.72);
    vec3 col = mix(green, aqua, smoothstep(0.05, 0.75, y));
    col = mix(col, teal, smoothstep(0.82, 1.0, y) * 0.45);
    col += 0.035 * sin(uv.x * 2.3 + t * 0.35) + 0.025 * sin(uv.y * 3.7 - t * 0.27);
    col += vec3(0.86, 1.0, 0.97) * light * 0.2;
    float vig = smoothstep(1.35, 0.45, length((gl_FragCoord.xy / uRes - 0.5) * vec2(uRes.x / uRes.y, 1.0)));
    gl_FragColor = vec4(col * (0.9 + 0.1 * vig), 1.0);
  }
`;

/** il canvas dell'acqua dentro il pannello `host`: si anima solo quando il pannello è aperto */
export function createPool(canvas, host) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false });
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, vert));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(prog, 'uRes'), uTime = gl.getUniformLocation(prog, 'uTime');
  // morbida per natura: basta poca risoluzione, e il telefono lavora poco
  const scale = Math.min(devicePixelRatio, 2) * 0.4;
  const draw = (time) => {
    const w = Math.max(2, Math.round(canvas.clientWidth * scale)), h = Math.max(2, Math.round(canvas.clientHeight * scale));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
    gl.uniform2f(uRes, w, h);
    gl.uniform1f(uTime, time);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  gsap.ticker.add((time) => { if (host.getAttribute('aria-hidden') === 'false') draw(time); });
  draw(0);
  return { draw };
}
