/**
 * Coastline extraction from the island SDF (Marching Squares).
 */

import type { IslandSdf } from './sdf';
import type { WorldGrid } from '../world/types';
import { worldXZ } from '../world/types';

export interface CoastPolyline {
  points: { x: number; z: number }[];
  closed: boolean;
}

export interface Coastline {
  loops: CoastPolyline[];
}

function lerpEdge(
  x0: number,
  z0: number,
  v0: number,
  x1: number,
  z1: number,
  v1: number,
): { x: number; z: number } {
  const t = Math.abs(v1 - v0) < 1e-9 ? 0.5 : (0 - v0) / (v1 - v0);
  return { x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t };
}

/**
 * Extract zero-crossing of the SDF on a grid via marching squares segments.
 */
export function extractCoastlineFromField(
  field: Float32Array,
  grid: WorldGrid,
): Coastline {
  const { width, depth } = grid;
  const segments: { a: { x: number; z: number }; b: { x: number; z: number } }[] = [];

  for (let iz = 0; iz < depth - 1; iz++) {
    for (let ix = 0; ix < width - 1; ix++) {
      const p00 = worldXZ(grid, ix, iz);
      const p10 = worldXZ(grid, ix + 1, iz);
      const p11 = worldXZ(grid, ix + 1, iz + 1);
      const p01 = worldXZ(grid, ix, iz + 1);
      const v00 = field[iz * width + ix]!;
      const v10 = field[iz * width + ix + 1]!;
      const v11 = field[(iz + 1) * width + ix + 1]!;
      const v01 = field[(iz + 1) * width + ix]!;
      const idx =
        (v00 >= 0 ? 1 : 0) |
        (v10 >= 0 ? 2 : 0) |
        (v11 >= 0 ? 4 : 0) |
        (v01 >= 0 ? 8 : 0);
      if (idx === 0 || idx === 15) continue;

      const bottom = () => lerpEdge(p00.x, p00.z, v00, p10.x, p10.z, v10);
      const right = () => lerpEdge(p10.x, p10.z, v10, p11.x, p11.z, v11);
      const top = () => lerpEdge(p01.x, p01.z, v01, p11.x, p11.z, v11);
      const left = () => lerpEdge(p00.x, p00.z, v00, p01.x, p01.z, v01);

      // Ambiguous cases use simple pairs
      const edges: [() => { x: number; z: number }, () => { x: number; z: number }][] = [];
      switch (idx) {
        case 1:
        case 14:
          edges.push([left, bottom]);
          break;
        case 2:
        case 13:
          edges.push([bottom, right]);
          break;
        case 3:
        case 12:
          edges.push([left, right]);
          break;
        case 4:
        case 11:
          edges.push([right, top]);
          break;
        case 5:
          edges.push([left, bottom], [right, top]);
          break;
        case 6:
        case 9:
          edges.push([bottom, top]);
          break;
        case 7:
        case 8:
          edges.push([left, top]);
          break;
        case 10:
          edges.push([bottom, right], [left, top]);
          break;
        default:
          break;
      }
      for (const [fa, fb] of edges) {
        segments.push({ a: fa(), b: fb() });
      }
    }
  }

  // Stitch into polylines (greedy)
  const loops: CoastPolyline[] = [];
  const used = new Array(segments.length).fill(false);
  const key = (p: { x: number; z: number }) => `${p.x.toFixed(3)},${p.z.toFixed(3)}`;

  for (let i = 0; i < segments.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    const pts = [segments[i]!.a, segments[i]!.b];
    let extended = true;
    while (extended) {
      extended = false;
      const head = pts[0]!;
      const tail = pts[pts.length - 1]!;
      for (let j = 0; j < segments.length; j++) {
        if (used[j]) continue;
        const s = segments[j]!;
        if (key(s.a) === key(tail)) {
          pts.push(s.b);
          used[j] = true;
          extended = true;
          break;
        }
        if (key(s.b) === key(tail)) {
          pts.push(s.a);
          used[j] = true;
          extended = true;
          break;
        }
        if (key(s.a) === key(head)) {
          pts.unshift(s.b);
          used[j] = true;
          extended = true;
          break;
        }
        if (key(s.b) === key(head)) {
          pts.unshift(s.a);
          used[j] = true;
          extended = true;
          break;
        }
      }
    }
    const closed = pts.length > 2 && key(pts[0]!) === key(pts[pts.length - 1]!);
    loops.push({ points: pts, closed });
  }

  return { loops };
}

export function extractCoastline(
  sdf: IslandSdf,
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  resolution: number,
): Coastline {
  if (sdf.field && sdf.grid) {
    return extractCoastlineFromField(sdf.field, sdf.grid);
  }
  const grid: WorldGrid = {
    width: resolution,
    depth: resolution,
    bounds,
  };
  const field = new Float32Array(resolution * resolution);
  for (let iz = 0; iz < resolution; iz++) {
    for (let ix = 0; ix < resolution; ix++) {
      const p = worldXZ(grid, ix, iz);
      field[iz * resolution + ix] = sdf.sample(p.x, p.z);
    }
  }
  return extractCoastlineFromField(field, grid);
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
