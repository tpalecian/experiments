/**
 * Soft biome masks from Voronoi / region fields.
 * Borders are blurred for visuals; gameplay regions stay crisp.
 */

import type { ResourceKind } from '../gameplay/regions';
import type { GraphPoint } from './graph';
import { regionDistanceField } from './sdf';

export type BiomeWeights = Record<ResourceKind, number>;

const ZERO: BiomeWeights = {
  forest: 0,
  wheat: 0,
  ore: 0,
  brick: 0,
  pasture: 0,
  desert: 0,
};

function emptyWeights(): BiomeWeights {
  return { ...ZERO };
}

/**
 * Softmax-ish weights from inverse distance to sites.
 * Stub blur: nearest site dominates with a soft falloff to neighbors.
 */
export function sampleBiome(
  sites: GraphPoint[],
  x: number,
  z: number,
  blur = 1.25,
): BiomeWeights {
  const weights = emptyWeights();
  if (sites.length === 0) return weights;

  let sum = 0;
  for (const s of sites) {
    const d = Math.hypot(s.x - x, s.z - z);
    const w = 1 / (1 + (d / Math.max(blur, 1e-3)) ** 2);
    weights[s.resource] += w;
    sum += w;
  }
  if (sum <= 0) return weights;
  (Object.keys(weights) as ResourceKind[]).forEach((k) => {
    weights[k] /= sum;
  });
  return weights;
}

export function dominantBiome(weights: BiomeWeights): ResourceKind {
  let best: ResourceKind = 'desert';
  let v = -1;
  (Object.keys(weights) as ResourceKind[]).forEach((k) => {
    if (weights[k] > v) {
      v = weights[k];
      best = k;
    }
  });
  return best;
}

/** Convenience: nearest site resource (hard edge; prefer sampleBiome for rendering). */
export function nearestBiome(sites: GraphPoint[], x: number, z: number): ResourceKind | null {
  const hit = regionDistanceField(sites, x, z);
  if (!hit) return null;
  return sites.find((s) => s.id === hit.siteId)?.resource ?? null;
}
