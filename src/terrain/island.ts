/**
 * Island seed and macro shape: radial falloff + low-frequency simplex + domain warp.
 * Never introduce high-frequency noise.
 */

export interface IslandParams {
  seed: number;
  /** Approximate island radius in world units. */
  radius: number;
  /** Strength of radial falloff toward ocean. */
  falloff: number;
  /** Low-frequency warp amplitude. */
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
 * Macro land membership in [0, 1] before region SDF.
 * Stub returns a soft disk; replace with simplex + domain warp.
 */
export function islandMask(seed: IslandSeed, x: number, z: number): number {
  const { radius, falloff } = seed.params;
  const d = Math.hypot(x, z) / Math.max(radius, 1e-6);
  const t = 1 - d * falloff;
  return Math.max(0, Math.min(1, t));
}
