/**
 * Soft sea channels between archipelago blobs.
 * Suppresses mask along inter-island midlines where no gameplay site is nearby.
 * After SDF, shallowSandbarShelf keeps mid-channels turquoise (not deep ocean).
 */

import type { GraphPoint } from './graph';
import type { IslandBlob } from './island';
import type { WorldGrid } from '../world/types';
import { worldXZ } from '../world/types';

function nearestSiteDist(sites: GraphPoint[], x: number, z: number): number {
  let best = Infinity;
  for (const s of sites) {
    best = Math.min(best, Math.hypot(s.x - x, s.z - z));
  }
  return best;
}

/**
 * Carve soft water channels between every blob pair.
 * `strength` 0–1 from archipelagoSpread; sites within `protectRadius` stay land.
 * Midline stamps + saddle pass so overlapping soft masks actually split.
 */
export function carveArchipelagoChannels(
  mask: Float32Array,
  grid: WorldGrid,
  blobs: IslandBlob[],
  sites: GraphPoint[],
  strength: number,
  protectRadius = 0.95,
): Float32Array {
  if (blobs.length < 2 || strength <= 0.02) return mask;
  const out = mask.slice();
  const { width, depth } = grid;
  const carve = 0.95 + strength * 0.55;
  const halfWidth = 1.25 + strength * 1.65;

  for (let i = 0; i < blobs.length; i++) {
    for (let j = i + 1; j < blobs.length; j++) {
      const a = blobs[i]!;
      const b = blobs[j]!;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz);
      if (len < 1.2) continue;
      const ux = dx / len;
      const uz = dz / len;
      const px = -uz;
      const pz = ux;

      const steps = Math.max(10, Math.ceil(len / 0.28));
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        if (t < 0.12 || t > 0.88) continue;
        const cx = a.x + dx * t;
        const cz = a.z + dz * t;
        const stampR = halfWidth * 2.6;

        for (let iz = 0; iz < depth; iz++) {
          for (let ix = 0; ix < width; ix++) {
            const p = worldXZ(grid, ix, iz);
            if (
              p.x < cx - stampR ||
              p.x > cx + stampR ||
              p.z < cz - stampR ||
              p.z > cz + stampR
            ) {
              continue;
            }
            const wx = p.x - a.x;
            const wz = p.z - a.z;
            const along = wx * ux + wz * uz;
            if (along < len * 0.12 || along > len * 0.88) continue;
            const ad = Math.abs(wx * px + wz * pz);
            if (ad > halfWidth * 1.85) continue;
            if (nearestSiteDist(sites, p.x, p.z) < protectRadius) continue;

            const fall = 1 - ad / (halfWidth * 1.85);
            const mid = 1 - Math.abs(along / len - 0.5) * 2;
            const suppress = Math.min(1, fall * fall * carve * (1.4 + mid * 0.8));
            const idx = iz * width + ix;
            out[idx] = Math.min(out[idx]!, Math.max(0, out[idx]! * (1 - suppress) - suppress));
          }
        }
      }
    }
  }

  // Saddle pass: open the overlap where two islands compete and no site is nearby
  for (let iz = 0; iz < depth; iz++) {
    for (let ix = 0; ix < width; ix++) {
      const p = worldXZ(grid, ix, iz);
      if (nearestSiteDist(sites, p.x, p.z) < protectRadius) continue;

      let n1 = Infinity;
      let n2 = Infinity;
      for (const b of blobs) {
        const n = Math.hypot(p.x - b.x, p.z - b.z) / Math.max(b.radius, 1e-3);
        if (n < n1) {
          n2 = n1;
          n1 = n;
        } else if (n < n2) {
          n2 = n;
        }
      }
      if (n1 > 1.05 || n2 > 1.2) continue;
      const balance = 1 - Math.abs(n1 - n2);
      if (balance < 0.72) continue;
      const suppress = Math.min(1, balance * balance * strength * 1.1);
      const idx = iz * width + ix;
      out[idx] = Math.min(out[idx]!, Math.max(0, out[idx]! * (1 - suppress) - suppress * 0.75));
    }
  }

  // Sever thin isthmuses between nearest cross-island site pairs (hex frontier gaps)
  if (blobs.length >= 2 && sites.length >= 2) {
    const owners = sites.map((s) => {
      let bi = 0;
      let bd = Infinity;
      for (let i = 0; i < blobs.length; i++) {
        const d = Math.hypot(s.x - blobs[i]!.x, s.z - blobs[i]!.z);
        if (d < bd) {
          bd = d;
          bi = i;
        }
      }
      return bi;
    });
    for (let i = 0; i < sites.length; i++) {
      for (let j = i + 1; j < sites.length; j++) {
        if (owners[i] === owners[j]) continue;
        const a = sites[i]!;
        const b = sites[j]!;
        const dist = Math.hypot(a.x - b.x, a.z - b.z);
        if (dist > 2.4 || dist < protectRadius * 2.05) continue;
        const mx = (a.x + b.x) * 0.5;
        const mz = (a.z + b.z) * 0.5;
        const ux = (b.x - a.x) / dist;
        const uz = (b.z - a.z) / dist;
        const px = -uz;
        const pz = ux;
        const slit = 0.42 + strength * 0.25;
        for (let iz = 0; iz < depth; iz++) {
          for (let ix = 0; ix < width; ix++) {
            const p = worldXZ(grid, ix, iz);
            const wx = p.x - mx;
            const wz = p.z - mz;
            const along = wx * ux + wz * uz;
            const across = Math.abs(wx * px + wz * pz);
            if (Math.abs(along) > dist * 0.22) continue;
            if (across > slit) continue;
            if (nearestSiteDist(sites, p.x, p.z) < protectRadius * 0.92) continue;
            const idx = iz * width + ix;
            const fall = 1 - across / slit;
            out[idx] = Math.min(out[idx]!, Math.max(0, out[idx]! * (1 - fall) - fall * 0.95));
          }
        }
      }
    }
  }
  return out;
}

