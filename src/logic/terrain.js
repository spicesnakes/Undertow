// Procedural seafloor. Pure functions of (x, z) so the renderer, the collision
// code and the unit tests all agree on where the ground is.
import { WORLD } from '../data/world.js';
import { BIOMES } from '../data/biomes.js';
import { createNoise2D, fbm, ridged } from './noise.js';
import { clamp, lerp, smoothstep, piecewise, hexToRgb } from './math.js';

export function createTerrain(world = WORLD, biomes = BIOMES) {
  const seed = world.seed;
  const nWarp = createNoise2D(seed + 1);
  const nDune = createNoise2D(seed + 2);
  const nRock = createNoise2D(seed + 3);
  const nMesa = createNoise2D(seed + 4);
  const nTrench = createNoise2D(seed + 5);
  const nTint = createNoise2D(seed + 6);
  const bounds = biomes.slice(0, -1).map((b) => b.outerRadius);
  const blend = world.biomeBlend;
  const sand = biomes.map((b) => hexToRgb(b.sand));
  const rock = biomes.map((b) => hexToRgb(b.rock));

  function warpedRadius(x, z) {
    const r = Math.hypot(x, z);
    const w = fbm(nWarp, x * world.warp.frequency, z * world.warp.frequency, 3);
    return r + w * world.warp.amplitude * smoothstep(30, 130, r);
  }

  /** Blend weights for each biome at a warped radius. Sums to 1. */
  function weightsAtRadius(rw, out = []) {
    let prev = 1;
    for (let i = 0; i < bounds.length; i++) {
      const s = smoothstep(bounds[i] - blend, bounds[i] + blend, rw);
      out[i] = prev - s;
      prev = s;
    }
    out[bounds.length] = prev;
    return out;
  }

  const tmpW = [];
  function biomeWeights(x, z, out = []) {
    return weightsAtRadius(warpedRadius(x, z), out);
  }

  function biomeAt(x, z) {
    const rw = warpedRadius(x, z);
    for (let i = 0; i < bounds.length; i++) if (rw < bounds[i]) return i;
    return bounds.length;
  }

  function heightAt(x, z) {
    const rw = warpedRadius(x, z);
    const w = weightsAtRadius(rw, tmpW);
    const base = -piecewise(world.depthProfile, rw);
    let h = base;

    // Shallows: soft dunes.
    if (w[0] > 0) h += w[0] * fbm(nDune, x * 0.021, z * 0.021, 3) * 1.8;

    // Kelp forest: rolling floor broken by rocky outcrops.
    if (w[1] > 0) {
      const k = ridged(nRock, x * 0.017, z * 0.017, 3);
      h += w[1] * (smoothstep(0.52, 0.9, k) * 10 + fbm(nDune, x * 0.012, z * 0.012, 3) * 3);
    }

    // Stone plateaus: the floor lerps up to flat mesa tops.
    if (w[2] > 0) {
      const m = fbm(nMesa, x * 0.0075, z * 0.0075, 3);
      const mesa = smoothstep(0.02, 0.3, m) * smoothstep(0.5, 1, w[2]); // only in the biome core
      const top = -88 - fbm(nDune, x * 0.03, z * 0.03, 2) * 2.5 + smoothstep(0.3, 0.6, m) * 5;
      const floor = base + fbm(nRock, x * 0.02, z * 0.02, 3) * 3;
      h += w[2] * (lerp(floor, Math.max(top, floor), mesa) - base);
    }

    // Glow trench: ridged canyon walls dropping into the dark.
    if (w[3] > 0) {
      const t = ridged(nTrench, x * 0.0065, z * 0.0065, 4);
      h += w[3] * (t * 42 - 30 + fbm(nRock, x * 0.03, z * 0.03, 2) * 3);
    }

    // Keep a calm sandy patch under the raft.
    const r = Math.hypot(x, z);
    const flat = 1 - smoothstep(world.raft.flattenRadius * 0.4, world.raft.flattenRadius, r);
    if (flat > 0) h = lerp(h, -world.raft.flattenDepth + fbm(nDune, x * 0.05, z * 0.05, 2) * 0.4, flat);

    return clamp(h, -world.maxDepth, -world.minDepth);
  }

  function normalAt(x, z, eps = 0.8, out = { x: 0, y: 1, z: 0 }) {
    const dx = heightAt(x - eps, z) - heightAt(x + eps, z);
    const dz = heightAt(x, z - eps) - heightAt(x, z + eps);
    const dy = 2 * eps;
    const len = Math.hypot(dx, dy, dz);
    out.x = dx / len; out.y = dy / len; out.z = dz / len;
    return out;
  }

  const tmpC = [];
  /** sRGB colour of the seafloor. `ny` is the surface normal's y (1 = flat). */
  function surfaceColorAt(x, z, ny, out = [0, 0, 0]) {
    const w = biomeWeights(x, z, tmpC);
    const rockiness = smoothstep(0.9, 0.62, ny);
    const tint = 1 + nTint(x * 0.06, z * 0.06) * 0.07 + nTint(x * 0.4, z * 0.4) * 0.04;
    out[0] = out[1] = out[2] = 0;
    for (let i = 0; i < w.length; i++) {
      if (w[i] <= 0) continue;
      for (let c = 0; c < 3; c++) out[c] += w[i] * lerp(sand[i][c], rock[i][c], rockiness);
    }
    for (let c = 0; c < 3; c++) out[c] = clamp(out[c] * tint, 0, 1);
    return out;
  }

  return { world, biomes, warpedRadius, biomeWeights, biomeAt, heightAt, normalAt, surfaceColorAt, depthAt: (x, z) => -heightAt(x, z) };
}
