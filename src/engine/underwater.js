// Shared "this object is under water" shading, patched into Three's built-in
// lit materials: sunlight absorption by depth, caustics, and the dive lamp.
import * as THREE from 'three';
import { ENVIRONMENT } from '../data/environment.js';

export const uw = {
  uUwTime: { value: 0 },
  uUwAbsorb: { value: new THREE.Vector3(...ENVIRONMENT.absorption) },
  uUwFloor: { value: new THREE.Vector3(...ENVIRONMENT.ambientFloor) },
  uUwCaustics: { value: 1 },
  uUwCausticDepth: { value: ENVIRONMENT.causticDepth },
  uUwLampPos: { value: new THREE.Vector3() },
  uUwLampDir: { value: new THREE.Vector3(0, 0, -1) },
  uUwLampColor: { value: new THREE.Color(0, 0, 0) }, // black = off
  uUwLampCone: { value: new THREE.Vector2(Math.cos(0.55), Math.cos(0.2)) },
};

const VERT_DECL = `
varying vec3 vUwPos;
varying vec3 vUwNormal;
`;
const VERT_MAIN = `
{
  vec4 uwP = vec4(transformed, 1.0);
  vec3 uwN = objectNormal;
  #ifdef USE_INSTANCING
    uwP = instanceMatrix * uwP;
    uwN = mat3(instanceMatrix) * uwN;
  #endif
  vUwPos = (modelMatrix * uwP).xyz;
  vUwNormal = normalize(mat3(modelMatrix) * uwN);
}
`;
const FRAG_DECL = `
varying vec3 vUwPos;
varying vec3 vUwNormal;
uniform float uUwTime;
uniform vec3 uUwAbsorb;
uniform vec3 uUwFloor;
uniform float uUwCaustics;
uniform float uUwCausticDepth;
uniform vec3 uUwLampPos;
uniform vec3 uUwLampDir;
uniform vec3 uUwLampColor;
uniform vec2 uUwLampCone;

// Two domain-warped line lattices; where both are bright you get the
// wobbling net of light that sun makes on a shallow seabed.
float uwCausticLayer(vec2 p, float t) {
  vec2 q = p;
  q += 0.55 * vec2(sin(q.y * 1.7 + t * 0.9), cos(q.x * 1.5 - t * 0.8));
  q += 0.30 * vec2(cos(q.y * 3.1 - t * 1.3), sin(q.x * 2.9 + t * 1.1));
  float a = abs(sin(q.x * 1.9 + q.y * 0.6));
  float b = abs(sin(q.y * 2.1 - q.x * 0.5));
  return pow(1.0 - min(a, b), 5.0);
}
float uwCaustic(vec2 p, float t) {
  return min(uwCausticLayer(p, t), uwCausticLayer(p * 1.31 + 7.7, -t * 0.83)) * 2.2
       + uwCausticLayer(p * 0.6 + 3.1, t * 0.6) * 0.25;
}
`;
const FRAG_MAIN = `
{
  float uwDepth = max(-vUwPos.y, 0.0);
  float uwWet = step(vUwPos.y, 0.0);
  vec3 uwLight = max(exp(-uwDepth * uUwAbsorb), uUwFloor);
  #ifdef UW_CAUSTICS
    float uwC = uwCaustic(vUwPos.xz * 0.55 + vUwPos.y * 0.2, uUwTime);
    uwLight *= 1.0 + uwC * uUwCaustics * uwWet * exp(-uwDepth / uUwCausticDepth)
             * smoothstep(0.0, 1.5, uwDepth) * clamp(vUwNormal.y * 1.4 + 0.2, 0.0, 1.0);
  #endif
  vec3 uwToFrag = vUwPos - uUwLampPos;
  float uwDist = length(uwToFrag);
  vec3 uwL = uwToFrag / max(uwDist, 0.001);
  float uwCone = smoothstep(uUwLampCone.x, uUwLampCone.y, dot(uwL, uUwLampDir));
  float uwNdl = clamp(dot(normalize(vUwNormal), -uwL) * 0.75 + 0.25, 0.0, 1.0);
  vec3 uwLamp = uUwLampColor * uwCone * uwNdl / (1.0 + 0.012 * uwDist * uwDist);
  outgoingLight = (outgoingLight - totalEmissiveRadiance) * uwLight
                + diffuseColor.rgb * uwLamp + totalEmissiveRadiance;
}
`;

/** Patch a MeshLambertMaterial / MeshStandardMaterial in place. */
export function patchUnderwater(material, { caustics = true } = {}) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uw);
    if (caustics) shader.defines = { ...(shader.defines || {}), UW_CAUSTICS: '' };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_DECL)
      .replace('#include <project_vertex>', '#include <project_vertex>\n' + VERT_MAIN);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_DECL)
      .replace('#include <opaque_fragment>', FRAG_MAIN + '\n#include <opaque_fragment>');
  };
  material.customProgramCacheKey = () => 'uw' + (caustics ? 'c' : 'n');
  return material;
}
