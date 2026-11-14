import test from 'node:test';
import assert from 'node:assert/strict';
import { createOxygen, stepOxygen, depthDrainMultiplier } from '../src/logic/oxygen.js';
import { createSurvival, stepSurvival, blackoutAmount, pickRespawn } from '../src/logic/survival.js';
import { createSim, stepSim } from '../src/logic/sim.js';
import { createTerrain } from '../src/logic/terrain.js';
import { TUNING } from '../src/data/tuning.js';
import { WORLD } from '../src/data/world.js';

test('oxygen drains one second per second underwater and refills when breathing', () => {
  const o = createOxygen(45);
  for (let i = 0; i < 600; i++) stepOxygen(o, 1 / 60, { breathing: false, depth: 10, depthRating: 90 });
  assert.ok(Math.abs(o.current - 35) < 1e-6);
  const r = stepOxygen(o, 0.5, { breathing: true, depth: 0, depthRating: 90 });
  assert.equal(o.current, 45);
  assert.equal(r.depleted, false);
});

test('oxygen never goes negative or above capacity, and reports depletion', () => {
  const o = createOxygen(5);
  let r;
  for (let i = 0; i < 100; i++) r = stepOxygen(o, 0.1, { breathing: false, depth: 5, depthRating: 90 });
  assert.equal(o.current, 0);
  assert.ok(r.depleted && r.low);
  for (let i = 0; i < 100; i++) stepOxygen(o, 0.1, { breathing: true });
  assert.equal(o.current, 5);
});

test('diving past the depth rating costs more air, up to a cap', () => {
  assert.equal(depthDrainMultiplier(50, 90), 1);
  assert.equal(depthDrainMultiplier(90, 90), 1);
  assert.equal(depthDrainMultiplier(115, 90), 2);
  assert.equal(depthDrainMultiplier(1000, 90), TUNING.oxygen.overDepthMax);
  const o = createOxygen(45);
  const r = stepOxygen(o, 1, { breathing: false, depth: 115, depthRating: 90 });
  assert.ok(r.overDepth);
  assert.equal(o.current, 43);
  const o2 = createOxygen(45);
  stepOxygen(o2, 1, { breathing: false, depth: 10, depthRating: 90, burst: true });
  assert.ok(Math.abs(o2.current - (45 - TUNING.oxygen.burstDrain)) < 1e-9);
});

test('survival state machine: blackout -> respawn -> revived', () => {
  const s = createSurvival();
  const T = TUNING.blackout;
  assert.equal(stepSurvival(s, 0.1, false), null);
  assert.equal(blackoutAmount(s), 0);
  assert.equal(stepSurvival(s, 0.1, true), 'blackout');
  const events = [];
  let peak = 0;
  for (let t = 0; t < T.fadeOut + T.hold + T.fadeIn + 0.5; t += 0.05) {
    const e = stepSurvival(s, 0.05, false); // the respawn refills the tank
    if (e) events.push(e);
    peak = Math.max(peak, blackoutAmount(s));
  }
  assert.deepEqual(events, ['respawn', 'revived']);
  assert.equal(peak, 1);
  assert.equal(s.phase, 'alive');
  assert.equal(blackoutAmount(s), 0);
});

test('respawn picks the newest base with a hatch, else the raft', () => {
  const raft = WORLD.spawn;
  assert.equal(pickRespawn([], raft).at, 'raft');
  assert.deepEqual(pickRespawn([], raft).pos, raft.pos);
  const bases = [
    { respawn: { x: 1, y: -20, z: 1 }, builtAt: 5 },
    { respawn: { x: 9, y: -40, z: 9 }, builtAt: 12 },
    { respawn: null, builtAt: 99 }, // no hatch yet
  ];
  const r = pickRespawn(bases, raft);
  assert.equal(r.at, 'base');
  assert.deepEqual(r.pos, { x: 9, y: -40, z: 9 });
  r.pos.x = 0;
  assert.equal(bases[1].respawn.x, 9, 'returns a copy');
});

test('sim: drowning fades out, respawns at the raft with a full tank, keeps going', () => {
  const sim = createSim({ terrain: createTerrain() });
  sim.player.pos = { x: 30, y: -5, z: 30 };
  const input = { forward: 0, strafe: 0, vertical: 0, burst: false, yaw: 0, pitch: 0 };
  const seen = [];
  let t = 0;
  for (; t < 120 && !seen.includes('revived'); t += 1 / 30) {
    for (const e of stepSim(sim, input, 1 / 30)) seen.push(e.type);
  }
  assert.deepEqual(seen.filter((e) => e !== 'biome'), ['blackout', 'respawn', 'revived']);
  assert.ok(t > TUNING.oxygen.baseCapacity, 'lasted the whole tank');
  assert.deepEqual(sim.player.pos, WORLD.spawn.pos);
  assert.equal(sim.oxygen.current, sim.oxygen.capacity);
  assert.equal(sim.survival.phase, 'alive');
});

test('sim: no drain at the surface, input ignored while blacked out, free-fly needs no air', () => {
  const sim = createSim({ terrain: createTerrain() });
  const idle = { forward: 0, strafe: 0, vertical: 0, burst: false, yaw: 0, pitch: 0 };
  for (let i = 0; i < 300; i++) stepSim(sim, idle, 1 / 30);
  assert.equal(sim.oxygen.current, sim.oxygen.capacity);
  assert.equal(sim.submerged, false);

  sim.player.pos.y = -6;
  sim.oxygen.current = 0.01;
  stepSim(sim, idle, 1 / 30);
  assert.equal(sim.survival.phase, 'blackout');
  const z = sim.player.pos.z;
  for (let i = 0; i < 10; i++) stepSim(sim, { ...idle, forward: 1 }, 1 / 30);
  assert.ok(Math.abs(sim.player.pos.z - z) < 1e-6);

  const fly = createSim({ terrain: createTerrain() });
  fly.flags.freeFly = true;
  fly.player.pos.y = -50;
  for (let i = 0; i < 3000; i++) stepSim(fly, idle, 1 / 30);
  assert.equal(fly.oxygen.current, fly.oxygen.capacity);
});

test('sim: reports biome changes and over-depth', () => {
  const terrain = createTerrain();
  const sim = createSim({ terrain });
  sim.flags.freeFly = false;
  sim.player.pos = { x: 200, y: -20, z: 0 };
  const idle = { forward: 0, strafe: 0, vertical: 0, burst: false, yaw: 0, pitch: 0 };
  const ev = stepSim(sim, idle, 1 / 30).map((e) => e.type);
  assert.ok(ev.includes('biome'));
  assert.equal(sim.biome, terrain.biomeAt(200, 0));
  sim.player.pos = { x: 500, y: -120, z: 0 };
  const ev2 = stepSim(sim, idle, 1 / 30).map((e) => e.type);
  assert.ok(ev2.includes('overDepth'));
  assert.ok(sim.overDepth);
});
