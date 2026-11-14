// Streams heightmap chunks in around the camera.
import * as THREE from 'three';
import { WORLD } from '../data/world.js';
import { patchUnderwater } from './underwater.js';
import { makeGrainTexture } from './textures.js';

export function createTerrainView(scene, terrain, quality) {
  const size = WORLD.chunkSize;
  const n = quality.chunkSegments;
  const step = size / n;
  const limit = Math.ceil((WORLD.hardRadius + 260) / size);
  const material = patchUnderwater(
    new THREE.MeshLambertMaterial({ vertexColors: true, map: makeGrainTexture() }),
    { caustics: quality.caustics },
  );
  const chunks = new Map();
  const group = new THREE.Group();
  group.name = 'terrain';
  scene.add(group);

  // Index buffer is identical for every chunk.
  const N = n + 1;
  const index = new (N * N > 65535 ? Uint32Array : Uint16Array)(n * n * 6);
  for (let j = 0, k = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * N + i, b = a + 1, c = a + N, d = c + 1;
      index[k++] = a; index[k++] = c; index[k++] = b;
      index[k++] = b; index[k++] = c; index[k++] = d;
    }
  }
  const indexAttr = new THREE.BufferAttribute(index, 1);

  const M = n + 3; // heights with a one-cell border, for seamless normals
  const H = new Float32Array(M * M);
  const col = [0, 0, 0];
  const color = new THREE.Color();

  function build(cx, cz) {
    const x0 = cx * size, z0 = cz * size;
    for (let j = 0; j < M; j++) {
      for (let i = 0; i < M; i++) H[j * M + i] = terrain.heightAt(x0 + (i - 1) * step, z0 + (j - 1) * step);
    }
    const pos = new Float32Array(N * N * 3);
    const nor = new Float32Array(N * N * 3);
    const colr = new Float32Array(N * N * 3);
    const uv = new Float32Array(N * N * 2);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const v = j * N + i, hi = (j + 1) * M + (i + 1);
        const x = x0 + i * step, z = z0 + j * step;
        pos[v * 3] = x; pos[v * 3 + 1] = H[hi]; pos[v * 3 + 2] = z;
        const dx = H[hi - 1] - H[hi + 1], dz = H[hi - M] - H[hi + M], dy = 2 * step;
        const len = Math.hypot(dx, dy, dz);
        nor[v * 3] = dx / len; nor[v * 3 + 1] = dy / len; nor[v * 3 + 2] = dz / len;
        terrain.surfaceColorAt(x, z, dy / len, col);
        color.setRGB(col[0], col[1], col[2], THREE.SRGBColorSpace);
        colr[v * 3] = color.r; colr[v * 3 + 1] = color.g; colr[v * 3 + 2] = color.b;
        uv[v * 2] = x / 7; uv[v * 2 + 1] = z / 7;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colr, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(indexAttr);
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, material);
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
    return mesh;
  }

  const wanted = [];
  /** Call every frame. `budget` = max chunks to generate this frame. */
  function update(camPos, viewDistance, budget = 2) {
    const ccx = Math.floor(camPos.x / size), ccz = Math.floor(camPos.z / size);
    const r = Math.ceil(viewDistance / size);
    wanted.length = 0;
    for (const [key, mesh] of chunks) {
      const dx = mesh.userData.cx - ccx, dz = mesh.userData.cz - ccz;
      const far = Math.max(Math.abs(dx), Math.abs(dz));
      mesh.visible = far <= r;
      if (far > r + 4) {
        group.remove(mesh);
        mesh.geometry.dispose();
        chunks.delete(key);
      }
    }
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const cx = ccx + dx, cz = ccz + dz;
        if (Math.abs(cx) > limit || Math.abs(cz) > limit) continue;
        const key = cx + ',' + cz;
        if (!chunks.has(key)) wanted.push([dx * dx + dz * dz, cx, cz, key]);
      }
    }
    if (!wanted.length) return 0;
    wanted.sort((a, b) => a[0] - b[0]);
    const count = Math.min(budget, wanted.length);
    for (let i = 0; i < count; i++) {
      const [, cx, cz, key] = wanted[i];
      const mesh = build(cx, cz);
      mesh.userData.cx = cx; mesh.userData.cz = cz;
      chunks.set(key, mesh);
    }
    return wanted.length - count;
  }

  return { update, material, get chunkCount() { return chunks.size; } };
}
