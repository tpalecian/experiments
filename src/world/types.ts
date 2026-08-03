/**
 * Static world data produced by the coastline-first pipeline.
 * Day-night / look tweaks never mutate these buffers.
 */

import type { RegionGraph } from '../gameplay/regions';
import type { BeachParams } from '../terrain/beach';
import type { GraphPoint } from '../terrain/graph';
import type { HeightParams } from '../terrain/height';
import type { IslandParams, IslandSeed } from '../terrain/island';
import type { IslandSdf } from '../terrain/sdf';

export interface WorldBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface WorldGrid {
  /** Samples along X. */
  width: number;
  /** Samples along Z. */
  depth: number;
  bounds: WorldBounds;
}

export interface WorldGenerationParams {
  island: IslandParams;
  /** Soften mask blur passes. */
  smoothPasses: number;
  /** Grid resolution (width = depth). */
  resolution: number;
  /** World half-extent multiplier over island radius. */
  extentScale: number;
  height: HeightParams;
  beach: BeachParams;
  /** Biome soft-blur radius. */
  biomeBlur: number;
  /** Height curve vertical scale (also in height.params). */
  verticalScale: number;
  treeDensity: number;
  rockDensity: number;
  showHexOverlay: boolean;
  showSdfOverlay: boolean;
}

export const DEFAULT_WORLD_GENERATION: WorldGenerationParams = {
  island: {
    seed: 1,
    radius: 12,
    falloff: 1.12,
    warp: 0.42,
    islandCount: 0,
    archipelagoSpread: 0.68,
  },
  smoothPasses: 2,
  resolution: 128,
  extentScale: 1.85,
  height: {
    verticalScale: 0.048,
    largeNoise: 0.12,
    smallNoise: 0.035,
  },
  beach: {
    wetEnd: 0.62,
    dryEnd: 1.55,
  },
  biomeBlur: 1.4,
  verticalScale: 0.048,
  treeDensity: 0.55,
  rockDensity: 0.55,
  showHexOverlay: false,
  showSdfOverlay: false,
};

export interface ScatterInstance {
  x: number;
  y: number;
  z: number;
  scale: number;
  yaw: number;
  /** Optional non-uniform height for rock pillars. */
  scaleY?: number;
}

export interface WorldData {
  seed: IslandSeed;
  graph: RegionGraph;
  sites: GraphPoint[];
  grid: WorldGrid;
  /** Soft mask [0,1] row-major, length width*depth. */
  mask: Float32Array;
  /** Signed distanceToCoast row-major (ocean < 0). */
  sdfField: Float32Array;
  /** Height field row-major. */
  heightField: Float32Array;
  /** Dominant biome index 0..5 per cell (forest,wheat,ore,brick,pasture,desert). */
  biomeField: Uint8Array;
  sdf: IslandSdf;
  /** Coastline loops in world XZ. */
  coastline: { x: number; z: number }[][];
  trees: ScatterInstance[];
  rocks: ScatterInstance[];
  params: WorldGenerationParams;
}

export function worldCellIndex(grid: WorldGrid, ix: number, iz: number): number {
  return iz * grid.width + ix;
}

export function worldXZ(
  grid: WorldGrid,
  ix: number,
  iz: number,
): { x: number; z: number } {
  const { bounds, width, depth } = grid;
  const u = width <= 1 ? 0.5 : ix / (width - 1);
  const v = depth <= 1 ? 0.5 : iz / (depth - 1);
  return {
    x: bounds.minX + u * (bounds.maxX - bounds.minX),
    z: bounds.minZ + v * (bounds.maxZ - bounds.minZ),
  };
}

export function worldSampleBilinear(
  field: Float32Array,
  grid: WorldGrid,
  x: number,
  z: number,
): number {
  const { bounds, width, depth } = grid;
  const u = (x - bounds.minX) / Math.max(bounds.maxX - bounds.minX, 1e-6);
  const v = (z - bounds.minZ) / Math.max(bounds.maxZ - bounds.minZ, 1e-6);
  const fx = Math.max(0, Math.min(width - 1, u * (width - 1)));
  const fz = Math.max(0, Math.min(depth - 1, v * (depth - 1)));
  const x0 = Math.floor(fx);
  const z0 = Math.floor(fz);
  const x1 = Math.min(width - 1, x0 + 1);
  const z1 = Math.min(depth - 1, z0 + 1);
  const tx = fx - x0;
  const tz = fz - z0;
  const a = field[z0 * width + x0]!;
  const b = field[z0 * width + x1]!;
  const c = field[z1 * width + x0]!;
  const d = field[z1 * width + x1]!;
  return a * (1 - tx) * (1 - tz) + b * tx * (1 - tz) + c * (1 - tx) * tz + d * tx * tz;
}
