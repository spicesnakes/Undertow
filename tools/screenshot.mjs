// Dev-only visual smoke test: serves the repo, opens the game in headless
// Chromium (software WebGL), teleports to each biome and saves screenshots.
//   npm i --no-save playwright three@0.170.0   (three is only needed offline)
//   node tools/screenshot.mjs [outDir]
// Set THREE_LOCAL=/path/to/three.module.js to serve Three.js from disk when
// the CDN is unreachable.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(root, 'shots'));
fs.mkdirSync(out, { recursive: true });
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const file = fs.existsSync(p) && fs.statSync(p).isDirectory() ? path.join(p, 'index.html') : p;
  if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const url = `http://localhost:${server.address().port}/index.html?debug&autostart`;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
page.on('requestfailed', (r) => errors.push('REQUEST FAILED ' + r.url()));
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
if (process.env.THREE_LOCAL) {
  await page.route('**/three.module.js', (r) => r.fulfill({ path: process.env.THREE_LOCAL, contentType: 'text/javascript' }));
}
await page.goto(url);
try {
  await page.waitForFunction(() => window.__undertow?.ready, null, { timeout: 30000 });
} catch (e) {
  console.log('Game failed to start.\n' + errors.join('\n'));
  process.exit(1);
}

const extra = process.env.SHOTS ? JSON.parse(process.env.SHOTS) : [];
const shots = [
  { name: 'raft-surface', js: 'g.debug.teleport(0, 0.3, 7.5, 0, 0.05)' },
  { name: 'raft-below', js: 'g.debug.teleport(6, -5, 9, 0.5, 0.45)' },
  { name: 'shallows', js: 'g.debug.teleportToBiome(0)' },
  { name: 'kelp', js: 'g.debug.teleportToBiome(1)' },
  { name: 'plateaus', js: 'g.debug.teleportToBiome(2)' },
  { name: 'trench', js: 'g.debug.teleportToBiome(3)' },
  ...extra,
];
for (const s of shots) {
  await page.evaluate(`{ const g = window.__undertow; g.sim.flags.freeFly = true; ${s.js}; }`);
  const start = await page.evaluate(() => window.__undertow.frames);
  await page.waitForFunction((f) => window.__undertow.frames > f + 12, start, { timeout: 60000 });
  await page.screenshot({ path: path.join(out, s.name + '.png') });
  console.log('shot', s.name, await page.evaluate(() => document.getElementById('debug-stats').textContent.replace(/\n/g, ' | ')));
}
if (errors.length) console.log('CONSOLE:\n' + [...new Set(errors)].join('\n'));
await browser.close();
server.close();
