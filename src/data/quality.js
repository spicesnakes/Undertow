export const QUALITY = {
  low:    { label: 'Low',    pixelRatio: 0.75, chunkSegments: 20, viewDistance: 130, particles: 500,  shaftGrid: 5, caustics: false },
  medium: { label: 'Medium', pixelRatio: 1.0,  chunkSegments: 32, viewDistance: 180, particles: 1400, shaftGrid: 7, caustics: true },
  high:   { label: 'High',   pixelRatio: 2.0,  chunkSegments: 48, viewDistance: 220, particles: 2600, shaftGrid: 9, caustics: true },
};
export const DEFAULT_QUALITY = 'medium';
