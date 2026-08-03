/**
 * Rocks / cliffs from slope + height of the shared height field.
 *
 *   if (height > rockHeight && slope > cliffThreshold) spawnRock()
 */

import * as THREE from 'three';

export interface RockGate {
  minHeight: number;
  minSlope: number;
}

export const DEFAULT_ROCK_GATE: RockGate = {
  minHeight: 0.9,
  minSlope: 0.55,
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
