/**
 * Biome-masked vegetation via InstancedMesh.
 * Gate on slope + height + biome — not pure randomness.
 */

import * as THREE from 'three';
import type { BiomeWeights } from '../terrain/biome';

export interface ScatterRequest {
  count: number;
  /** World positions already filtered by biome / slope. */
  positions: { x: number; y: number; z: number; scale?: number; yaw?: number }[];
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

export interface TreeGate {
  maxSlope: number;
  minHeight: number;
  minForestWeight: number;
}

export const DEFAULT_TREE_GATE: TreeGate = {
  maxSlope: 0.45,
  minHeight: 0.25,
  minForestWeight: 0.35,
};

/** Flat grasslands become forests; steep cliffs stay empty. */
export function canSpawnTree(
  slope: number,
  height: number,
  weights: BiomeWeights,
  gate: TreeGate = DEFAULT_TREE_GATE,
): boolean {
  return (
    slope < gate.maxSlope &&
    height > gate.minHeight &&
    weights.forest >= gate.minForestWeight
  );
}

/**
 * Build an InstancedMesh from scatter positions.
 */
export function createInstancedScatter(req: ScatterRequest): THREE.InstancedMesh {
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

/** Forest density hint from biome weights (0–1). */
export function forestDensity(weights: BiomeWeights): number {
  return weights.forest;
}
