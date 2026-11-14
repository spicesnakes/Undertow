// Swimmer movement and collision. Plain objects only - no Three.js.

/**
 * Advance a swimmer one step.
 * body:  { pos:{x,y,z}, vel:{x,y,z} } (mutated)
 * input: { forward, strafe, vertical, burst, yaw, pitch }
 * env:   { params, speed, terrain, colliders, world, freeFly }
 * Returns contact flags.
 */
export function stepSwimmer(body, input, dt, env) {
  const P = env.params;
  const { pos, vel } = body;
  const cy = Math.cos(input.yaw), sy = Math.sin(input.yaw);
  const cp = Math.cos(input.pitch), sp = Math.sin(input.pitch);
  const f = input.forward || 0, s = input.strafe || 0, v = input.vertical || 0;

  // Wish direction: forward follows the view, strafe is level, vertical is world-up.
  let wx = -sy * cp * f + cy * s;
  let wy = sp * f + v;
  let wz = -cy * cp * f - sy * s;
  const wl = Math.hypot(wx, wy, wz);
  if (wl > 1) { wx /= wl; wy /= wl; wz /= wl; }

  const speed = env.speed * (input.burst ? P.burstMultiplier : 1);
  let tx = wx * speed, ty = wy * speed, tz = wz * speed;

  // Near the surface, upward thrust fades out and gravity fades in so the
  // swimmer bobs with their head just clear of the water.
  let gravity = 0;
  if (!env.freeFly) {
    if (ty > 0) ty *= Math.min(1, Math.max(0, (P.floatHeight - pos.y) / 0.3));
    gravity = P.gravity * Math.min(1, Math.max(0, (pos.y - P.floatHeight) / 0.2));
  }

  // Exact exponential approach to the target velocity: stable for any dt.
  const e = Math.exp(-P.drag * dt);
  vel.x = vel.x * e + tx * (1 - e);
  vel.y = vel.y * e + ty * (1 - e) - gravity * dt;
  vel.z = vel.z * e + tz * (1 - e);

  pos.x += vel.x * dt;
  pos.y += vel.y * dt;
  pos.z += vel.z * dt;

  const info = { grounded: false, hitCollider: false, atBoundary: false };

  const ceiling = env.freeFly ? 60 : P.maxHeight;
  if (pos.y > ceiling) { pos.y = ceiling; if (vel.y > 0) vel.y = 0; }

  // World boundary: a current that gets stronger the further out you go.
  const world = env.world;
  if (world) {
    const r = Math.hypot(pos.x, pos.z);
    if (r > world.radius) {
      info.atBoundary = true;
      const push = (r - world.radius) * 1.2 * dt;
      vel.x -= (pos.x / r) * push;
      vel.z -= (pos.z / r) * push;
      if (r > world.hardRadius) {
        const k = world.hardRadius / r;
        pos.x *= k; pos.z *= k;
        const vr = (vel.x * pos.x + vel.z * pos.z) / world.hardRadius;
        if (vr > 0) { vel.x -= (pos.x / world.hardRadius) * vr; vel.z -= (pos.z / world.hardRadius) * vr; }
      }
    }
  }

  // Solid boxes (raft, base modules).
  const boxes = env.colliders;
  if (boxes) {
    for (let i = 0; i < boxes.length; i++) {
      if (collideSphereBox(pos, vel, P.radius, boxes[i])) info.hitCollider = true;
    }
  }

  // Seafloor.
  const terrain = env.terrain;
  if (terrain) {
    const minY = terrain.heightAt(pos.x, pos.z) + P.radius;
    if (pos.y < minY) {
      const n = terrain.normalAt(pos.x, pos.z);
      const pen = minY - pos.y;
      pos.x += n.x * pen * 0.5;
      pos.z += n.z * pen * 0.5;
      pos.y = Math.max(pos.y, terrain.heightAt(pos.x, pos.z) + P.radius);
      const vn = vel.x * n.x + vel.y * n.y + vel.z * n.z;
      if (vn < 0) { vel.x -= n.x * vn; vel.y -= n.y * vn; vel.z -= n.z * vn; }
      info.grounded = true;
    }
  }
  return info;
}

/** Push a sphere out of an axis-aligned box { min:{x,y,z}, max:{x,y,z} }. */
export function collideSphereBox(pos, vel, radius, box) {
  const cx = Math.min(Math.max(pos.x, box.min.x), box.max.x);
  const cy = Math.min(Math.max(pos.y, box.min.y), box.max.y);
  const cz = Math.min(Math.max(pos.z, box.min.z), box.max.z);
  let dx = pos.x - cx, dy = pos.y - cy, dz = pos.z - cz;
  const d2 = dx * dx + dy * dy + dz * dz;
  if (d2 >= radius * radius) return false;
  let nx, ny, nz, push;
  if (d2 > 1e-10) {
    const d = Math.sqrt(d2);
    nx = dx / d; ny = dy / d; nz = dz / d;
    push = radius - d;
  } else {
    // Centre is inside the box: leave through the nearest face.
    const cands = [
      [pos.x - box.min.x, -1, 0, 0], [box.max.x - pos.x, 1, 0, 0],
      [pos.y - box.min.y, 0, -1, 0], [box.max.y - pos.y, 0, 1, 0],
      [pos.z - box.min.z, 0, 0, -1], [box.max.z - pos.z, 0, 0, 1],
    ];
    let best = cands[0];
    for (const c of cands) if (c[0] < best[0]) best = c;
    nx = best[1]; ny = best[2]; nz = best[3];
    push = best[0] + radius;
  }
  pos.x += nx * push; pos.y += ny * push; pos.z += nz * push;
  const vn = vel.x * nx + vel.y * ny + vel.z * nz;
  if (vn < 0) { vel.x -= nx * vn; vel.y -= ny * vn; vel.z -= nz * vn; }
  return true;
}
