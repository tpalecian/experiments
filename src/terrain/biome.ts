/**
 * Soft biome masks — preferably one dominant biome per archipelago landmass.
 * Gameplay region adjacency stays crisp on the hex graph.
 */

import {
  RESOURCE_KIND_INDEX,
  RESOURCE_KINDS,
  type ResourceKind,
} from '../gameplay/regions';
import type { GraphPoint } from './graph';
import type { IslandBlob } from './island';
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
 * Softmax-ish weights from inverse distance to sites (legacy / fallback).
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

/** Hard island identity: weights dominated by the owning landmass biome. */
export function sampleIslandBiome(
  blobs: IslandBlob[],
  x: number,
  z: number,
): BiomeWeights {
  const weights = emptyWeights();
  if (blobs.length === 0) {
    weights.pasture = 1;
    return weights;
  }
  let best = blobs[0]!;
  let bestD = Infinity;
  for (const b of blobs) {
    const d = Math.hypot(x - b.x, z - b.z) / Math.max(b.radius, 1e-3);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  const biome = best.biome ?? 'pasture';
  weights[biome] = 1;
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

/** Paint each land cell with its archipelago island's biome. */
export function fillIslandBiomeField(
  blobs: IslandBlob[],
  grid: WorldGrid,
  sdfField: Float32Array,
  out?: Uint8Array,
): Uint8Array {
  const field = out ?? new Uint8Array(grid.width * grid.depth);
  for (let iz = 0; iz < grid.depth; iz++) {
    for (let ix = 0; ix < grid.width; ix++) {
      const i = iz * grid.width + ix;
      const { x, z } = worldXZ(grid, ix, iz);
      if (sdfField[i]! < 0) {
        field[i] = RESOURCE_KIND_INDEX.desert;
        continue;
      }
      const w = sampleIslandBiome(blobs, x, z);
      field[i] = RESOURCE_KIND_INDEX[dominantBiome(w)];
    }
  }
  return field;
}

export function biomeIndexToKind(index: number): ResourceKind {
  return RESOURCE_KINDS[index] ?? 'desert';
}

/** Majority resource among sites belonging to a blob. */
export function majorityBiomeForSites(sites: GraphPoint[]): ResourceKind {
  if (sites.length === 0) return 'pasture';
  const counts: BiomeWeights = emptyWeights();
  for (const s of sites) counts[s.resource] += 1;
  return dominantBiome(counts);
}
