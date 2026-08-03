/**
 * Island silhouette only — land vs water.
 * Forget heightmaps here: radial falloff + low-frequency simplex + domain warp.
 */

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
  falloff: 1.15,
  warp: 0.35,
};

export interface IslandSeed {
  params: IslandParams;
}

export function createIslandSeed(params: Partial<IslandParams> = {}): IslandSeed {
  return { params: { ...DEFAULT_ISLAND, ...params } };
}

/**
 * Soft island membership in [0, 1].
 * Stub: soft disk. Replace with:
 *   island = radialFalloff + simplexNoise + domainWarp
 * Never introduce high-frequency noise.
 */
export function islandMask(seed: IslandSeed, x: number, z: number): number {
  const { radius, falloff } = seed.params;
  const d = Math.hypot(x, z) / Math.max(radius, 1e-6);
  const t = 1 - d * falloff;
  return Math.max(0, Math.min(1, t));
}

/** Binary land test after thresholding the soft mask. */
export function isLand(mask: number, threshold = 0.5): boolean {
  return mask >= threshold;
}
