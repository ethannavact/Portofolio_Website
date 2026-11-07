// Shaders de la capa WebGL. Todo el color se trabaja en el mismo espacio que el CSS
// (sin conversiones), para que el fondo coincida exactamente con los tokens.

/** Quad de pantalla completa (ignora la cámara). */
export const quadVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const noise = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * snoise(p);
    p = p * 2.03 + 17.1;
    a *= 0.5;
  }
  return v;
}
`;

const cover = /* glsl */ `
vec2 coverUv(vec2 uv, vec2 box, vec2 img) {
  float rb = box.x / box.y;
  float ri = img.x / img.y;
  vec2 s = rb > ri ? vec2(1.0, ri / rb) : vec2(rb / ri, 1.0);
  return (uv - 0.5) * s + 0.5;
}
`;

/**
 * Fondo (se dibuja a 1/3 de resolución: es suave por diseño).
 * Flujo muy lento de ruido, una luz que sigue al mouse y, al hacer hover en un proyecto,
 * su imagen desenfocada con deformación de lente en la transición.
 */
export const bgFrag = /* glsl */ `
uniform float uTime;
uniform vec2 uRes;
uniform vec2 uMouse;
uniform float uMouseAmt;
uniform float uVel;
uniform vec3 uBg;
uniform vec3 uTone;
uniform vec3 uGlow;
uniform sampler2D uFocusA;
uniform sampler2D uFocusB;
uniform vec2 uSizeA;
uniform vec2 uSizeB;
uniform float uFocus;
uniform float uMix;
uniform float uLens;
varying vec2 vUv;
${noise}
${cover}
vec3 soft(sampler2D t, vec2 uv) {
  vec3 c = texture2D(t, uv, 2.5).rgb * 0.2;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.785398 + 0.39;
    c += texture2D(t, uv + vec2(cos(a), sin(a)) * 0.035, 3.0).rgb * 0.1;
  }
  return c;
}
void main() {
  vec2 uv = vUv;
  float asp = uRes.x / uRes.y;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0);
  float t = uTime * 0.022;
  vec2 q = vec2(fbm(p * 0.55 + vec2(t, -t * 0.6)), fbm(p * 0.55 + vec2(-t * 0.7, t) + 4.7));
  float n = fbm(p * 0.7 + q * 1.1 + vec2(0.0, uVel * 0.25)) * 0.5 + 0.5;
  vec3 col = mix(uBg, uTone, smoothstep(0.2, 1.0, n) * 0.85);
  vec2 dm = (uv - uMouse) * vec2(asp, 1.0);
  col = mix(col, uGlow, exp(-dot(dm, dm) * 3.2) * uMouseAmt);

  if (uFocus > 0.001) {
    vec2 fp = uv - 0.5;
    float r2 = dot(fp, fp);
    vec2 fuv = 0.5 + fp * (1.0 - uLens * 0.9 * r2) / (1.0 + uLens * 0.22);
    vec3 a = soft(uFocusA, coverUv(fuv, uRes, uSizeA));
    vec3 b = soft(uFocusB, coverUv(fuv, uRes, uSizeB));
    vec3 f = mix(a, b, uMix);
    f = mix(vec3(dot(f, vec3(0.299, 0.587, 0.114))), f, 1.12) * 0.62;
    f *= 1.0 - 0.38 * smoothstep(0.25, 0.95, length(fp * vec2(1.0, 1.25)) * 1.35);
    col = mix(col, f, uFocus);
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

/** Composición final: escala el fondo y agrega grano (también evita el banding). */
export const compFrag = /* glsl */ `
uniform sampler2D uBgTex;
uniform float uTime;
uniform float uGrain;
uniform vec2 uRes;
varying vec2 vUv;
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
void main() {
  vec3 c = texture2D(uBgTex, vUv).rgb;
  float g = hash(vUv * uRes + floor(uTime * 24.0) * 7.31) - 0.5;
  c += g * uGrain;
  gl_FragColor = vec4(c, 1.0);
}
`;

/** Planos de imagen: siguen a su <img> del DOM y se curvan con la velocidad del scroll. */
export const planeVert = /* glsl */ `
uniform float uVelocity;
uniform float uReveal;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 pos = position;
  pos.y += sin(uv.x * 3.14159265) * uVelocity * 0.03;
  pos.y -= (1.0 - uReveal) * 0.05;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

export const planeFrag = /* glsl */ `
uniform sampler2D uTex;
uniform vec2 uPlane;
uniform vec2 uImage;
uniform float uReveal;
uniform float uHover;
uniform vec2 uMouse;
uniform float uVelocity;
uniform float uParallax;
uniform float uDefocus;
uniform float uDim;
uniform float uAlpha;
uniform float uZoom;
uniform vec4 uClip;
uniform float uViewH;
uniform float uDpr;
uniform float uRadius;
varying vec2 vUv;
${cover}
vec3 tap(vec2 uv, float bias) { return texture2D(uTex, uv, bias).rgb; }
vec3 blurred(vec2 uv, float amt) {
  if (amt < 0.02) return tap(uv, 0.0);
  float bias = amt * 4.5;
  float r = amt * 0.014;
  vec3 c = tap(uv, bias) * 0.2;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.785398 + 0.39;
    c += tap(uv + vec2(cos(a), sin(a)) * r, bias) * 0.1;
  }
  return c;
}
void main() {
  vec2 fc = vec2(gl_FragCoord.x / uDpr, uViewH - gl_FragCoord.y / uDpr);
  if (fc.x < uClip.x || fc.y < uClip.y || fc.x > uClip.z || fc.y > uClip.w) discard;

  vec2 uv = vUv;
  vec2 p = uv - 0.5;
  float lens = (1.0 - uReveal) * 0.9 + abs(uVelocity) * 0.22 + uHover * 0.06;
  uv = 0.5 + p * (1.0 - lens * dot(p, p));
  vec2 m = uv - uMouse;
  uv -= m * uHover * 0.08 * exp(-dot(m, m) * 7.0);
  float z = uZoom + (1.0 - uReveal) * 0.22 + uHover * 0.035;
  uv = 0.5 + (uv - 0.5) / z;
  uv.y += uParallax * (1.0 - 1.0 / uZoom) * 0.48;
  vec2 tuv = clamp(coverUv(uv, uPlane, uImage), 0.001, 0.999);

  float blur = clamp((1.0 - uReveal) * 1.1 + uDefocus * 0.32 + uDim * 0.55 + abs(uVelocity) * 0.12, 0.0, 1.0);
  vec3 col = blurred(tuv, blur);
  vec2 dir = vUv - 0.5;
  float ca = abs(uVelocity) * 0.007 + (1.0 - uReveal) * 0.012 + uHover * 0.002;
  if (ca > 0.0004) {
    col.r = mix(col.r, tap(tuv + dir * ca, blur * 4.5).r, 0.85);
    col.b = mix(col.b, tap(tuv - dir * ca, blur * 4.5).b, 0.85);
  }
  col *= 1.0 - uDim * 0.5;
  // Esquinas redondeadas (las mismas del CSS): rectángulo redondeado en píxeles.
  vec2 q = abs(vUv - 0.5) * uPlane - (0.5 * uPlane - uRadius);
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius;
  float corner = 1.0 - smoothstep(-0.75, 0.75, d);
  gl_FragColor = vec4(col, uAlpha * smoothstep(0.0, 0.35, uReveal) * corner);
}
`;
