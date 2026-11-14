// How the water looks at each depth. Interpolated linearly between keys.
export const ENVIRONMENT = {
  // depth (m), fog colour (sRGB hex), FogExp2 density, sun strength 0..1
  depthKeys: [
    { depth: 0,   fog: '#2f9fc0', density: 0.011, sun: 1.0 },
    { depth: 30,  fog: '#1f86ad', density: 0.014, sun: 0.8 },
    { depth: 80,  fog: '#125a80', density: 0.019, sun: 0.5 },
    { depth: 150, fog: '#0a2f52', density: 0.025, sun: 0.2 },
    { depth: 220, fog: '#06193a', density: 0.031, sun: 0.06 },
    { depth: 300, fog: '#030b1c', density: 0.036, sun: 0.02 },
  ],
  air: { fog: '#c4e4f0', density: 0.0005 },
  // Per-metre absorption of red/green/blue sunlight, and the ambient floor
  // that keeps silhouettes readable in the trench.
  absorption: [0.042, 0.015, 0.0105],
  ambientFloor: [0.018, 0.034, 0.062],
  causticDepth: 28,   // caustics fade out with this e-folding depth
  shaftMaxDepth: 75,  // camera depth at which light shafts are gone
  sky: { zenith: '#3f8fd6', horizon: '#c4e4f0', sun: '#fff3d6', waterDeep: '#0d4f73' },
};
