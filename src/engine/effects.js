// Light shafts and drifting particles. Both are generated around the camera
// in the vertex shader, so they cost nothing on the CPU.
import * as THREE from 'three';
import { ENVIRONMENT } from '../data/environment.js';
import { mulberry32 } from '../logic/rng.js';
import { makeDotTexture } from './textures.js';

const SHAFT_VERT = `
attribute vec2 aCell;
attribute vec2 aCorner;
uniform vec3 uCam;
uniform float uTime;
uniform vec3 uAxis;
uniform float uCell;
uniform float uGrid;
uniform float uMaxLen;
varying vec2 vUv;
varying float vFade;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec2 cell = floor(uCam.xz / uCell) + aCell;
  float h1 = hash(cell), h2 = hash(cell + 17.3), h3 = hash(cell + 3.1), h4 = hash(cell + 9.7);
  vec2 base = (cell + vec2(h1, h2)) * uCell;
  // Never reach the seabed: a quad cutting the ground leaves a hard line.
  float len = min(mix(28.0, 70.0, h3), uMaxLen);
  float width = mix(0.7, 2.2, h4);
  vec3 p = vec3(base.x, 0.0, base.y) + uAxis * (aCorner.y * len);
  vec3 toCam = uCam - p;
  vec3 side = normalize(cross(uAxis, toCam));
  p += side * aCorner.x * width * (1.0 + aCorner.y * 1.2);
  float edge = 1.0 - smoothstep(uCell * (uGrid * 0.5 - 1.5), uCell * (uGrid * 0.5 - 0.5), distance(base, uCam.xz));
  float flicker = 0.55 + 0.45 * sin(uTime * (0.4 + h1 * 0.6) + h2 * 6.283);
  float near = smoothstep(1.5, 9.0, length(toCam));
  vUv = aCorner;
  vFade = edge * flicker * near * step(0.35, h4 + h1 * 0.5);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const SHAFT_FRAG = `
