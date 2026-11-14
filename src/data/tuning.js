// Player and survival tuning. Pure data - safe to import from Node.
export const TUNING = {
  player: {
    radius: 0.6,          // collision sphere around the eye, metres
    swimSpeed: 4.6,       // cruise speed, m/s
    drag: 2.4,            // 1/s - higher = snappier stops, lower = more glide
    burstMultiplier: 1.6, // Shift
    gravity: 12,          // only applies when the head is out of the water
    floatHeight: 0.3,     // eye height the swimmer bobs at on the surface
    maxHeight: 0.7,
    freeFlyMultiplier: 5,
  },
  oxygen: {
    baseCapacity: 45,     // seconds of air
    refillRate: 30,       // seconds of air regained per second at the surface / in a base
    burstDrain: 1.4,      // drain multiplier while bursting
    surfaceMargin: 0.15,  // eye this far below the surface counts as submerged
    overDepthStep: 25,    // every this many metres past the rating adds +1x drain
    overDepthMax: 4,
    lowWarning: 10,
  },
  depth: {
    baseRating: 90,
  },
  blackout: {
    fadeOut: 1.6,
    hold: 0.5,
    fadeIn: 1.8,
  },
};
