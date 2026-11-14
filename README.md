# Undertow

A chill underwater exploration and crafting game for desktop browsers
(Chrome, keyboard + mouse). Everything — terrain, textures, creatures, audio —
is generated procedurally; there are no asset files and no build step.

**Status:** milestone 1 of 5 (world, swimming, HUD, oxygen/respawn, raft).

## Run it

Any static file server works, and GitHub Pages can serve the repo root as-is.

```sh
npm run serve        # python3 -m http.server 8080
# then open http://localhost:8080
```

Three.js 0.170.0 is loaded from jsDelivr through the import map in
`index.html`, so the first load needs network access.

## Controls

| Key | Action |
| --- | --- |
| `W` `A` `S` `D` | Swim (forward follows where you look) |
| Mouse | Look (click to capture the pointer) |
| `Space` / `C` | Rise / sink |
| `Shift` | Speed burst — uses air faster |
| `Esc` | Pause / release the mouse |

Oxygen drains under water and refills at the surface. If it runs out you fade
to black and wake up beside the raft with everything you were carrying. Below
your suit's depth rating, air drains faster.

### URL flags

- `?debug` — FPS/position readout, teleport-to-biome buttons, free-fly, air refill.
- `?debug&autostart` — also skips the click-to-start overlay (used by the screenshot tool).
- `?quality=low|medium|high` — render quality (an in-game setting arrives in M5).

## Architecture

```
index.html, css/      page shell, HUD markup and styles
src/data/             tunable content: world layout, biomes, water look, player tuning, quality presets
src/logic/            pure game rules — no Three.js, no DOM; unit tested in Node
  noise, terrain      seeded heightmap + biome layout (shared by rendering and collision)
  physics             swimmer momentum/drag, terrain + box collision, world boundary
  oxygen, survival    air supply, depth rating, blackout/respawn state machine
  environment         fog colour / density / sunlight by depth
  sim                 ties the above into one step function that emits events
src/engine/           Three.js rendering and input
  terrainView         streams heightmap chunks around the camera
  ocean               sea surface (both sides), sky, depth-driven fog and lights
  underwater          shader patch for lit materials: absorption, caustics, dive lamp
  effects             light shafts and drifting particles (GPU-side)
  raft, textures      the start raft; canvas-generated textures
  controller          keyboard + pointer-lock input -> plain input object
src/ui/hud.js         DOM HUD
src/debug.js          ?debug tools (loaded on demand)
tests/                node:test unit tests for src/logic
tools/screenshot.mjs  headless-Chromium visual smoke test (dev only)
```

The engine never decides game outcomes: each frame it reads input, calls
`stepSim`, then draws the resulting state. That keeps every rule testable
without a browser.

## Tests

```sh
npm test
```

Optional visual smoke test (needs Playwright; uses software WebGL):

```sh
node tools/screenshot.mjs shots/
```
