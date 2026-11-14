// The sea surface (seen from both sides), the sky, and the depth-driven
// fog and lighting.
import * as THREE from 'three';
import { ENVIRONMENT } from '../data/environment.js';
import { WORLD } from '../data/world.js';
import { sampleEnvironment } from '../logic/environment.js';
import { uw } from './underwater.js';

const SURFACE_VERT = `
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const SURFACE_FRAG = `
uniform float uTime;
uniform float uUnder;
uniform vec3 uSunDir;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunColor;
uniform vec3 uWaterDeep;
varying vec3 vWorld;

vec2 waveSlope(vec2 p, float t) {
  vec2 g = vec2(0.0);
  g += vec2( 0.80,  0.60) * cos(dot(p, vec2( 0.80,  0.60)) * 0.35 + t * 0.9) * 0.10;
  g += vec2(-0.40,  0.92) * cos(dot(p, vec2(-0.40,  0.92)) * 0.62 + t * 1.2) * 0.09;
  g += vec2( 0.95, -0.30) * cos(dot(p, vec2( 0.95, -0.30)) * 1.10 + t * 1.6) * 0.08;
  g += vec2(-0.70, -0.71) * cos(dot(p, vec2(-0.70, -0.71)) * 2.30 + t * 2.3) * 0.07;
  g += vec2( 0.20,  0.98) * cos(dot(p, vec2( 0.20,  0.98)) * 4.70 + t * 3.1) * 0.05;
  return g;
}

void main() {
  vec3 toCam = cameraPosition - vWorld;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  vec2 slope = waveSlope(vWorld.xz, uTime) * (0.25 + 0.75 * exp(-dist * 0.012));
  vec3 N = normalize(vec3(-slope.x, 1.0, -slope.y));
  vec3 col;
  float alpha;
  if (uUnder < 0.5) {
    // From the air: sky reflection over deep blue.
    float fres = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 4.0);
    vec3 R = reflect(-V, N);
    vec3 sky = mix(uHorizon, uZenith, pow(max(R.y, 0.0), 0.6));
    float spec = pow(max(dot(R, uSunDir), 0.0), 260.0) * 3.0;
    col = mix(uWaterDeep, sky, fres) + uSunColor * spec;
    alpha = mix(0.9, 1.0, smoothstep(4.0, 45.0, dist)); // hide the deep from afar
  } else {
    // From below: a bright window overhead, mirror-dark beyond the critical angle.
    float c = dot(-V, N * vec3(1.7, 1.0, 1.7)); // exaggerate ripples at the window edge
    float window = smoothstep(0.60, 0.76, c);
    vec3 sunUw = normalize(vec3(uSunDir.x * 0.75, uSunDir.y, uSunDir.z * 0.75));
    float s = max(dot(-V, sunUw + vec3(slope.x, 0.0, slope.y) * 0.6), 0.0);
    vec3 through = mix(uHorizon, uZenith, 0.35) * 1.15 + uSunColor * (pow(s, 90.0) * 2.5 + pow(s, 10.0) * 0.35);
    vec3 mirror = uFogColor * (0.75 + 0.5 * slope.x);
    col = mix(mirror, through, window);
    alpha = mix(1.0, 0.72, window * exp(-dist * 0.05)); // things above the water show as silhouettes
  }
  float fog = 1.0 - exp(-pow(dist * uFogDensity, 2.0));
  col = mix(col, uFogColor, fog);
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}`;

const SKY_FRAG = `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunColor;
uniform vec3 uSunDir;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  vec3 col = mix(uHorizon, uZenith, pow(max(d.y, 0.0), 0.55));
  float s = max(dot(d, uSunDir), 0.0);
  col += uSunColor * (pow(s, 900.0) * 4.0 + pow(s, 30.0) * 0.25);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export function createOcean(scene, terrain) {
  const sky = ENVIRONMENT.sky;
  const sunDir = new THREE.Vector3(...WORLD.sunDir).normalize();
  const shared = {
    uTime: { value: 0 },
    uUnder: { value: 0 },
    uSunDir: { value: sunDir },
    uFogColor: { value: new THREE.Color() },
    uFogDensity: { value: 0.01 },
    uZenith: { value: new THREE.Color(sky.zenith) },
    uHorizon: { value: new THREE.Color(sky.horizon) },
    uSunColor: { value: new THREE.Color(sky.sun) },
    uWaterDeep: { value: new THREE.Color(sky.waterDeep) },
  };

  const surface = new THREE.Mesh(
    new THREE.PlaneGeometry(3200, 3200).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      uniforms: shared, vertexShader: SURFACE_VERT, fragmentShader: SURFACE_FRAG,
      side: THREE.DoubleSide, transparent: true, depthWrite: false,
    }),
  );
  surface.frustumCulled = false;
  surface.renderOrder = 1;
  scene.add(surface);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1900, 24, 12),
    new THREE.ShaderMaterial({
      uniforms: shared,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false,
    }),
  );
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  scene.add(dome);

  const hemi = new THREE.HemisphereLight(0xcfeeff, 0x4a6a78, 1.15);
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.9);
  sun.position.copy(sunDir).multiplyScalar(100);
  scene.add(hemi, sun);

  scene.fog = new THREE.FogExp2(0x000000, 0.01);
  scene.background = new THREE.Color();
  const airFog = new THREE.Color(ENVIRONMENT.air.fog);
  const env = { fog: [0, 0, 0], density: 0, sun: 1 };
  const weights = [];
  const state = { under: false, sun: 1, density: 0.01, viewDistance: 200, fogColor: scene.fog.color };

  function update(camera, time) {
    const p = camera.position;
    const under = p.y < 0;
    shared.uTime.value = time;
    shared.uUnder.value = under ? 1 : 0;
    uw.uUwTime.value = time;
    if (under) {
      sampleEnvironment(-p.y, terrain.biomeWeights(p.x, p.z, weights), env);
      scene.fog.color.setRGB(env.fog[0], env.fog[1], env.fog[2], THREE.SRGBColorSpace);
      scene.fog.density = env.density;
      state.sun = env.sun;
    } else {
      scene.fog.color.copy(airFog);
      scene.fog.density = ENVIRONMENT.air.density;
      state.sun = 1;
    }
    scene.background.copy(scene.fog.color);
    shared.uFogColor.value.copy(scene.fog.color);
    shared.uFogDensity.value = scene.fog.density;
    dome.visible = !under;
    dome.position.copy(p);
    surface.position.set(p.x, 0, p.z);
    state.under = under;
    state.density = scene.fog.density;
    // Beyond this the fog has swallowed everything.
    state.viewDistance = under ? 2.3 / scene.fog.density : 260;
    return state;
  }

  return { update, state, sunDir };
}
