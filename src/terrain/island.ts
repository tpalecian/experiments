/**
 * Island silhouette — land vs water.
 * Supports a single landmass or an archipelago (union of soft blobs).
 *
 *   per blob: radialFalloff + lowFreqNoise + domainWarp
 *   mask = max(blobs)
 *
 * Never use high-frequency noise on the coastline.
 */

import type { GraphPoint } from './graph';
import { fbm2, makePerm, mulberry32 } from './noise';

export interface IslandParams {
  seed: number;
  /** Approximate overall island radius in world units (bounds / framing). */
  radius: number;
  /** Strength of radial falloff toward ocean per blob. */
  falloff: number;
  /** Low-frequency domain-warp amplitude. */
  warp: number;
  /**
   * Number of landmasses. 1 = classic single island.
   * 0 = auto from site count / map size when generating with a board.
   */
  islandCount: number;
  /** Pull island nuclei apart (0–1) for clearer sea channels. */
  archipelagoSpread: number;
}

export const DEFAULT_ISLAND: IslandParams = {
  seed: 1,
  radius: 12,
  falloff: 1.12,
  warp: 0.42,
  islandCount: 0,
  archipelagoSpread: 0.55,
};

/** One soft landmass nucleus. */
export interface IslandBlob {
  x: number;
  z: number;
  /** Local radius covering that cluster (+ margin). */
  radius: number;
}

export interface IslandSeed {
  params: IslandParams;
  perm: Uint8Array;
  blobs: IslandBlob[];
}

export function createIslandSeed(params: Partial<IslandParams> = {}): IslandSeed {
  const merged = { ...DEFAULT_ISLAND, ...params };
  return {
    params: merged,
    perm: makePerm(merged.seed | 0),
    blobs: [{ x: 0, z: 0, radius: merged.radius }],
  };
}

/** Pick a sensible archipelago count from board rings / site count. */
export function autoIslandCount(siteCount: number, rings?: number): number {
  if (rings !== undefined) {
    if (rings <= 2) return 2;
    if (rings === 3) return 3;
    return 4;
  }
  if (siteCount <= 19) return 2;
  if (siteCount <= 37) return 3;
  return 4;
}

/**
 * K-means-ish clustering of gameplay sites → archipelago nuclei.
 * Each blob radius covers its members so hex centers stay inland naturally.
 */
export function buildArchipelagoBlobs(
  sites: GraphPoint[],
  params: IslandParams,
  rings?: number,
): IslandBlob[] {
  const countWanted =
    params.islandCount > 0
      ? Math.max(1, Math.round(params.islandCount))
      : autoIslandCount(sites.length, rings);
  const k = Math.max(1, Math.min(countWanted, Math.max(1, sites.length)));

  if (sites.length === 0) {
    return [{ x: 0, z: 0, radius: params.radius }];
  }
  if (k === 1) {
    // Single island centered on site centroid
    let cx = 0;
    let cz = 0;
    for (const s of sites) {
      cx += s.x;
      cz += s.z;
    }
    cx /= sites.length;
    cz /= sites.length;
    let maxR = 0;
    for (const s of sites) {
      maxR = Math.max(maxR, Math.hypot(s.x - cx, s.z - cz));
    }
    return [{ x: cx, z: cz, radius: Math.max(params.radius * 0.55, maxR + 1.35) }];
  }

  const rng = mulberry32(params.seed ^ 0xa5a5a5);
  // Seed centroids: spaced samples around the site cloud
  let meanX = 0;
  let meanZ = 0;
  for (const s of sites) {
    meanX += s.x;
    meanZ += s.z;
  }
  meanX /= sites.length;
  meanZ /= sites.length;

  const centroids: { x: number; z: number }[] = [];
  // Start with farthest-point sampling for stable spread
  const first = sites[Math.floor(rng() * sites.length)]!;
  centroids.push({ x: first.x, z: first.z });
  while (centroids.length < k) {
    let best: GraphPoint | null = null;
    let bestD = -1;
    for (const s of sites) {
      let minD = Infinity;
      for (const c of centroids) {
        minD = Math.min(minD, Math.hypot(s.x - c.x, s.z - c.z));
      }
      if (minD > bestD) {
        bestD = minD;
        best = s;
      }
    }
    if (!best) break;
    centroids.push({ x: best.x, z: best.z });
  }

  // Lloyd-ish iterations
  for (let iter = 0; iter < 8; iter++) {
    const sums = centroids.map(() => ({ x: 0, z: 0, n: 0 }));
    for (const s of sites) {
      let bi = 0;
      let bd = Infinity;
      for (let i = 0; i < centroids.length; i++) {
        const d = Math.hypot(s.x - centroids[i]!.x, s.z - centroids[i]!.z);
        if (d < bd) {
          bd = d;
          bi = i;
        }
      }
      sums[bi]!.x += s.x;
      sums[bi]!.z += s.z;
      sums[bi]!.n += 1;
    }
    for (let i = 0; i < centroids.length; i++) {
      if (sums[i]!.n > 0) {
        centroids[i] = { x: sums[i]!.x / sums[i]!.n, z: sums[i]!.z / sums[i]!.n };
      }
    }
  }

  // Don't pull centroids away from their sites — that dumps hexes into channels.
  // Channel clarity comes from carveArchipelagoChannels instead.
  const spread = Math.max(0, Math.min(1, params.archipelagoSpread));
  void spread;

  // Assign sites → blob radii
  const members: GraphPoint[][] = centroids.map(() => []);
  for (const s of sites) {
    let bi = 0;
    let bd = Infinity;
    for (let i = 0; i < centroids.length; i++) {
      const d = Math.hypot(s.x - centroids[i]!.x, s.z - centroids[i]!.z);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    }
    members[bi]!.push(s);
  }

  const blobs: IslandBlob[] = [];
  for (let i = 0; i < centroids.length; i++) {
    const c = centroids[i]!;
    const group = members[i]!;
    let maxR = params.radius * 0.28;
    if (group.length === 0) {
      // Empty cluster — keep a small decorative islet near the nucleus
      blobs.push({ x: c.x, z: c.z, radius: Math.max(1.6, params.radius * 0.22) });
      continue;
    }
    for (const s of group) {
      maxR = Math.max(maxR, Math.hypot(s.x - c.x, s.z - c.z));
    }
    // Margin so sites sit inland
    const margin = 0.75;
    blobs.push({ x: c.x, z: c.z, radius: maxR + margin });
  }
  return blobs;
}

