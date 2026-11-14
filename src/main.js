import * as THREE from 'three';
import { QUALITY, DEFAULT_QUALITY } from './data/quality.js';
import { createTerrain } from './logic/terrain.js';
import { createSim, stepSim } from './logic/sim.js';
import { createTerrainView } from './engine/terrainView.js';
import { createOcean } from './engine/ocean.js';
import { createEffects } from './engine/effects.js';
import { createRaft } from './engine/raft.js';
import { createController } from './engine/controller.js';
import { createHud } from './ui/hud.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const qualityName = QUALITY[params.get('quality')] ? params.get('quality') : DEFAULT_QUALITY;
const quality = QUALITY[qualityName];

const canvas = document.getElementById('game');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-action');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: qualityName !== 'low', powerPreference: 'high-performance' });
} catch (err) {
  overlayTitle.textContent = 'WebGL is not available in this browser.';
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * Math.min(1, quality.pixelRatio));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, 1, 0.12, 2600);
camera.rotation.order = 'YXZ';

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const terrain = createTerrain();
const sim = createSim({ terrain });
const ocean = createOcean(scene, terrain);
const terrainView = createTerrainView(scene, terrain, quality);
const effects = createEffects(scene, quality, ocean.sunDir);
const raft = createRaft(scene, terrain);
sim.colliders.push(...raft.colliders);
const hud = createHud();

const game = { sim, terrain, scene, camera, renderer, terrainView, ocean, quality, running: false, time: 0, frames: 0 };

const controller = createController(canvas, sim, {
  onLockChange(locked) {
    if (autostart) return;
    game.running = locked;
    overlay.classList.toggle('hidden', locked);
    if (!locked) overlayTitle.textContent = 'Paused — click to resume';
  },
});
const autostart = DEBUG && params.has('autostart');
overlay.addEventListener('click', () => controller.requestLock());
canvas.addEventListener('click', () => { if (!controller.locked()) controller.requestLock(); });

function syncCamera() {
  const p = sim.player;
  camera.position.set(p.pos.x, p.pos.y, p.pos.z);
  camera.rotation.set(p.pitch, p.yaw, 0);
}

/** Build everything around the camera right now (after spawn or teleport). */
game.refreshWorld = () => {
  syncCamera();
  const env = ocean.update(camera, game.time);
  terrainView.update(camera.position, Math.min(quality.viewDistance, env.viewDistance), Infinity);
};

let debug = null;
if (DEBUG) {
  const { createDebug } = await import('./debug.js');
  debug = createDebug(game);
  game.debug = debug;
  window.__undertow = game;
}

game.refreshWorld();
hud.toast('Sunlit Shallows', 'Your raft is anchored here. The sea floor falls away in every direction.', 6);
if (autostart) {
  game.running = true;
  overlay.classList.add('hidden');
}

let last = performance.now();
function frame(now) {
  const rawDt = (now - last) / 1000;
  last = now;
  const dt = Math.min(rawDt, 0.05);
  game.time += dt;

  if (game.running) {
    const events = stepSim(sim, controller.read(), dt);
    if (events.length) {
      hud.handleEvents(events);
      if (events.some((e) => e.type === 'respawn')) game.refreshWorld();
    }
    hud.update(sim, dt);
  }

  syncCamera();
  // A little roll and bob at the surface sells the swell.
  if (camera.position.y > -0.5) camera.position.y += Math.sin(game.time * 1.3) * 0.04;
  const env = ocean.update(camera, game.time);
  terrainView.update(camera.position, Math.min(quality.viewDistance, env.viewDistance), 2);
  effects.update(camera, game.time, env, renderer.domElement.height, -terrain.heightAt(camera.position.x, camera.position.z));
  raft.update(game.time);
  renderer.render(scene, camera);
  debug?.update(rawDt, renderer);
  game.frames++;
  requestAnimationFrame(frame);
}
hud.update(sim, 0);
game.ready = true;
requestAnimationFrame(frame);
