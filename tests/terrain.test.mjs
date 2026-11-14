import test from 'node:test';
import assert from 'node:assert/strict';
import { createTerrain } from '../src/logic/terrain.js';
import { createNoise2D, fbm, ridged } from '../src/logic/noise.js';
import { piecewise, smoothstep } from '../src/logic/math.js';
import { sampleEnvironment } from '../src/logic/environment.js';
import { WORLD } from '../src/data/world.js';
import { BIOMES } from '../src/data/biomes.js';

test('noise is deterministic and bounded', () => {
  const a = createNoise2D(7), b = createNoise2D(7), c = createNoise2D(8);
  let differs = false;
  for (let i = 0; i < 2000; i++) {
    const x = i * 0.37 - 300, y = i * 0.11 + 5;
    const v = a(x, y);
    assert.equal(v, b(x, y));
    assert.ok(v >= -1.1 && v <= 1.1, `noise out of range: ${v}`);
    if (v !== c(x, y)) differs = true;
    const r = ridged(a, x, y);
    assert.ok(r >= 0 && r <= 1);
    assert.ok(Math.abs(fbm(a, x, y)) <= 1.1);
  }
  assert.ok(differs);
});

test('math helpers', () => {
  assert.equal(piecewise([[0, 0], [10, 20]], 5), 10);
  assert.equal(piecewise([[0, 1], [10, 20]], -5), 1);
  assert.equal(piecewise([[0, 1], [10, 20]], 50), 20);
  assert.equal(smoothstep(0, 1, 0.5), 0.5);
});

const terrain = createTerrain();

test('seafloor under the raft is shallow and calm', () => {
  for (let a = 0; a < 6; a++) {
    const d = terrain.depthAt(Math.cos(a) * 8, Math.sin(a) * 8);
    assert.ok(d > 6 && d < 10, `depth ${d}`);
  }
  assert.equal(terrain.biomeAt(0, 0), 0);
});

test('terrain stays inside world depth limits everywhere', () => {
  for (let x = -700; x <= 700; x += 23) {
    for (let z = -700; z <= 700; z += 23) {
      const d = terrain.depthAt(x, z);
      assert.ok(d >= WORLD.minDepth && d <= WORLD.maxDepth, `depth ${d} at ${x},${z}`);
    }
  }
});

test('biomes appear in order outward and match their depth bands', () => {
  const stats = BIOMES.map(() => ({ n: 0, sum: 0, min: Infinity, max: -Infinity }));
  for (let x = -640; x <= 640; x += 9) {
    for (let z = -640; z <= 640; z += 9) {
      if (Math.hypot(x, z) > WORLD.radius) continue;
      const s = stats[terrain.biomeAt(x, z)];
      const d = terrain.depthAt(x, z);
      s.n++; s.sum += d; s.min = Math.min(s.min, d); s.max = Math.max(s.max, d);
    }
  }
  let prevMean = 0;
  stats.forEach((s, i) => {
    assert.ok(s.n > 100, `${BIOMES[i].id} has area`);
    const mean = s.sum / s.n;
    const [lo, hi] = BIOMES[i].depthRange;
    assert.ok(mean > lo && mean < hi, `${BIOMES[i].id} mean depth ${mean.toFixed(1)} not in ${lo}-${hi}`);
    // Allow some slop at blended borders.
    assert.ok(s.min > lo - 15, `${BIOMES[i].id} min ${s.min.toFixed(1)}`);
    assert.ok(s.max < hi + 25, `${BIOMES[i].id} max ${s.max.toFixed(1)}`);
    assert.ok(mean > prevMean);
    prevMean = mean;
  });
});

test('biome weights sum to one and normals are unit length', () => {
  for (let i = 0; i < 300; i++) {
    const x = Math.sin(i * 12.9) * 600, z = Math.cos(i * 7.3) * 600;
    const w = terrain.biomeWeights(x, z);
    assert.ok(Math.abs(w.reduce((a, b) => a + b, 0) - 1) < 1e-9);
    w.forEach((v) => assert.ok(v >= -1e-9));
    const n = terrain.normalAt(x, z);
    assert.ok(Math.abs(Math.hypot(n.x, n.y, n.z) - 1) < 1e-9);
    assert.ok(n.y > 0);
    const c = terrain.surfaceColorAt(x, z, n.y);
    c.forEach((v) => assert.ok(v >= 0 && v <= 1));
  }
});

test('environment gets darker and murkier with depth', () => {
  let prev = sampleEnvironment(0, null, { fog: [0, 0, 0] });
  for (const d of [20, 60, 120, 200, 300]) {
    const e = sampleEnvironment(d, null, { fog: [0, 0, 0] });
    assert.ok(e.density > prev.density);
    assert.ok(e.sun < prev.sun);
    assert.ok(e.fog[2] < prev.fog[2]);
    prev = e;
  }
  const tinted = sampleEnvironment(50, [0, 1, 0, 0], { fog: [0, 0, 0] });
  const plain = sampleEnvironment(50, null, { fog: [0, 0, 0] });
  assert.ok(tinted.fog[0] < plain.fog[0]);
});
