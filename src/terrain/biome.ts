/**
 * Soft biome masks from Voronoi / region fields.
 * Borders are blurred for visuals; gameplay regions stay crisp.
 */

import {
  RESOURCE_KIND_INDEX,
  RESOURCE_KINDS,
  type ResourceKind,
} from '../gameplay/regions';
import type { GraphPoint } from './graph';
import { regionDistanceField } from './sdf';
import type { WorldGrid } from '../world/types';
import { worldXZ } from '../world/types';

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

export function fillBiomeField(
  sites: GraphPoint[],
  grid: WorldGrid,
  blur: number,
  out?: Uint8Array,
): Uint8Array {
  const field = out ?? new Uint8Array(grid.width * grid.depth);
  for (let iz = 0; iz < grid.depth; iz++) {
    for (let ix = 0; ix < grid.width; ix++) {
      const { x, z } = worldXZ(grid, ix, iz);
      const w = sampleBiome(sites, x, z, blur);
      const dom = dominantBiome(w);
      field[iz * grid.width + ix] = RESOURCE_KIND_INDEX[dom];
    }
  }
  return field;
}

export function biomeIndexToKind(index: number): ResourceKind {
  return RESOURCE_KINDS[index] ?? 'desert';
}
