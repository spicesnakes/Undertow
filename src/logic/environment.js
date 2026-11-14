import { ENVIRONMENT } from '../data/environment.js';
import { BIOMES } from '../data/biomes.js';
import { lerp, clamp, hexToRgb } from './math.js';

const keys = ENVIRONMENT.depthKeys.map((k) => ({ ...k, rgb: hexToRgb(k.fog) }));

/**
 * Fog colour (sRGB triple), fog density and sun strength for a camera depth,
 * tinted by the local biome mix.
 */
export function sampleEnvironment(depth, biomeWeights = null, out = { fog: [0, 0, 0], density: 0, sun: 1 }) {
  const d = clamp(depth, keys[0].depth, keys[keys.length - 1].depth);
  let i = 1;
  while (i < keys.length - 1 && d > keys[i].depth) i++;
  const a = keys[i - 1], b = keys[i];
  const t = (d - a.depth) / (b.depth - a.depth);
  for (let c = 0; c < 3; c++) out.fog[c] = lerp(a.rgb[c], b.rgb[c], t);
  out.density = lerp(a.density, b.density, t);
  out.sun = lerp(a.sun, b.sun, t);
  if (biomeWeights) {
    for (let c = 0; c < 3; c++) {
      let tint = 0;
      for (let j = 0; j < BIOMES.length; j++) tint += (biomeWeights[j] || 0) * BIOMES[j].fogTint[c];
      out.fog[c] = clamp(out.fog[c] * tint, 0, 1);
    }
  }
  return out;
}
