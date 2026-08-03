/**
 * Island silhouette only — land vs water.
 * Forget heightmaps here: radial falloff + low-frequency simplex + domain warp.
 */

import { fbm2, makePerm } from './noise';

export interface IslandParams {
  seed: number;
  /** Approximate island radius in world units. */
  radius: number;
  /** Strength of radial falloff toward ocean. */
  falloff: number;
  /** Low-frequency domain-warp amplitude. */
  warp: number;
}

export const DEFAULT_ISLAND: IslandParams = {
  seed: 1,
  radius: 12,
  falloff: 1.12,
  warp: 0.42,
};

export interface IslandSeed {
  params: IslandParams;
  perm: Uint8Array;
}

export function createIslandSeed(params: Partial<IslandParams> = {}): IslandSeed {
  const merged = { ...DEFAULT_ISLAND, ...params };
  return { params: merged, perm: makePerm(merged.seed | 0) };
}

/**
 * Soft island membership in [0, 1].
 *   island = radialFalloff + lowFreqNoise + domainWarp
 * Never introduce high-frequency noise.
 */
export function islandMask(seed: IslandSeed, x: number, z: number): number {
  const { radius, falloff, warp } = seed.params;
  const r = Math.max(radius, 1e-6);
  const nx = x / r;
  const nz = z / r;

  // Domain warp — large sweeping forms only
  const wx = fbm2(seed.perm, nx * 0.55 + 11.2, nz * 0.55 - 3.7, 2) * warp;
  const wz = fbm2(seed.perm, nx * 0.55 - 7.1, nz * 0.55 + 5.3, 2) * warp;
  const px = nx + wx;
  const pz = nz + wz;

  const radial = Math.hypot(px, pz);
  const soft = 1 - radial * falloff;

  // Low-freq shoreline detail (kept soft)
  const detail = fbm2(seed.perm, px * 0.9, pz * 0.9, 2) * 0.18;
  const t = soft + detail;
  return Math.max(0, Math.min(1, t * 0.5 + 0.5));
}

/** Binary land test after thresholding the soft mask. */
export function isLand(mask: number, threshold = 0.5): boolean {
  return mask >= threshold;
}

/**
 * Fill a row-major soft mask grid by sampling islandMask.
 */
export function fillIslandMaskGrid(
  seed: IslandSeed,
  width: number,
  depth: number,
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  out?: Float32Array,
): Float32Array {
  const field = out ?? new Float32Array(width * depth);
  for (let iz = 0; iz < depth; iz++) {
    const v = depth <= 1 ? 0.5 : iz / (depth - 1);
    const z = bounds.minZ + v * (bounds.maxZ - bounds.minZ);
    for (let ix = 0; ix < width; ix++) {
      const u = width <= 1 ? 0.5 : ix / (width - 1);
      const x = bounds.minX + u * (bounds.maxX - bounds.minX);
      field[iz * width + ix] = islandMask(seed, x, z);
    }
  }
  return field;
}
