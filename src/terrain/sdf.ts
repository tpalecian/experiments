/**
 * Signed distance to coastline — the heart of the renderer.
 *
 * Convention (matches docs/TERRAIN.md):
 *   d < 0  → ocean
 *   d = 0  → coastline
 *   d > 0  → land
 */

import type { IslandSeed } from './island';
import { islandMask } from './island';
import type { GraphPoint } from './graph';
import type { WorldGrid } from '../world/types';
import { worldSampleBilinear } from '../world/types';

/** Alias used throughout shaders and CPU samplers. */
export type DistanceToCoast = number;

export interface IslandSdf {
  /** Signed distance: ocean < 0, coast = 0, land > 0. */
  sample(x: number, z: number): DistanceToCoast;
  /** Optional grid for GPU upload. */
  field?: Float32Array;
  grid?: WorldGrid;
}

const INF = 1e20;

/**
 * 1D squared Euclidean distance transform (Felzenszwalb & Huttenlocher).
 */
function edt1d(f: Float32Array, n: number, d: Float32Array, v: Int32Array, z: Float32Array): void {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s =
      (f[q]! - f[v[k]!]! + q * q - v[k]! * v[k]!) / (2 * q - 2 * v[k]!);
    while (s <= z[k]!) {
      k--;
      s = (f[q]! - f[v[k]!]! + q * q - v[k]! * v[k]!) / (2 * q - 2 * v[k]!);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1]! < q) k++;
    const dx = q - v[k]!;
    d[q] = dx * dx + f[v[k]!]!;
  }
}

/**
 * Signed Euclidean distance field from a soft mask.
 * Threshold 0.5 → binary land; positive inland, negative ocean.
 * Distances are in world units using grid cell size.
 */
export function computeSignedDistanceField(
  mask: Float32Array,
  grid: WorldGrid,
  threshold = 0.5,
): Float32Array {
  const { width, depth, bounds } = grid;
  const cellX = (bounds.maxX - bounds.minX) / Math.max(width - 1, 1);
  const cellZ = (bounds.maxZ - bounds.minZ) / Math.max(depth - 1, 1);
  const cell = (cellX + cellZ) * 0.5;

  const n = width * depth;
  const outside = new Float32Array(n); // dist^2 to nearest land (for water cells)
  const inside = new Float32Array(n); // dist^2 to nearest water (for land cells)

  for (let i = 0; i < n; i++) {
    const land = mask[i]! >= threshold;
    outside[i] = land ? 0 : INF;
    inside[i] = land ? INF : 0;
  }

  const rowF = new Float32Array(Math.max(width, depth));
  const rowD = new Float32Array(Math.max(width, depth));
  const v = new Int32Array(Math.max(width, depth));
  const zBuf = new Float32Array(Math.max(width, depth) + 1);

  const transform = (field: Float32Array) => {
    // Columns
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < depth; y++) rowF[y] = field[y * width + x]!;
      edt1d(rowF, depth, rowD, v, zBuf);
      for (let y = 0; y < depth; y++) field[y * width + x] = rowD[y]!;
    }
    // Rows
    for (let y = 0; y < depth; y++) {
      for (let x = 0; x < width; x++) rowF[x] = field[y * width + x]!;
      edt1d(rowF, width, rowD, v, zBuf);
      for (let x = 0; x < width; x++) field[y * width + x] = rowD[x]!;
    }
  };

  transform(outside);
  transform(inside);

  const sdf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const land = mask[i]! >= threshold;
    const dist = Math.sqrt(land ? inside[i]! : outside[i]!) * cell;
    sdf[i] = land ? dist : -dist;
  }
  return sdf;
}

export function buildGridSdf(field: Float32Array, grid: WorldGrid): IslandSdf {
  return {
    field,
    grid,
    sample(x: number, z: number): DistanceToCoast {
      return worldSampleBilinear(field, grid, x, z);
    },
  };
}

/**
 * Approximate SDF from the island mask (fallback / smoke).
 * Prefer computeSignedDistanceField for the live pipeline.
 */
export function buildIslandSdf(seed: IslandSeed): IslandSdf {
  return {
    sample(x: number, z: number): DistanceToCoast {
      const m = islandMask(seed, x, z);
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

/** Ensure region centers sit on land by lifting SDF near sites (compat). */
export function ensureSitesOnLand(
  sdfField: Float32Array,
  grid: WorldGrid,
  sites: GraphPoint[],
  minDist = 0.35,
): void {
  const { width, depth, bounds } = grid;
  for (const site of sites) {
    const u = (site.x - bounds.minX) / Math.max(bounds.maxX - bounds.minX, 1e-6);
    const v = (site.z - bounds.minZ) / Math.max(bounds.maxZ - bounds.minZ, 1e-6);
    const cx = Math.max(0, Math.min(width - 1, Math.round(u * (width - 1))));
    const cz = Math.max(0, Math.min(depth - 1, Math.round(v * (depth - 1))));
    const bestI = cz * width + cx;
    if (sdfField[bestI]! < minDist) {
      const rad = 3;
      for (let dz = -rad; dz <= rad; dz++) {
        for (let dx = -rad; dx <= rad; dx++) {
          const ix = cx + dx;
          const iz = cz + dz;
          if (ix < 0 || iz < 0 || ix >= width || iz >= depth) continue;
          const i = iz * width + ix;
          const fall = 1 - Math.hypot(dx, dz) / (rad + 1);
          if (fall <= 0) continue;
          sdfField[i] = Math.max(sdfField[i]!, minDist * fall);
        }
      }
    }
  }
}
