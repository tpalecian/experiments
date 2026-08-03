/**
 * Signed distance fields for island outline and region influence.
 * Shared by coastline, water colour, foam, beaches, wave bands, cliffs.
 */

import type { IslandSeed } from './island';
import { islandMask } from './island';
import type { GraphPoint } from './graph';

export interface IslandSdf {
  /** Negative inside land, positive in water (or convention documented by sampler). */
  sample(x: number, z: number): number;
}

/**
 * Approximate SDF from island mask.
 * Stub: converts soft mask to a crude distance via threshold falloff.
 */
export function buildIslandSdf(seed: IslandSeed): IslandSdf {
  return {
    sample(x: number, z: number): number {
      const m = islandMask(seed, x, z);
      // Positive = water, negative = land (approx).
      return 0.5 - m;
    },
  };
}

/**
 * Soft region field: distance to nearest site (for biome blur / cliffs).
 * Stub until true multi-region SDF / Voronoi distance.
 */
export function regionDistanceField(
  sites: GraphPoint[],
  x: number,
  z: number,
): { siteId: string; distance: number } | null {
  if (sites.length === 0) return null;
  let best = sites[0]!;
  let bestD = Infinity;
  for (const s of sites) {
    const d = Math.hypot(s.x - x, s.z - z);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return { siteId: best.id, distance: bestD };
}
