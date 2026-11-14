import { TUNING } from '../data/tuning.js';

// alive -> blackout (fade to black) -> hold -> waking (fade back in) -> alive
export function createSurvival() {
  return { phase: 'alive', timer: 0 };
}

/** Returns 'blackout', 'respawn', 'revived' or null. */
export function stepSurvival(s, dt, depleted, T = TUNING.blackout) {
  switch (s.phase) {
    case 'alive':
      if (depleted) { s.phase = 'blackout'; s.timer = 0; return 'blackout'; }
      return null;
    case 'blackout':
      s.timer += dt;
      if (s.timer >= T.fadeOut) { s.phase = 'hold'; s.timer = 0; return 'respawn'; }
      return null;
    case 'hold':
      s.timer += dt;
      if (s.timer >= T.hold) { s.phase = 'waking'; s.timer = 0; }
      return null;
    case 'waking':
      s.timer += dt;
      if (s.timer >= T.fadeIn) { s.phase = 'alive'; s.timer = 0; return 'revived'; }
      return null;
  }
  return null;
}

/** 0 = clear, 1 = fully black. */
export function blackoutAmount(s, T = TUNING.blackout) {
  if (s.phase === 'blackout') return Math.min(1, s.timer / T.fadeOut);
  if (s.phase === 'hold') return 1;
  if (s.phase === 'waking') return Math.max(0, 1 - s.timer / T.fadeIn);
  return 0;
}

/**
 * Where to wake up: the most recently built base that has a hatch, otherwise
 * the raft. bases: [{ respawn:{x,y,z}, builtAt:number, yaw? }]
 */
export function pickRespawn(bases, raftSpawn) {
  let best = null;
  for (const b of bases || []) {
    if (!b.respawn) continue;
    if (!best || b.builtAt > best.builtAt) best = b;
  }
  if (best) return { pos: { ...best.respawn }, yaw: best.yaw || 0, pitch: 0, at: 'base' };
  return { pos: { ...raftSpawn.pos }, yaw: raftSpawn.yaw, pitch: raftSpawn.pitch, at: 'raft' };
}
