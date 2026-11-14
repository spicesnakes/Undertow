// The starting raft: a plank deck on four floats with a beacon mast.
import * as THREE from 'three';
import { WORLD } from '../data/world.js';
import { patchUnderwater } from './underwater.js';
import { makePlankTexture } from './textures.js';

export function createRaft(scene, terrain) {
  const g = new THREE.Group();
  g.name = 'raft';
  const half = WORLD.raft.halfSize;
  const lit = (params, caustics = false) => patchUnderwater(new THREE.MeshLambertMaterial(params), { caustics });

  const planks = makePlankTexture();
  planks.repeat.set(2, 2);
  const wood = lit({ map: planks });
  const darkWood = lit({ color: 0x5b4027 });
  const floatMat = lit({ color: 0xd9822b }, true);
  const metal = lit({ color: 0x8c979c });
  const rope = lit({ color: 0xb9a57a });

  const deck = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 0.16, half * 2), wood);
  deck.position.y = 0.42;
  g.add(deck);
  for (const z of [-half + 0.3, 0, half - 0.3]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(half * 2 + 0.3, 0.16, 0.22), darkWood);
    beam.position.set(0, 0.27, z);
    g.add(beam);
  }
  const drum = new THREE.CylinderGeometry(0.55, 0.55, half * 2 - 0.4, 14).rotateX(Math.PI / 2);
  for (const x of [-half + 0.6, half - 0.6]) {
    const f = new THREE.Mesh(drum, floatMat);
    f.position.set(x, -0.1, 0);
    g.add(f);
    for (const z of [-1.4, 1.4]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.57, 0.035, 6, 18), metal);
      band.position.set(x, -0.1, z);
      g.add(band);
    }
  }

  // Mast with a blinking beacon so the raft is easy to find from the surface.
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.4, 8), metal);
  mast.position.set(-half + 0.5, 2.2, -half + 0.5);
  g.add(mast);
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffb347 });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), beaconMat);
  beacon.position.set(-half + 0.5, 4.0, -half + 0.5);
  g.add(beacon);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), new THREE.MeshLambertMaterial({ color: 0x2bb3a3, side: THREE.DoubleSide }));
  flag.position.set(-half + 0.98, 3.4, -half + 0.5);
  g.add(flag);

  // Supply crate and a solar panel, for a lived-in look.
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), darkWood);
  crate.position.set(half - 0.8, 0.85, -half + 0.8);
  crate.rotation.y = 0.3;
  g.add(crate);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 1.0), lit({ color: 0x1c2f52 }));
  panel.position.set(-half + 1.2, 0.95, half - 0.9);
  panel.rotation.set(-0.45, 0.2, 0);
  g.add(panel);
  const panelLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), metal);
  panelLeg.position.set(-half + 1.2, 0.72, half - 0.9);
  g.add(panelLeg);

  // Ladder on the side the player spawns facing.
  const railGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.9, 6);
  for (const x of [-0.25, 0.25]) {
    const rail = new THREE.Mesh(railGeo, metal);
    rail.position.set(x, -0.2, half + 0.06);
    g.add(rail);
  }
  for (let i = 0; i < 5; i++) {
    const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6).rotateZ(Math.PI / 2), metal);
    rung.position.set(0, 0.55 - i * 0.38, half + 0.06);
    g.add(rung);
  }

  // Anchor line down to the seabed: follow it up to find home.
  const floorY = terrain.heightAt(0, 0);
  const line = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, -floorY, 5), rope);
  line.position.set(0, floorY / 2, 0);
  g.add(line);
  const anchor = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.7), lit({ color: 0x4a4f55 }, true));
  anchor.position.set(0, floorY + 0.2, 0);
  g.add(anchor);

  scene.add(g);

  const colliders = [
    { min: { x: -half - 0.15, y: -0.65, z: -half }, max: { x: half + 0.15, y: 0.5, z: half } },
    { min: { x: -0.35, y: floorY, z: -0.35 }, max: { x: 0.35, y: floorY + 0.4, z: 0.35 } },
  ];

  function update(time) {
    const bob = Math.sin(time * 0.9) * 0.035;
    g.position.y = bob;
    g.rotation.x = Math.sin(time * 0.7) * 0.012;
    g.rotation.z = Math.cos(time * 0.55) * 0.012;
    const blink = (time % 2.4) < 0.25 ? 1 : 0.18;
    beaconMat.color.setRGB(1.0 * blink + 0.1, 0.62 * blink + 0.05, 0.2 * blink);
    flag.rotation.y = Math.sin(time * 2.1) * 0.25;
  }
  return { group: g, colliders, update };
}
