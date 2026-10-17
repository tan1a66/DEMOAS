import { Uniform } from 'three';
import { Effect, BlendFunction } from 'postprocessing';

// Acabado final: compresión suave sólo de las altas luces (las motas sumadas
// no se queman, pero el negro piedra #1b1a1a queda intacto) y grano de
// película en espacio perceptual, para que se note igual en sombras y luces.
const FRAG = /* glsl */ `
uniform float uAmount;
uniform float uSeed;
uniform float uKnee;
float grainHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 rolloff(vec3 x) {
  vec3 over = max(x - uKnee, 0.0);
  return min(x, vec3(uKnee)) + (1.0 - uKnee) * (1.0 - exp(-over / (1.0 - uKnee)));
}
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = pow(rolloff(max(inputColor.rgb, 0.0)), vec3(1.0 / 2.2));
  float n = grainHash(gl_FragCoord.xy + uSeed) - 0.5;
  c += n * uAmount * (0.55 + 0.45 * smoothstep(0.0, 0.25, c.g));
  outputColor = vec4(pow(max(c, 0.0), vec3(2.2)), inputColor.a);
}
`;

export class FinishEffect extends Effect {
  constructor({ amount = 0.05, knee = 0.62 } = {}) {
    super('FinishEffect', FRAG, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map([
        ['uAmount', new Uniform(amount)],
        ['uSeed', new Uniform(0)],
        ['uKnee', new Uniform(knee)],
      ]),
    });
  }

  update() {
    this.uniforms.get('uSeed').value = Math.random() * 1000;
  }
}
