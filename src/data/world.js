// World layout. Distances in metres. y = 0 is the sea surface, depth = -y.
export const WORLD = {
  seed: 20261,
  radius: 610,       // soft boundary - a current pushes the player back past this
  hardRadius: 650,   // nobody gets past this
  chunkSize: 64,
  minDepth: 3.5,     // seafloor never rises above this depth
  maxDepth: 300,
  // Seafloor depth as a function of (noise-warped) distance from the raft.
  depthProfile: [
    [0, 8], [40, 10], [110, 24], [140, 34], [250, 70], [280, 84],
    [305, 112], [420, 138], [450, 160], [520, 228], [600, 284], [720, 296],
  ],
  warp: { amplitude: 45, frequency: 0.004 },
  biomeBlend: 18,    // half-width of the transition band between biomes
  raft: {
    halfSize: 2.6,
    flattenRadius: 34,
    flattenDepth: 8,
  },
  spawn: { pos: { x: 0, y: 0.2, z: 7.5 }, yaw: 0, pitch: -0.05 },
  sunDir: [0.36, 0.86, 0.3],
};