export function withArchipelagoBlobs(
  seed: IslandSeed,
  sites: GraphPoint[],
  rings?: number,
): IslandSeed {
  const blobs = buildArchipelagoBlobs(sites, seed.params, rings);
  return { ...seed, blobs };
}

/** Soft membership for one blob in [0, 1]. */
function blobMask(
  perm: Uint8Array,
  blob: IslandBlob,
  x: number,
  z: number,
  falloff: number,
  warp: number,
): number {
  const r = Math.max(blob.radius, 1e-6);
  const nx = (x - blob.x) / r;
  const nz = (z - blob.z) / r;

  const wx = fbm2(perm, nx * 0.55 + 11.2 + blob.x * 0.05, nz * 0.55 - 3.7, 2) * warp;
  const wz = fbm2(perm, nx * 0.55 - 7.1, nz * 0.55 + 5.3 + blob.z * 0.05, 2) * warp;
  const px = nx + wx;
  const pz = nz + wz;

  const radial = Math.hypot(px, pz);
  const soft = 1 - radial * falloff;
  const detail = fbm2(perm, px * 0.9 + blob.x, pz * 0.9 - blob.z, 2) * 0.18;
  const t = soft + detail;
  return Math.max(0, Math.min(1, t * 0.5 + 0.5));
}

/**
 * Soft island membership in [0, 1] — union (max) of all blobs.
 */
export function islandMask(seed: IslandSeed, x: number, z: number): number {
  const { falloff, warp } = seed.params;
  const blobs = seed.blobs.length > 0 ? seed.blobs : [{ x: 0, z: 0, radius: seed.params.radius }];
  let m = 0;
  for (const blob of blobs) {
    m = Math.max(m, blobMask(seed.perm, blob, x, z, falloff, warp));
  }
  return m;
}

/** Binary land test after thresholding the soft mask. */
export function isLand(mask: number, threshold = 0.5): boolean {
  return mask >= threshold;
}

/**
 * Fill a row-major soft mask grid by sampling islandMask.
 */
export function fillIslandMaskGrid(
  seed: IslandSeed,
  width: number,
  depth: number,
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  out?: Float32Array,
): Float32Array {
  const field = out ?? new Float32Array(width * depth);
  for (let iz = 0; iz < depth; iz++) {
    const v = depth <= 1 ? 0.5 : iz / (depth - 1);
    const z = bounds.minZ + v * (bounds.maxZ - bounds.minZ);
    for (let ix = 0; ix < width; ix++) {
      const u = width <= 1 ? 0.5 : ix / (width - 1);
      const x = bounds.minX + u * (bounds.maxX - bounds.minX);
      field[iz * width + ix] = islandMask(seed, x, z);
    }
  }
  return field;
}
