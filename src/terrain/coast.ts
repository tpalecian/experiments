/**
 * Coastline extraction from the island SDF (Marching Squares later).
 * Polylines are optional helpers; runtime shading samples the SDF directly.
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
 * Extract zero-crossing of the SDF on a grid.
 * Stub returns empty loops until Marching Squares lands.
 */
export function extractCoastline(
  _sdf: IslandSdf,
  _bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  _resolution: number,
): Coastline {
  return { loops: [] };
}

/** Unsigned distance to nearest extracted coast sample (debug / tools). */
export function unsignedDistanceToCoastline(
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
