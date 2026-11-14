// Procedural canvas textures. Nothing is loaded from disk.
import * as THREE from 'three';
import { mulberry32 } from '../logic/rng.js';

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}
function finish(c, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** Tileable grey grain (values near white) to multiply over vertex colours. */
export function makeGrainTexture(size = 256, seed = 11) {
  const rand = mulberry32(seed);
  const c = canvas(size), ctx = c.getContext('2d');
  // Periodic value noise at a few octaves, so the texture tiles cleanly.
  const octaves = [8, 16, 32, 64].map((cells) => {
    const g = new Float32Array(cells * cells);
    for (let i = 0; i < g.length; i++) g[i] = rand();
    return { cells, g };
  });
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0, amp = 0.5, norm = 0;
      for (const { cells, g } of octaves) {
        const fx = (x / size) * cells, fy = (y / size) * cells;
        const x0 = Math.floor(fx), y0 = Math.floor(fy);
        const tx = fx - x0, ty = fy - y0;
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        const x1 = (x0 + 1) % cells, y1 = (y0 + 1) % cells;
        const a = g[y0 * cells + x0], b = g[y0 * cells + x1];
        const d = g[y1 * cells + x0], e = g[y1 * cells + x1];
        v += (a + (b - a) * sx + (d + (e - d) * sx - (a + (b - a) * sx)) * sy) * amp;
        norm += amp;
        amp *= 0.6;
      }
      v = v / norm;
      const speck = rand() < 0.02 ? -0.12 : 0;
      const l = Math.max(0, Math.min(255, (0.72 + v * 0.36 + speck) * 255));
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = l;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finish(c);
}

/** Weathered deck planks. */
export function makePlankTexture(size = 256, seed = 5) {
  const rand = mulberry32(seed);
  const c = canvas(size), ctx = c.getContext('2d');
  const planks = 6, ph = size / planks;
  for (let i = 0; i < planks; i++) {
    const l = 46 + rand() * 12;
    ctx.fillStyle = `hsl(${28 + rand() * 8}, ${30 + rand() * 12}%, ${l}%)`;
    ctx.fillRect(0, i * ph, size, ph);
    for (let k = 0; k < 40; k++) {
      ctx.strokeStyle = `rgba(${rand() < 0.5 ? '40,25,10' : '255,235,200'}, ${0.04 + rand() * 0.08})`;
      ctx.lineWidth = 0.5 + rand() * 1.5;
      const y = i * ph + rand() * ph;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(size * 0.3, y + rand() * 4 - 2, size * 0.6, y + rand() * 4 - 2, size, y);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(20,12,5,0.55)';
    ctx.fillRect(0, i * ph, size, 2);
    const seam = rand() * size;
    ctx.fillRect(seam, i * ph, 2, ph);
    ctx.fillStyle = 'rgba(30,30,35,0.7)';
    for (const dx of [-7, 7]) { ctx.beginPath(); ctx.arc((seam + dx + size) % size, i * ph + ph / 2, 1.6, 0, 7); ctx.fill(); }
  }
  return finish(c);
}

/** Soft round sprite for particles and glows. */
export function makeDotTexture(size = 64) {
  const c = canvas(size), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return finish(c, false);
}
