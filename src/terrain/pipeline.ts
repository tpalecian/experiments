/**
 * Coastline-first island pipeline.
 *
 *   mask → smooth → SDF (distanceToCoast) → height → biomes → scatter
 */

import { boardRadiusWorld } from '../game/board';
import type { BoardState } from '../game/types';
import {
  boardToRegionGraph,
  createEmptyGraph,
  type RegionGraph,
} from '../gameplay/regions';
import { canSpawnRock, DEFAULT_ROCK_GATE } from '../world/rocks';
import type { ScatterInstance, WorldData, WorldGenerationParams } from '../world/types';
import { DEFAULT_WORLD_GENERATION } from '../world/types';
import { canSpawnTree, DEFAULT_TREE_GATE } from '../world/vegetation';
import { fillBiomeField, sampleBiome } from './biome';
import { extractCoastlineFromField } from './coast';
import { regionCenters, type GraphPoint } from './graph';
import { fillHeightField, sampleSlope } from './height';
import {
  createIslandSeed,
  fillIslandMaskGrid,
  type IslandParams,
  type IslandSeed,
} from './island';
import { distanceTransformSoften, smoothIslandMask } from './mask';
import { mulberry32 } from './noise';
import {
  buildGridSdf,
  buildIslandSdf,
  computeSignedDistanceField,
  ensureSitesOnLand,
  type IslandSdf,
} from './sdf';

export interface IslandPipelineResult {
  seed: IslandSeed;
  graph: RegionGraph;
  sites: GraphPoint[];
  /** Shared field: ocean < 0, coast = 0, land > 0. */
  sdf: IslandSdf;
}

/**
 * Bootstrap an island generation context (lightweight; prefer generateIsland).
 */
export function beginIslandPipeline(
  params: Partial<IslandParams> = {},
  graph?: RegionGraph,
): IslandPipelineResult {
  const seed = createIslandSeed(params);
  const g = graph ?? createEmptyGraph(seed.params.seed);
  const sites = regionCenters(g);
  const sdf = buildIslandSdf(seed);
  return { seed, graph: g, sites, sdf };
}

function mergeParams(
  partial: Partial<WorldGenerationParams>,
  board?: BoardState,
): WorldGenerationParams {
  const base: WorldGenerationParams = {
    ...DEFAULT_WORLD_GENERATION,
    ...partial,
    island: { ...DEFAULT_WORLD_GENERATION.island, ...partial.island },
    height: { ...DEFAULT_WORLD_GENERATION.height, ...partial.height },
    beach: { ...DEFAULT_WORLD_GENERATION.beach, ...partial.beach },
  };
  if (board) {
    const r = boardRadiusWorld(board.rings);
    base.island = {
      ...base.island,
      radius: partial.island?.radius ?? r * 1.05,
      seed: partial.island?.seed ?? base.island.seed,
    };
  }
  base.height = {
    ...base.height,
    verticalScale: partial.verticalScale ?? partial.height?.verticalScale ?? base.verticalScale,
  };
  base.verticalScale = base.height.verticalScale;
  return base;
}

function scatterProps(world: Omit<WorldData, 'trees' | 'rocks'>, params: WorldGenerationParams): {
  trees: ScatterInstance[];
  rocks: ScatterInstance[];
} {
  const rng = mulberry32(params.island.seed ^ 0x9e3779b9);
  const trees: ScatterInstance[] = [];
  const rocks: ScatterInstance[] = [];
  const { width, depth } = world.grid;
  const step = Math.max(1, Math.floor(128 / Math.max(params.resolution, 32)));

  for (let iz = 2; iz < depth - 2; iz += step) {
    for (let ix = 2; ix < width - 2; ix += step) {
      const i = iz * width + ix;
      const d = world.sdfField[i]!;
      if (d < 0.15) continue;
      const h = world.heightField[i]!;
      const slope = sampleSlope(world.heightField, world.grid, ix, iz);
      const { x, z } = {
        x:
          world.grid.bounds.minX +
          (ix / (width - 1)) * (world.grid.bounds.maxX - world.grid.bounds.minX),
        z:
          world.grid.bounds.minZ +
          (iz / (depth - 1)) * (world.grid.bounds.maxZ - world.grid.bounds.minZ),
      };
      // Jitter
      const jx = x + (rng() - 0.5) * step * 0.35;
      const jz = z + (rng() - 0.5) * step * 0.35;
      const weights = sampleBiome(world.sites, jx, jz, params.biomeBlur);

      if (rng() < params.treeDensity && canSpawnTree(slope, h, weights, DEFAULT_TREE_GATE)) {
        trees.push({
          x: jx,
          y: h,
          z: jz,
          scale: 0.75 + rng() * 0.55,
          yaw: rng() * Math.PI * 2,
        });
      }
      if (rng() < params.rockDensity && canSpawnRock(slope, h, DEFAULT_ROCK_GATE)) {
        rocks.push({
          x: jx,
          y: h,
          z: jz,
          scale: 0.55 + rng() * 0.7,
          yaw: rng() * Math.PI * 2,
        });
      }
    }
  }
  return { trees, rocks };
}

