/**
 * Signed distance to coastline — the heart of the renderer.
 *
 * Convention (matches docs/TERRAIN.md):
 *   d < 0  → ocean
 *   d = 0  → coastline
 *   d > 0  → land
 *
 * Every visual system samples this one field: height, water colour,
 * beach, wave bands, foam, caustics, vegetation limits, rocks.
 */

import type { IslandSeed } from './island';
import { islandMask } from './island';
import type { GraphPoint } from './graph';

/** Alias used throughout shaders and CPU samplers. */
export type DistanceToCoast = number;

export interface IslandSdf {
  /** Signed distance: ocean < 0, coast = 0, land > 0. */
  sample(x: number, z: number): DistanceToCoast;
}

/**
 * Approximate SDF from the island mask.
 * Stub: maps soft mask so land is positive, water negative.
 * Replace with a true distance transform from the zero contour.
 */
export function buildIslandSdf(seed: IslandSeed): IslandSdf {
  return {
    sample(x: number, z: number): DistanceToCoast {
      const m = islandMask(seed, x, z);
      // Rough signed distance proxy until a real DT lands.
      // m=1 ( inland ) → +; m=0 ( ocean ) → −; m=0.5 → coast.
      return (m - 0.5) * seed.params.radius;
    },
  };
}

/** Convenience name — same as sdf.sample. */
export function distanceToCoast(sdf: IslandSdf, x: number, z: number): DistanceToCoast {
  return sdf.sample(x, z);
}

/**
 * Soft region field: planar distance to nearest gameplay site.
 * Used for biome blur only — does not redefine the coastline.
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
