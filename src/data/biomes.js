// Biomes, ordered from the raft outwards. `outerRadius` is in warped-distance
// space (see logic/terrain.js). Colours are sRGB hex.
export const BIOMES = [
  {
    id: 'shallows',
    name: 'Sunlit Shallows',
    depthRange: [0, 30],
    outerRadius: 125,
    sand: '#d9c9a0',
    rock: '#9a8f7c',
    fogTint: [1.0, 1.0, 1.0],
    blurb: 'Warm, bright water over rippled sand.',
  },
  {
    id: 'kelp',
    name: 'Kelp Forest',
    depthRange: [30, 80],
    outerRadius: 270,
    sand: '#8f9a6e',
    rock: '#5d6652',
    fogTint: [0.78, 1.08, 0.84],
    blurb: 'Green twilight between towering fronds.',
  },
  {
    id: 'plateaus',
    name: 'Stone Plateaus',
    depthRange: [80, 150],
    outerRadius: 440,
    sand: '#7d7f8c',
    rock: '#565a6b',
    fogTint: [0.9, 0.95, 1.06],
    blurb: 'Flat-topped mesas rising from a dim plain.',
  },
  {
    id: 'trench',
    name: 'Glow Trench',
    depthRange: [150, 300],
    outerRadius: Infinity,
    sand: '#3b3f5c',
    rock: '#2a2c44',
    fogTint: [0.75, 0.8, 1.18],
    blurb: 'Almost no sunlight. The life here makes its own.',
  },
];