/**
 * Full coastline-first generate → static WorldData.
 */
export function generateIsland(
  partial: Partial<WorldGenerationParams> = {},
  board?: BoardState,
  graph?: RegionGraph,
): WorldData {
  const params = mergeParams(partial, board);
  const seed = createIslandSeed(params.island);
  const g = graph ?? (board ? boardToRegionGraph(board, seed.params.seed) : createEmptyGraph(seed.params.seed));
  const sites = regionCenters(g);

  const extent = seed.params.radius * params.extentScale;
  const grid = {
    width: params.resolution,
    depth: params.resolution,
    bounds: { minX: -extent, maxX: extent, minZ: -extent, maxZ: extent },
  };

  let mask = fillIslandMaskGrid(seed, grid.width, grid.depth, grid.bounds);
  mask = smoothIslandMask(mask, grid.width, grid.depth, params.smoothPasses);
  mask = distanceTransformSoften(mask, grid.width, grid.depth);

  // Boost mask near gameplay sites so hex centers stay inland
  const { width, depth, bounds } = grid;
  for (const site of sites) {
    const u = (site.x - bounds.minX) / Math.max(bounds.maxX - bounds.minX, 1e-6);
    const v = (site.z - bounds.minZ) / Math.max(bounds.maxZ - bounds.minZ, 1e-6);
    const cx = Math.round(u * (width - 1));
    const cz = Math.round(v * (depth - 1));
    const rad = Math.max(3, Math.ceil(1.1 / ((bounds.maxX - bounds.minX) / Math.max(width - 1, 1))));
    for (let dz = -rad; dz <= rad; dz++) {
      for (let dx = -rad; dx <= rad; dx++) {
        const ix = cx + dx;
        const iz = cz + dz;
        if (ix < 0 || iz < 0 || ix >= width || iz >= depth) continue;
        const px =
          bounds.minX + (ix / Math.max(width - 1, 1)) * (bounds.maxX - bounds.minX);
        const pz =
          bounds.minZ + (iz / Math.max(depth - 1, 1)) * (bounds.maxZ - bounds.minZ);
        const dist = Math.hypot(px - site.x, pz - site.z);
        if (dist < 1.05) {
          const boost = (1 - dist / 1.05) * 0.35;
          const i = iz * width + ix;
          mask[i] = Math.min(1, mask[i]! + boost);
        }
      }
    }
  }

  const sdfField = computeSignedDistanceField(mask, grid);
  ensureSitesOnLand(sdfField, grid, sites, 0.45);
  const sdf = buildGridSdf(sdfField, grid);

  const heightParams = { ...params.height, verticalScale: params.verticalScale };
  const heightField = fillHeightField(sdf, grid, heightParams, seed.params.seed);
  // Flatten underwater to slightly below sea for mesh / water discard
  for (let i = 0; i < heightField.length; i++) {
    if (sdfField[i]! < 0) {
      heightField[i] = Math.min(heightField[i]!, -0.05);
    }
  }

  const biomeField = fillBiomeField(sites, grid, params.biomeBlur);
  const coast = extractCoastlineFromField(sdfField, grid);

  const partialWorld: Omit<WorldData, 'trees' | 'rocks'> = {
    seed,
    graph: g,
    sites,
    grid,
    mask,
    sdfField,
    heightField,
    biomeField,
    sdf,
    coastline: coast.loops.map((l) => l.points),
    params: { ...params, height: heightParams },
  };
  const { trees, rocks } = scatterProps(partialWorld, params);

  return { ...partialWorld, trees, rocks };
}
