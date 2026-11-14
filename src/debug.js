// ?debug tools: FPS counter, biome teleports, free-fly, air refill.
import { BIOMES } from './data/biomes.js';

export function createDebug(game) {
  const { sim, terrain } = game;
  const panel = document.createElement('div');
  panel.id = 'debug';
  panel.innerHTML = `
    <div id="debug-stats"></div>
    <div class="debug-row" id="debug-tp"></div>
    <div class="debug-row" id="debug-actions"></div>`;
  document.body.appendChild(panel);
  const stats = panel.querySelector('#debug-stats');

  function teleport(x, y, z, yaw, pitch) {
    const p = sim.player;
    p.pos.x = x; p.pos.y = y; p.pos.z = z;
    p.vel.x = p.vel.y = p.vel.z = 0;
    if (yaw !== undefined) p.yaw = yaw;
    if (pitch !== undefined) p.pitch = pitch;
    sim.oxygen.current = sim.oxygen.capacity;
    game.refreshWorld?.();
  }

  /** A spot inside the given biome, a few metres above the seabed, facing outward. */
  function biomeSpot(index, angle = 0.6) {
    const inner = index === 0 ? 0 : BIOMES[index - 1].outerRadius;
    const outer = Number.isFinite(BIOMES[index].outerRadius) ? BIOMES[index].outerRadius : 560;
    const r0 = index === 0 ? 60 : (inner + outer) / 2;
    for (let k = 0; k < 40; k++) {
      const a = angle + k * 0.4, r = r0 + ((k % 5) - 2) * 8;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (terrain.biomeAt(x, z) === index) return { x, y: terrain.heightAt(x, z) + 5, z, yaw: Math.atan2(-x, -z) + Math.PI };
    }
    return { x: r0, y: -5, z: 0, yaw: 0 };
  }
  function teleportToBiome(index, angle) {
    const s = biomeSpot(index, angle);
    teleport(s.x, s.y, s.z, s.yaw, -0.1);
  }

  const button = (parent, label, fn) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.addEventListener('click', (e) => { fn(); b.blur(); e.stopPropagation(); });
    panel.querySelector(parent).appendChild(b);
    return b;
  };
  button('#debug-tp', 'Raft', () => teleport(0, 0.2, 7.5, 0, 0));
  BIOMES.forEach((b, i) => button('#debug-tp', b.name.split(' ')[1] || b.name, () => teleportToBiome(i)));
  const flyBtn = button('#debug-actions', 'Free-fly: off', () => {
    sim.flags.freeFly = !sim.flags.freeFly;
    flyBtn.textContent = 'Free-fly: ' + (sim.flags.freeFly ? 'on' : 'off');
  });
  button('#debug-actions', 'Refill air', () => { sim.oxygen.current = sim.oxygen.capacity; });

  let frames = 0, acc = 0, fps = 0, worst = 0;
  function update(rawDt, renderer) {
    frames++; acc += rawDt; worst = Math.max(worst, rawDt);
    if (acc >= 0.5) {
      fps = frames / acc;
      const p = sim.player.pos, info = renderer.info.render;
      stats.textContent =
        `${fps.toFixed(0)} fps  (worst ${(worst * 1000).toFixed(0)} ms)\n` +
        `pos ${p.x.toFixed(0)}, ${p.y.toFixed(1)}, ${p.z.toFixed(0)}  floor ${(-terrain.heightAt(p.x, p.z)).toFixed(0)} m\n` +
        `${BIOMES[sim.biome].name}\n` +
        `${info.calls} calls  ${(info.triangles / 1000).toFixed(0)}k tris  ${game.terrainView.chunkCount} chunks`;
      frames = 0; acc = 0; worst = 0;
    }
  }

  return { update, teleport, teleportToBiome, biomeSpot, get fps() { return fps; } };
}
