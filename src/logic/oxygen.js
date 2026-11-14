import { TUNING } from '../data/tuning.js';

export function createOxygen(capacity = TUNING.oxygen.baseCapacity) {
  return { current: capacity, capacity };
}

/** How much faster air is used at `depth` with a suit rated for `rating`. */
export function depthDrainMultiplier(depth, rating, T = TUNING.oxygen) {
  if (depth <= rating) return 1;
  return Math.min(T.overDepthMax, 1 + (depth - rating) / T.overDepthStep);
}

/**
 * ctx: { breathing, depth, depthRating, burst }
 * `breathing` is true at the surface or inside a sealed base.
 */
export function stepOxygen(o2, dt, ctx, T = TUNING.oxygen) {
  const result = { overDepth: false, depleted: false, low: false, rate: 0 };
  if (ctx.breathing) {
    o2.current = Math.min(o2.capacity, o2.current + T.refillRate * dt);
    result.rate = -T.refillRate;
  } else {
    const mult = depthDrainMultiplier(ctx.depth, ctx.depthRating, T);
    result.overDepth = mult > 1;
    result.rate = mult * (ctx.burst ? T.burstDrain : 1);
    o2.current = Math.max(0, o2.current - result.rate * dt);
  }
  result.low = o2.current <= T.lowWarning;
  result.depleted = o2.current <= 0;
  return result;
}
