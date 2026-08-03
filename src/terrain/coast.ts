/**
 * Coastline extraction from the island SDF.
 * Feeds beaches, foam, wave bands, and cliff placement.
 */

import type { IslandSdf } from './sdf';

export interface CoastPolyline {
  points: { x: number; z: number }[];
  closed: boolean;
}

export interface Coastline {
  loops: CoastPolyline[];
}

/**
 * Extract zero-crossing of the SDF on a grid (Marching Squares later).
 * Stub returns empty loops.
 */
export function extractCoastline(
  _sdf: IslandSdf,
  _bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  _resolution: number,
): Coastline {
  return { loops: [] };
}

/** Distance to nearest coast sample — used by wave bands / foam. */
export function distanceToCoast(
  coastline: Coastline,
  x: number,
  z: number,
): number {
  let best = Infinity;
  for (const loop of coastline.loops) {
    for (const p of loop.points) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < best) best = d;
    }
  }
  return best;
}
