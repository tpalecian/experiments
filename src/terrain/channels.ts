/**
 * Soft sea channels between archipelago blobs.
 * Suppresses mask along inter-island midlines where no gameplay site is nearby.
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
  const carve = 0.72 + strength * 0.35; // punch channels open
  const halfWidth = 0.75 + strength * 1.1; // channel half-width in world units

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
      // Perpendicular
      const px = -uz;
      const pz = ux;

      // Sample along the segment between blobs (skip ends near nuclei)
      const steps = Math.max(8, Math.ceil(len / 0.35));
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        if (t < 0.18 || t > 0.82) continue;
        const cx = a.x + dx * t;
        const cz = a.z + dz * t;

        // Stamp a soft trough across the channel
        const stampR = halfWidth * 2.2;
        const minX = cx - stampR;
        const maxX = cx + stampR;
        const minZ = cz - stampR;
        const maxZ = cz + stampR;

        for (let iz = 0; iz < depth; iz++) {
          for (let ix = 0; ix < width; ix++) {
            const p = worldXZ(grid, ix, iz);
            if (p.x < minX || p.x > maxX || p.z < minZ || p.z > maxZ) continue;

            // Distance to the channel axis (infinite line through a→b)
            const wx = p.x - a.x;
            const wz = p.z - a.z;
            const along = wx * ux + wz * uz;
            if (along < len * 0.18 || along > len * 0.82) continue;
            const across = wx * px + wz * pz;
            const ad = Math.abs(across);
            if (ad > halfWidth * 1.6) continue;

            if (nearestSiteDist(sites, p.x, p.z) < protectRadius) continue;

            const fall = 1 - ad / (halfWidth * 1.6);
            const suppress = Math.min(1, fall * fall * carve * 1.35);
            const idx = iz * width + ix;
            // Drive toward ocean; keep a little softness at channel edges
            out[idx] = Math.min(out[idx]!, Math.max(0, out[idx]! * (1 - suppress) - suppress * 0.55));
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

