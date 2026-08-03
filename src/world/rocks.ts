/**
 * Rocks / cliffs from slope + height of the shared height field.
 *
 *   if (height > rockHeight && slope > cliffThreshold) spawnRock()
 */

import * as THREE from 'three';
import type { ScatterInstance } from './types';

export interface RockGate {
  minHeight: number;
  minSlope: number;
}

export const DEFAULT_ROCK_GATE: RockGate = {
  minHeight: 0.15,
  minSlope: 0.08,
};

export function canSpawnRock(
  slope: number,
  height: number,
  gate: RockGate = DEFAULT_ROCK_GATE,
): boolean {
  return height > gate.minHeight && slope > gate.minSlope;
}

export interface RockScatterRequest {
  count: number;
  positions: { x: number; y: number; z: number; scale?: number; yaw?: number }[];
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

export function createRockInstances(req: RockScatterRequest): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(req.geometry, req.material, req.count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const e = new THREE.Euler();

  for (let i = 0; i < req.count; i++) {
    const pos = req.positions[i];
    if (!pos) continue;
    p.set(pos.x, pos.y, pos.z);
    e.set(0, pos.yaw ?? 0, 0);
    q.setFromEuler(e);
    const sc = pos.scale ?? 1;
    s.set(sc, sc, sc);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createRockScatterGroup(rocks: ScatterInstance[]): THREE.Group {
  const group = new THREE.Group();
  if (rocks.length === 0) return group;

  const pillars = rocks.filter((r) => (r.scaleY ?? 1) > 1.35);
  const pebbles = rocks.filter((r) => (r.scaleY ?? 1) <= 1.35);

  if (pebbles.length > 0) {
    const geom = new THREE.DodecahedronGeometry(0.14, 0);
    const mat = new THREE.MeshToonMaterial({ color: 0x6e7584 });
    const mesh = createRockInstances({
      count: pebbles.length,
      positions: pebbles.map((r) => ({
        x: r.x,
        y: r.y + 0.06 * r.scale,
        z: r.z,
        scale: r.scale,
        yaw: r.yaw,
      })),
      geometry: geom,
      material: mat,
    });
    group.add(mesh);
  }

  if (pillars.length > 0) {
    // Tall jagged pillars — reference tropical rock clusters
    const geom = new THREE.CylinderGeometry(0.12, 0.18, 0.55, 5);
    const mat = new THREE.MeshToonMaterial({ color: 0x5c6370 });
    const mesh = new THREE.InstancedMesh(geom, mat, pillars.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const e = new THREE.Euler();
    for (let i = 0; i < pillars.length; i++) {
      const r = pillars[i]!;
      const sy = r.scaleY ?? 2.5;
      e.set(0, r.yaw, ((r.yaw * 7) % 0.16) - 0.08);
      q.setFromEuler(e);
      s.set(r.scale * 0.85, sy * 0.55, r.scale * 0.85);
      p.set(r.x, r.y + sy * 0.22, r.z);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  return group;
}
