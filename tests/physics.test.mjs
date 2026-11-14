import test from 'node:test';
import assert from 'node:assert/strict';
import { stepSwimmer, collideSphereBox } from '../src/logic/physics.js';
import { TUNING } from '../src/data/tuning.js';

const P = TUNING.player;
const flat = (h) => ({ heightAt: () => h, normalAt: () => ({ x: 0, y: 1, z: 0 }) });
const mk = (y = -20) => ({ pos: { x: 0, y, z: 0 }, vel: { x: 0, y: 0, z: 0 } });
const input = (o = {}) => ({ forward: 0, strafe: 0, vertical: 0, burst: false, yaw: 0, pitch: 0, ...o });
const env = (o = {}) => ({ params: P, speed: P.swimSpeed, terrain: flat(-100), colliders: [], world: null, freeFly: false, ...o });
const run = (b, i, e, secs, dt = 1 / 60) => { let info; for (let t = 0; t < secs; t += dt) info = stepSwimmer(b, i, dt, e); return info; };

test('swimming forward accelerates to cruise speed along -z at yaw 0', () => {
  const b = mk();
  run(b, input({ forward: 1 }), env(), 4);
  assert.ok(Math.abs(-b.vel.z - P.swimSpeed) < 0.05, `speed ${-b.vel.z}`);
  assert.ok(Math.abs(b.vel.x) < 1e-9 && Math.abs(b.vel.y) < 1e-9);
  assert.ok(b.pos.z < -10);
});

test('momentum: speed builds up and drag glides to a stop', () => {
  const b = mk();
  stepSwimmer(b, input({ forward: 1 }), 1 / 60, env());
  assert.ok(-b.vel.z < P.swimSpeed * 0.1, 'no instant acceleration');
  run(b, input({ forward: 1 }), env(), 3);
  stepSwimmer(b, input(), 1 / 60, env());
  assert.ok(-b.vel.z > P.swimSpeed * 0.9, 'no instant stop');
  run(b, input(), env(), 4);
  assert.ok(Math.hypot(b.vel.x, b.vel.y, b.vel.z) < 0.01);
});

test('burst is faster, diagonal input is not', () => {
  const a = mk(), b = mk();
  run(a, input({ forward: 1, burst: true }), env(), 4);
  assert.ok(Math.abs(-a.vel.z - P.swimSpeed * P.burstMultiplier) < 0.05);
  run(b, input({ forward: 1, strafe: 1, vertical: -1 }), env(), 4);
  assert.ok(Math.abs(Math.hypot(b.vel.x, b.vel.y, b.vel.z) - P.swimSpeed) < 0.05);
});

test('looking down and swimming forward dives; yaw turns the heading', () => {
  const b = mk();
  run(b, input({ forward: 1, pitch: -Math.PI / 2 + 0.01 }), env(), 2);
  assert.ok(b.pos.y < -25);
  const c = mk();
  run(c, input({ forward: 1, yaw: -Math.PI / 2 }), env(), 2); // turned right = east = +x
  assert.ok(c.pos.x > 5 && Math.abs(c.pos.z) < 1e-6);
});

test('result is nearly frame-rate independent', () => {
  const a = mk(), b = mk();
  run(a, input({ forward: 1 }), env(), 2, 1 / 30);
  run(b, input({ forward: 1 }), env(), 2, 1 / 120);
  assert.ok(Math.abs(a.pos.z - b.pos.z) < 0.25, `${a.pos.z} vs ${b.pos.z}`);
});

test('cannot leave the water: rising settles near the float height', () => {
  const b = mk(-3);
  run(b, input({ vertical: 1 }), env(), 5);
  assert.ok(b.pos.y > 0 && b.pos.y <= P.maxHeight, `y ${b.pos.y}`);
  assert.ok(Math.abs(b.pos.y - P.floatHeight) < 0.25);
  run(b, input(), env(), 3);
  assert.ok(b.pos.y > -0.3, 'stays afloat without input');
});

test('seafloor stops the swimmer', () => {
  const b = mk(-8);
  const info = run(b, input({ vertical: -1 }), env({ terrain: flat(-10) }), 3);
  assert.ok(info.grounded);
  assert.ok(Math.abs(b.pos.y - (-10 + P.radius)) < 1e-6);
  assert.ok(b.vel.y >= 0);
});

test('slopes deflect rather than trap', () => {
  const slope = {
    heightAt: (x) => -20 + x, // rises to the east
    normalAt: () => ({ x: -Math.SQRT1_2, y: Math.SQRT1_2, z: 0 }),
  };
  const b = mk(-19);
  b.pos.x = -5;
  run(b, input({ forward: 1, yaw: -Math.PI / 2 }), env({ terrain: slope }), 3);
  assert.ok(b.pos.y >= slope.heightAt(b.pos.x) + P.radius - 1e-6);
  assert.ok(b.pos.x > -5, 'made progress up the slope');
});

test('sphere is pushed out of boxes', () => {
  const box = { min: { x: -1, y: -1, z: -1 }, max: { x: 1, y: 1, z: 1 } };
  const pos = { x: 1.3, y: 0, z: 0 }, vel = { x: -2, y: 0, z: 1 };
  assert.ok(collideSphereBox(pos, vel, 0.6, box));
  assert.ok(Math.abs(pos.x - 1.6) < 1e-9);
  assert.equal(vel.x, 0);
  assert.equal(vel.z, 1);
  const inside = { x: 0.2, y: 0.9, z: 0 };
  assert.ok(collideSphereBox(inside, { x: 0, y: 0, z: 0 }, 0.6, box));
  assert.ok(Math.abs(inside.y - 1.6) < 1e-9);
  assert.equal(collideSphereBox({ x: 5, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 0.6, box), false);
});

test('swimming into a box collider blocks movement', () => {
  const box = { min: { x: -2, y: -30, z: -12 }, max: { x: 2, y: -10, z: -10 } };
  const b = mk();
  const info = run(b, input({ forward: 1 }), env({ colliders: [box] }), 5);
  assert.ok(info.hitCollider);
  assert.ok(b.pos.z >= -10 + P.radius - 1e-6);
});

test('world boundary turns the swimmer back', () => {
  const world = { radius: 100, hardRadius: 120 };
  const b = mk();
  b.pos.x = 95;
  const e = env({ world });
  let flagged = false;
  for (let t = 0; t < 60; t += 1 / 60) {
    if (stepSwimmer(b, input({ forward: 1, yaw: -Math.PI / 2 }), 1 / 60, e).atBoundary) flagged = true;
    assert.ok(Math.hypot(b.pos.x, b.pos.z) <= world.hardRadius + 1e-6);
  }
  assert.ok(flagged);
  run(b, input(), e, 30);
  assert.ok(Math.hypot(b.pos.x, b.pos.z) < world.radius + 3, 'current carries you back in');
});

test('free-fly ignores the surface', () => {
  const b = mk(-1);
  run(b, input({ vertical: 1 }), env({ freeFly: true }), 3);
  assert.ok(b.pos.y > 5);
});
