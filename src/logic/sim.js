// The whole game simulation, independent of rendering. The engine feeds it
// input each frame and draws whatever state comes out.
import { TUNING } from '../data/tuning.js';
import { WORLD } from '../data/world.js';
import { stepSwimmer } from './physics.js';
import { createOxygen, stepOxygen } from './oxygen.js';
import { createSurvival, stepSurvival, pickRespawn } from './survival.js';

const NO_INPUT = { forward: 0, strafe: 0, vertical: 0, burst: false, yaw: 0, pitch: 0 };

export function createSim({ terrain, tuning = TUNING, world = WORLD } = {}) {
  return {
    tuning, world, terrain,
    time: 0,
    player: {
      pos: { ...world.spawn.pos },
      vel: { x: 0, y: 0, z: 0 },
      yaw: world.spawn.yaw,
      pitch: world.spawn.pitch,
    },
    stats: {
      swimSpeed: tuning.player.swimSpeed,
      depthRating: tuning.depth.baseRating,
      oxygenCapacity: tuning.oxygen.baseCapacity,
    },
    oxygen: createOxygen(tuning.oxygen.baseCapacity),
    survival: createSurvival(),
    colliders: [],   // solid AABBs: raft, base modules
    bases: [],       // respawn candidates
    flags: { freeFly: false },
    // Derived each step, for the HUD and audio:
    depth: 0,
    biome: 0,
    submerged: false,
    inBase: false,
    overDepth: false,
    lowOxygen: false,
    atBoundary: false,
    events: [],
  };
}

export function stepSim(sim, input, dt) {
  const { tuning, player } = sim;
  sim.events.length = 0;
  sim.time += dt;
  const alive = sim.survival.phase === 'alive';
  let inp = input;
  if (!alive) { NO_INPUT.yaw = player.yaw; NO_INPUT.pitch = player.pitch; inp = NO_INPUT; }

  const info = stepSwimmer(player, inp, dt, {
    params: tuning.player,
    speed: sim.stats.swimSpeed * (sim.flags.freeFly ? tuning.player.freeFlyMultiplier : 1),
    terrain: sim.terrain,
    colliders: sim.colliders,
    world: sim.world,
    freeFly: sim.flags.freeFly,
  });
  sim.atBoundary = info.atBoundary;
  sim.depth = Math.max(0, -player.pos.y);
  sim.submerged = player.pos.y < -tuning.oxygen.surfaceMargin;

  const biome = sim.terrain ? sim.terrain.biomeAt(player.pos.x, player.pos.z) : 0;
  if (biome !== sim.biome) {
    sim.biome = biome;
    sim.events.push({ type: 'biome', biome });
  }

  let depleted = false;
  if (alive && !sim.flags.freeFly) {
    const o = stepOxygen(sim.oxygen, dt, {
      breathing: !sim.submerged || sim.inBase,
      depth: sim.depth,
      depthRating: sim.stats.depthRating,
      burst: !!inp.burst && (inp.forward || inp.strafe || inp.vertical),
    }, tuning.oxygen);
    if (o.overDepth && !sim.overDepth) sim.events.push({ type: 'overDepth' });
    sim.overDepth = o.overDepth;
    sim.lowOxygen = o.low && sim.submerged;
    depleted = o.depleted;
  } else {
    sim.overDepth = false;
    sim.lowOxygen = false;
  }

  const ev = stepSurvival(sim.survival, dt, depleted, tuning.blackout);
  if (ev === 'blackout') sim.events.push({ type: 'blackout' });
  if (ev === 'respawn') {
    const r = pickRespawn(sim.bases, sim.world.spawn);
    player.pos.x = r.pos.x; player.pos.y = r.pos.y; player.pos.z = r.pos.z;
    player.vel.x = player.vel.y = player.vel.z = 0;
    player.yaw = r.yaw; player.pitch = r.pitch;
    sim.oxygen.current = sim.oxygen.capacity;
    sim.events.push({ type: 'respawn', at: r.at });
  }
  if (ev === 'revived') sim.events.push({ type: 'revived' });
  return sim.events;
}
