// DOM heads-up display: oxygen, depth, compass, prompt, warnings, fades.
import { BIOMES } from '../data/biomes.js';
import { blackoutAmount } from '../logic/survival.js';

const PX_PER_DEG = 3;
const $ = (id) => document.getElementById(id);

export function createHud() {
  const el = {
    hud: $('hud'), o2Fill: $('o2-fill'), o2Text: $('o2-text'), o2: $('o2'),
    depth: $('depth-value'), rating: $('depth-rating'),
    strip: $('compass-strip'), raftMark: $('compass-raft'), compass: $('compass'),
    prompt: $('prompt'), warning: $('warning'), toast: $('toast'),
    fade: $('fade'), vignette: $('vignette'),
  };

  // Compass strip: three turns of ticks so it can scroll without seams.
  const names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
  let html = '';
  for (let d = -360; d < 720; d += 15) {
    const a = ((d % 360) + 360) % 360;
    const label = names[a];
    html += `<span class="tick${label ? ' major' : ''}" style="left:${(d + 360) * PX_PER_DEG}px">${label || ''}</span>`;
  }
  el.strip.innerHTML = html;

  let toastTimer = 0;
  let lastO2 = '', lastDepth = '', lastWarn = null, lastPrompt = null;

  function toast(title, sub = '', seconds = 3.5) {
    el.toast.innerHTML = `<div class="toast-title">${title}</div>${sub ? `<div class="toast-sub">${sub}</div>` : ''}`;
    el.toast.classList.add('show');
    toastTimer = seconds;
  }

  function setPrompt(text) {
    if (text === lastPrompt) return;
    lastPrompt = text;
    el.prompt.innerHTML = text || '';
    el.prompt.classList.toggle('show', !!text);
  }

  function update(sim, dt) {
    const o2 = sim.oxygen;
    const frac = o2.current / o2.capacity;
    const text = Math.ceil(o2.current) + '';
    if (text !== lastO2) { el.o2Text.textContent = text; lastO2 = text; }
    el.o2Fill.style.transform = `scaleX(${frac.toFixed(3)})`;
    el.o2.classList.toggle('low', sim.lowOxygen);
    el.o2.classList.toggle('refill', !sim.submerged && frac < 1);

    const depth = Math.round(sim.depth) + '';
    if (depth !== lastDepth) { el.depth.textContent = depth; lastDepth = depth; }
    el.rating.textContent = `rated ${sim.stats.depthRating} m`;
    el.rating.classList.toggle('over', sim.overDepth);

    // Heading: 0 = north (-z), 90 = east (+x).
    const heading = (((-sim.player.yaw * 180) / Math.PI) % 360 + 360) % 360;
    const half = el.compass.clientWidth / 2;
    el.strip.style.transform = `translateX(${(half - (heading + 360) * PX_PER_DEG).toFixed(1)}px)`;
    const p = sim.player.pos;
    const bearing = (Math.atan2(-p.x, p.z) * 180) / Math.PI; // towards the raft at the origin
    let rel = ((bearing - heading + 540) % 360) - 180;
    const lim = half / PX_PER_DEG - 4;
    el.raftMark.classList.toggle('edge', Math.abs(rel) > lim);
    rel = Math.max(-lim, Math.min(lim, rel));
    el.raftMark.style.transform = `translateX(${(half + rel * PX_PER_DEG).toFixed(1)}px)`;
    el.raftMark.dataset.dist = Math.round(Math.hypot(p.x, p.z)) + ' m';

    let warn = null;
    if (sim.survival.phase !== 'alive') warn = null;
    else if (sim.lowOxygen) warn = 'Oxygen low — head for the surface';
    else if (sim.overDepth) warn = 'Beyond depth rating — air is draining faster';
    else if (sim.atBoundary) warn = 'The current is too strong here — turn back';
    if (warn !== lastWarn) {
      el.warning.textContent = warn || '';
      el.warning.classList.toggle('show', !!warn);
      lastWarn = warn;
    }

    el.fade.style.opacity = blackoutAmount(sim.survival).toFixed(3);
    const lowAmt = sim.lowOxygen ? 1 - o2.current / sim.tuning.oxygen.lowWarning : 0;
    el.vignette.style.opacity = Math.max(lowAmt * 0.9, sim.overDepth ? 0.35 : 0).toFixed(3);

    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) el.toast.classList.remove('show');
    }
  }

  function handleEvents(events) {
    for (const e of events) {
      if (e.type === 'biome') toast(BIOMES[e.biome].name, BIOMES[e.biome].blurb);
      if (e.type === 'respawn') toast(e.at === 'base' ? 'You wake up in your base' : 'You wake up beside the raft', 'Nothing was lost.', 5);
    }
  }

  return { update, handleEvents, toast, setPrompt, show: (v) => el.hud.classList.toggle('hidden', !v) };
}