/**
 * Lift mid-channel SDF toward a shallow shelf so water reads as a sandbar
 * (turquoise) rather than a deep trench between islands.
 */
export function shallowSandbarShelf(
  sdfField: Float32Array,
  grid: WorldGrid,
  blobs: IslandBlob[],
  shelfDepth = -0.42,
): Float32Array {
  if (blobs.length < 2) return sdfField;
  const out = sdfField;
  const { width, depth } = grid;

  for (let i = 0; i < blobs.length; i++) {
    for (let j = i + 1; j < blobs.length; j++) {
      const a = blobs[i]!;
      const b = blobs[j]!;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz);
      if (len < 1.2) continue;
      const ux = dx / len;
      const uz = dz / len;
      const px = -uz;
      const pz = ux;
      const halfWidth = 1.8;

      for (let iz = 0; iz < depth; iz++) {
        for (let ix = 0; ix < width; ix++) {
          const p = worldXZ(grid, ix, iz);
          const wx = p.x - a.x;
          const wz = p.z - a.z;
          const along = wx * ux + wz * uz;
          if (along < len * 0.2 || along > len * 0.8) continue;
          const ad = Math.abs(wx * px + wz * pz);
          if (ad > halfWidth) continue;
          const idx = iz * width + ix;
          const d = out[idx]!;
          if (d >= 0) continue;
          if (d < shelfDepth - 0.05) {
            const edge = 1 - ad / halfWidth;
            const lift = shelfDepth * (0.55 + 0.45 * edge * edge);
            out[idx] = Math.max(d, lift);
          }
        }
      }
    }
  }
  return out;
}

/**
 * Tiny rescue disks so gameplay sites aren't drowned by channel carving.
 * Does not reshape the global coastline toward the hex lattice.
 */
export function protectSiteFootprints(
  mask: Float32Array,
  grid: WorldGrid,
  sites: GraphPoint[],
  radius = 0.7,
  floor = 0.62,
): Float32Array {
  const out = mask.slice();
  const { width, depth, bounds } = grid;
  const cell =
    ((bounds.maxX - bounds.minX) / Math.max(width - 1, 1) +
      (bounds.maxZ - bounds.minZ) / Math.max(depth - 1, 1)) *
    0.5;
  const radCells = Math.max(1, Math.ceil(radius / Math.max(cell, 1e-6)));

  for (const site of sites) {
    const u = (site.x - bounds.minX) / Math.max(bounds.maxX - bounds.minX, 1e-6);
    const v = (site.z - bounds.minZ) / Math.max(bounds.maxZ - bounds.minZ, 1e-6);
    const cx = Math.round(u * (width - 1));
    const cz = Math.round(v * (depth - 1));
    for (let dz = -radCells; dz <= radCells; dz++) {
      for (let dx = -radCells; dx <= radCells; dx++) {
        const ix = cx + dx;
        const iz = cz + dz;
        if (ix < 0 || iz < 0 || ix >= width || iz >= depth) continue;
        const p = worldXZ(grid, ix, iz);
        const dist = Math.hypot(p.x - site.x, p.z - site.z);
        if (dist > radius) continue;
        const w = 1 - dist / radius;
        const idx = iz * width + ix;
        out[idx] = Math.max(out[idx]!, floor * w * w + out[idx]! * (1 - w * w));
      }
    }
  }
  return out;
}

/**
 * Drop land components that don't contain a gameplay site.
 * Removes carve speckles while keeping true archipelago landmasses.
 */
export function keepSiteLandComponents(
  mask: Float32Array,
  grid: WorldGrid,
  sites: GraphPoint[],
  landThreshold = 0.5,
): Float32Array {
  const { width, depth, bounds } = grid;
  const out = mask.slice();
  const visited = new Uint8Array(width * depth);
  const isLand = (i: number) => (out[i] ?? 0) >= landThreshold;

  const siteCells = new Set<number>();
  for (const site of sites) {
    const u = (site.x - bounds.minX) / Math.max(bounds.maxX - bounds.minX, 1e-6);
    const v = (site.z - bounds.minZ) / Math.max(bounds.maxZ - bounds.minZ, 1e-6);
    const ix = Math.max(0, Math.min(width - 1, Math.round(u * (width - 1))));
    const iz = Math.max(0, Math.min(depth - 1, Math.round(v * (depth - 1))));
    siteCells.add(iz * width + ix);
  }

  const queue: number[] = [];
  for (let start = 0; start < out.length; start++) {
    if (visited[start] || !isLand(start)) continue;
    queue.length = 0;
    queue.push(start);
    visited[start] = 1;
    const component: number[] = [];
    let hasSite = false;
    while (queue.length) {
      const i = queue.pop()!;
      component.push(i);
      if (siteCells.has(i)) hasSite = true;
      const ix = i % width;
      const iz = (i / width) | 0;
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = ix + dx;
        const nz = iz + dz;
        if (nx < 0 || nz < 0 || nx >= width || nz >= depth) continue;
        const ni = nz * width + nx;
        if (visited[ni] || !isLand(ni)) continue;
        visited[ni] = 1;
        queue.push(ni);
      }
    }
    if (!hasSite) {
      for (const i of component) out[i] = Math.min(out[i]!, landThreshold * 0.35);
    }
  }
  return out;
}