uniform vec3 uColor;
uniform float uStrength;
varying vec2 vUv;
varying float vFade;
void main() {
  float across = 1.0 - abs(vUv.x);
  float a = across * across * pow(1.0 - vUv.y, 1.6) * smoothstep(0.0, 0.04, vUv.y) * vFade * uStrength;
  gl_FragColor = vec4(uColor * a, 1.0);
  #include <colorspace_fragment>
}`;

const SNOW_VERT = `
attribute float aSeed;
uniform vec3 uCam;
uniform float uTime;
uniform float uBox;
uniform float uScale;
varying float vAlpha;
void main() {
  vec3 drift = vec3(0.12, -0.05, 0.07) * uTime
             + 0.25 * vec3(sin(uTime * 0.31 + aSeed * 40.0), sin(uTime * 0.23 + aSeed * 71.0), cos(uTime * 0.27 + aSeed * 55.0));
  vec3 p = uCam + mod(position * uBox + drift - uCam + uBox * 0.5, uBox) - uBox * 0.5;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  float d = -mv.z;
  gl_PointSize = clamp(uScale * (0.035 + aSeed * 0.05) / max(d, 0.1), 1.0, 14.0);
  vAlpha = smoothstep(0.3, 2.0, d) * (1.0 - smoothstep(uBox * 0.3, uBox * 0.5, d)) * step(p.y, -0.05) * (0.4 + 0.6 * fract(aSeed * 13.0));
  gl_Position = projectionMatrix * mv;
}`;
const SNOW_FRAG = `
uniform sampler2D uMap;
uniform vec3 uColor;
varying float vAlpha;
void main() {
  float a = texture2D(uMap, gl_PointCoord).a * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`;

export function createEffects(scene, quality, sunDir) {
  // --- light shafts ---
  const G = quality.shaftGrid;
  const count = G * G;
  const cells = new Float32Array(count * 4 * 2);
  const corners = new Float32Array(count * 4 * 2);
  const idx = new Uint16Array(count * 6);
  const quad = [[-1, 0], [1, 0], [-1, 1], [1, 1]];
  let s = 0;
  for (let j = 0; j < G; j++) {
    for (let i = 0; i < G; i++, s++) {
      for (let k = 0; k < 4; k++) {
        cells[(s * 4 + k) * 2] = i - (G - 1) / 2;
        cells[(s * 4 + k) * 2 + 1] = j - (G - 1) / 2;
        corners[(s * 4 + k) * 2] = quad[k][0];
        corners[(s * 4 + k) * 2 + 1] = quad[k][1];
      }
      idx.set([s * 4, s * 4 + 2, s * 4 + 1, s * 4 + 1, s * 4 + 2, s * 4 + 3], s * 6);
    }
  }
  const shaftGeo = new THREE.BufferGeometry();
  shaftGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 12), 3));
  shaftGeo.setAttribute('aCell', new THREE.BufferAttribute(cells, 2));
  shaftGeo.setAttribute('aCorner', new THREE.BufferAttribute(corners, 2));
  shaftGeo.setIndex(new THREE.BufferAttribute(idx, 1));
  const shaftUniforms = {
    uCam: { value: new THREE.Vector3() },
    uTime: { value: 0 },
    uAxis: { value: sunDir.clone().multiplyScalar(-1) },
    uCell: { value: 11 },
    uGrid: { value: G },
    uMaxLen: { value: 70 },
    uColor: { value: new THREE.Color('#bfeee6') },
    uStrength: { value: 0 },
  };
  const shafts = new THREE.Mesh(shaftGeo, new THREE.ShaderMaterial({
    uniforms: shaftUniforms, vertexShader: SHAFT_VERT, fragmentShader: SHAFT_FRAG,
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }));
  shafts.frustumCulled = false;
  shafts.renderOrder = 3;
  scene.add(shafts);

  // --- drifting particles ---
  const rand = mulberry32(99);
  const P = quality.particles;
  const pos = new Float32Array(P * 3), seed = new Float32Array(P);
  for (let i = 0; i < P; i++) {
    pos[i * 3] = rand(); pos[i * 3 + 1] = rand(); pos[i * 3 + 2] = rand();
    seed[i] = rand();
  }
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  snowGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const snowUniforms = {
    uCam: shaftUniforms.uCam,
    uTime: shaftUniforms.uTime,
    uBox: { value: 36 },
    uScale: { value: 600 },
    uMap: { value: makeDotTexture() },
    uColor: { value: new THREE.Color() },
  };
  const snow = new THREE.Points(snowGeo, new THREE.ShaderMaterial({
    uniforms: snowUniforms, vertexShader: SNOW_VERT, fragmentShader: SNOW_FRAG,
    transparent: true, depthWrite: false,
  }));
  snow.frustumCulled = false;
  snow.renderOrder = 2;
  scene.add(snow);

  const bright = new THREE.Color('#e8fbff'), glow = new THREE.Color('#5fd6ff');

  function update(camera, time, ocean, viewportHeight, floorDepth) {
    shaftUniforms.uMaxLen.value = Math.max(4, floorDepth / -shaftUniforms.uAxis.value.y);
    shaftUniforms.uCam.value.copy(camera.position);
    shaftUniforms.uTime.value = time;
    const depth = -camera.position.y;
    const fade = Math.max(0, 1 - depth / ENVIRONMENT.shaftMaxDepth);
    shaftUniforms.uStrength.value = ocean.under ? 0.17 * fade : 0;
    shafts.visible = shaftUniforms.uStrength.value > 0.003;
    snow.visible = ocean.under;
    snowUniforms.uScale.value = viewportHeight;
    // Sunlit specks near the surface; faint self-lit motes in the deep.
    snowUniforms.uColor.value.copy(glow).lerp(bright, ocean.sun).multiplyScalar(0.25 + 0.75 * ocean.sun);
  }
  return { update };
}
