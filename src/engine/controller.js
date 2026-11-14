// Keyboard + pointer-lock mouse look. Produces the plain input object the
// simulation expects; knows nothing about physics.
export function createController(canvas, sim, { onLockChange } = {}) {
  const keys = new Set();
  const listeners = new Map(); // code -> [fn]
  const input = { forward: 0, strafe: 0, vertical: 0, burst: false, yaw: 0, pitch: 0 };
  const sensitivity = 0.0022;
  const GAME_KEYS = new Set(['Space', 'Tab', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyC', 'ShiftLeft', 'ShiftRight']);

  const locked = () => document.pointerLockElement === canvas;

  window.addEventListener('keydown', (e) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);
    for (const fn of listeners.get(e.code) || []) fn(e);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  document.addEventListener('mousemove', (e) => {
    if (!locked()) return;
    // Ignore the occasional huge delta browsers emit when the lock engages.
    if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
    sim.player.yaw -= e.movementX * sensitivity;
    sim.player.pitch = Math.max(-1.55, Math.min(1.55, sim.player.pitch - e.movementY * sensitivity));
  });
  document.addEventListener('pointerlockchange', () => {
    if (!locked()) keys.clear();
    onLockChange?.(locked());
  });

  return {
    locked,
    requestLock() {
      const p = canvas.requestPointerLock?.();
      if (p && p.catch) p.catch(() => {});
    },
    releaseLock() { if (locked()) document.exitPointerLock(); },
    /** Run fn once per physical key press. */
    onKey(code, fn) {
      if (!listeners.has(code)) listeners.set(code, []);
      listeners.get(code).push(fn);
    },
    isDown: (code) => keys.has(code),
    read() {
      const k = (c) => (keys.has(c) ? 1 : 0);
      input.forward = k('KeyW') - k('KeyS');
      input.strafe = k('KeyD') - k('KeyA');
      input.vertical = k('Space') - k('KeyC');
      input.burst = keys.has('ShiftLeft') || keys.has('ShiftRight');
      input.yaw = sim.player.yaw;
      input.pitch = sim.player.pitch;
      return input;
    },
  };
}
