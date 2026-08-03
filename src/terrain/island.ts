/**
 * Island silhouette — land vs water.
 * Default: one soft landmass per gameplay hex (number token), scaled apart
 * so each island is large with a white beach ring and a sea channel between.
 *
 *   per blob: radialFalloff + lowFreqNoise + domainWarp
 *   mask = max(blobs)
 *
 * Never use high-frequency noise on the coastline.
 */

import type { ResourceKind } from '../gameplay/regions';
import type { GraphPoint } from './graph';
import { majorityBiomeForSites } from './biome';
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
   * Number of landmasses.
   * 0 = one island per hex (default).
   * 1 = single landmass.
   * N>1 = cluster into N islands.
   */
  islandCount: number;
  /** Pull island nuclei apart (0–1) for clearer sea channels. */
  archipelagoSpread: number;
}

export const DEFAULT_ISLAND: IslandParams = {
  seed: 1,
  radius: 12,
  falloff: 1.18,
  warp: 0.16,
  islandCount: 0,
  archipelagoSpread: 0.85,
};

/** One soft landmass nucleus with a dominant biome. */
export interface IslandBlob {
  x: number;
  z: number;
  /** Local radius covering that cluster (+ margin). */
  radius: number;
  /** Dominant terrain biome for this landmass (drives color + scatter). */
  biome: ResourceKind;
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
    blobs: [{ x: 0, z: 0, radius: merged.radius, biome: 'pasture' }],
  };
}

/** Default: one island for every hex / number token. */
export function autoIslandCount(siteCount: number, _rings?: number): number {
  return Math.max(1, siteCount);
}

function minSiteSeparation(sites: GraphPoint[]): number {
  let best = Infinity;
  for (let i = 0; i < sites.length; i++) {
    for (let j = i + 1; j < sites.length; j++) {
      const d = Math.hypot(sites[i]!.x - sites[j]!.x, sites[i]!.z - sites[j]!.z);
      if (d > 1e-6 && d < best) best = d;
    }
  }
  return Number.isFinite(best) ? best : 1.732;
}

/**
 * One large island per gameplay site, biome = that hex's resource.
 * Radius fills most of the gap to neighbors so islands feel big like the reference,
 * leaving a narrow channel the carve can open into a sandbar.
 */
export function buildPerSiteIslands(
  sites: GraphPoint[],
  params: IslandParams,
): IslandBlob[] {
  if (sites.length === 0) {
    return [{ x: 0, z: 0, radius: params.radius, biome: 'pasture' }];
  }
  const sep = minSiteSeparation(sites);
  // Keep a clear water gap: coast ~0.72*radius, so 2*0.36*sep leaves ~28% channel
  const radius = Math.max(2.4, sep * 0.36);
  return sites.map((s) => ({
    x: s.x,
    z: s.z,
    radius,
    biome: s.resource,
  }));
}

/**
 * Build island blobs from hex site positions.
 * Default (islandCount 0): one island per hex with that hex's biome.
 */
export function buildArchipelagoBlobs(
  sites: GraphPoint[],
  params: IslandParams,
  rings?: number,
): IslandBlob[] {
  if (sites.length === 0) {
    return [{ x: 0, z: 0, radius: params.radius, biome: 'pasture' }];
  }

  const countWanted =
    params.islandCount > 0
      ? Math.max(1, Math.round(params.islandCount))
      : autoIslandCount(sites.length, rings);
  const k = Math.max(1, Math.min(countWanted, sites.length));

  // One island per number / hex
  if (k >= sites.length) {
    return buildPerSiteIslands(sites, params);
  }

  if (k === 1) {
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
    return [
      {
        x: cx,
        z: cz,
        radius: Math.max(params.radius * 0.55, maxR + 1.35),
        biome: majorityBiomeForSites(sites),
      },
    ];
  }

  const rng = mulberry32(params.seed ^ 0xa5a5a5);
  let meanX = 0;
  let meanZ = 0;
  for (const s of sites) {
    meanX += s.x;
    meanZ += s.z;
  }
  meanX /= sites.length;
  meanZ /= sites.length;

  const centroids: { x: number; z: number }[] = [];
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

  const spread = Math.max(0, Math.min(1, params.archipelagoSpread));
  if (spread > 0.05) {
    for (const c of centroids) {
      const dx = c.x - meanX;
      const dz = c.z - meanZ;
      const len = Math.hypot(dx, dz) || 1;
      c.x += (dx / len) * spread * 1.2;
      c.z += (dz / len) * spread * 1.2;
    }
  }

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
    let maxR = params.radius * 0.2;
    if (group.length === 0) {
      blobs.push({
        x: c.x,
        z: c.z,
        radius: Math.max(1.8, params.radius * 0.2),
        biome: 'pasture',
      });
      continue;
    }
    for (const s of group) {
      maxR = Math.max(maxR, Math.hypot(s.x - c.x, s.z - c.z));
    }
    blobs.push({
      x: c.x,
      z: c.z,
      radius: maxR + 1.15,
      biome: majorityBiomeForSites(group),
    });
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
  const detail = fbm2(perm, px * 0.9 + blob.x, pz * 0.9 - blob.z, 2) * 0.14;
  const t = soft + detail;
  return Math.max(0, Math.min(1, t * 0.5 + 0.5));
}

/**
 * Soft island membership in [0, 1] — union (max) of all blobs.
 */
export function islandMask(seed: IslandSeed, x: number, z: number): number {
  const { falloff, warp } = seed.params;
  const blobs =
    seed.blobs.length > 0
      ? seed.blobs
      : [{ x: 0, z: 0, radius: seed.params.radius, biome: 'pasture' as const }];
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
