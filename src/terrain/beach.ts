/**
 * Beaches are SDF ranges — no decals, no textures, smooth interpolation.
 *
 *   d < 0      → water
 *   0 … wet    → wet sand
 *   wet … dry  → dry sand
 *   dry+       → grass
 */

import type { DistanceToCoast } from './sdf';

export type BeachBand = 'water' | 'wetSand' | 'drySand' | 'grass';

export interface BeachParams {
  wetEnd: number;
  dryEnd: number;
}

export const DEFAULT_BEACH: BeachParams = {
  wetEnd: 8,
  dryEnd: 18,
};

export function classifyBeach(
  d: DistanceToCoast,
  params: BeachParams = DEFAULT_BEACH,
): BeachBand {
  if (d < 0) return 'water';
  if (d < params.wetEnd) return 'wetSand';
  if (d < params.dryEnd) return 'drySand';
  return 'grass';
}

/**
 * Blend weights for wet/dry sand near the shore (land side).
 * Returns wet ∈ [0,1], dry ∈ [0,1], grass ∈ [0,1] (approx partition).
 */
export function beachWeights(
  d: DistanceToCoast,
  params: BeachParams = DEFAULT_BEACH,
): { wet: number; dry: number; grass: number } {
  if (d < 0) return { wet: 0, dry: 0, grass: 0 };
  if (d < params.wetEnd) {
    const t = d / Math.max(params.wetEnd, 1e-6);
    return { wet: 1 - t * 0.35, dry: t * 0.35, grass: 0 };
  }
  if (d < params.dryEnd) {
    const t = (d - params.wetEnd) / Math.max(params.dryEnd - params.wetEnd, 1e-6);
    return { wet: (1 - t) * 0.35, dry: 1 - t * 0.5, grass: t * 0.5 };
  }
  return { wet: 0, dry: 0, grass: 1 };
}
