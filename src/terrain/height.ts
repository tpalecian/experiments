/**
 * Terrain height from coastline distance — never raw Perlin mountains.
 *
 *   height = terrainCurve(distanceToCoast) + largeScaleNoise + smallVariation
 */

import { fbm2, makePerm } from './noise';
import type { DistanceToCoast, IslandSdf } from './sdf';
import type { WorldGrid } from '../world/types';
import { worldXZ } from '../world/types';

export type HeightLayer =
  | 'deepOcean'
  | 'lagoon'
  | 'beach'
  | 'grass'
  | 'hills'
  | 'mountains';

/** Ordered reference bands on distanceToCoast (ocean → peak). */
export const DISTANCE_BANDS: { layer: HeightLayer; distance: number }[] = [
  { layer: 'deepOcean', distance: -100 },
  { layer: 'lagoon', distance: -20 },
  { layer: 'beach', distance: 0 },
  { layer: 'grass', distance: 15 },
  { layer: 'hills', distance: 40 },
  { layer: 'mountains', distance: 70 },
];

export interface HeightParams {
  /** World-unit scale applied after the distance curve. */
  verticalScale: number;
  largeNoise: number;
  smallNoise: number;
}

export const DEFAULT_HEIGHT: HeightParams = {
  verticalScale: 0.055,
  largeNoise: 0.22,
  smallNoise: 0.06,
};

export interface Heightmap {
  width: number;
  depth: number;
  /** Row-major heights; world XZ mapped by caller. */
  data: Float32Array;
  params: HeightParams;
}

/**
 * Piecewise terrain curve from signed coastline distance.
 * Distances are in world units from the SDF.
 */
export function terrainCurve(d: DistanceToCoast): number {
  if (d < 0) {
    // Underwater shelf: gently deeper offshore
    return Math.max(d, -40) * 0.015;
  }
  // Land: gentle rise — beach shelf then hills
  if (d < 1.2) return d * 0.08;
  if (d < 3.5) return 0.096 + (d - 1.2) * 0.14;
  if (d < 6.5) return 0.418 + (d - 3.5) * 0.18;
  return 0.958 + (d - 6.5) * 0.12;
}

/**
 * Sample height with subtle FBM — keep amplitude low so coast stays sculpted.
 */
export function sampleHeight(
  sdf: IslandSdf,
  x: number,
  z: number,
  params: HeightParams = DEFAULT_HEIGHT,
  seed = 1,
): number {
  const d = sdf.sample(x, z);
  const base = terrainCurve(d);
  if (d < -0.05) {
    return base * (params.verticalScale / DEFAULT_HEIGHT.verticalScale);
  }
  const perm = makePerm((seed | 0) + 917);
  const largeScaleNoise = fbm2(perm, x * 0.08, z * 0.08, 2);
  const smallVariation = fbm2(perm, x * 0.22 + 40, z * 0.22 - 12, 2);
  const inland = Math.max(0, Math.min(1, d / 4));
  const scale = params.verticalScale / DEFAULT_HEIGHT.verticalScale;
  return (
    (base +
      largeScaleNoise * params.largeNoise * inland +
      smallVariation * params.smallNoise * inland) *
    scale
  );
}

export function classifyLayer(d: DistanceToCoast): HeightLayer {
  if (d < -8) return 'deepOcean';
  if (d < -1) return 'lagoon';
  if (d < 1.2) return 'beach';
  if (d < 3.5) return 'grass';
  if (d < 6) return 'hills';
  return 'mountains';
}

/** Fill height field from SDF grid. */
export function fillHeightField(
  sdf: IslandSdf,
  grid: WorldGrid,
  params: HeightParams,
  seed: number,
  out?: Float32Array,
): Float32Array {
  const field = out ?? new Float32Array(grid.width * grid.depth);
  for (let iz = 0; iz < grid.depth; iz++) {
    for (let ix = 0; ix < grid.width; ix++) {
      const { x, z } = worldXZ(grid, ix, iz);
      field[iz * grid.width + ix] = sampleHeight(sdf, x, z, params, seed);
    }
  }
  return field;
}

/** Finite-difference slope magnitude (rise/run). */
export function sampleSlope(
  heightField: Float32Array,
  grid: WorldGrid,
  ix: number,
  iz: number,
): number {
  const { width, depth, bounds } = grid;
  const cellX = (bounds.maxX - bounds.minX) / Math.max(width - 1, 1);
  const cellZ = (bounds.maxZ - bounds.minZ) / Math.max(depth - 1, 1);
  const x0 = Math.max(0, ix - 1);
  const x1 = Math.min(width - 1, ix + 1);
  const z0 = Math.max(0, iz - 1);
  const z1 = Math.min(depth - 1, iz + 1);
  const hx = heightField[iz * width + x1]! - heightField[iz * width + x0]!;
  const hz = heightField[z1 * width + ix]! - heightField[z0 * width + ix]!;
  const dx = (x1 - x0) * cellX;
  const dz = (z1 - z0) * cellZ;
  return Math.hypot(hx / Math.max(dx, 1e-6), hz / Math.max(dz, 1e-6));
}
