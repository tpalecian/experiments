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
  withArchipelagoBlobs,
  type IslandParams,
  type IslandSeed,
} from './island';
import { distanceTransformSoften, smoothIslandMask } from './mask';
import { mulberry32 } from './noise';
import { carveArchipelagoChannels, protectSiteFootprints } from './channels';
import {
  buildGridSdf,
  buildIslandSdf,
  computeSignedDistanceField,
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
      islandCount: partial.island?.islandCount ?? base.island.islandCount,
      archipelagoSpread:
        partial.island?.archipelagoSpread ?? base.island.archipelagoSpread,
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
  let seed = createIslandSeed(params.island);
  const g = graph ?? (board ? boardToRegionGraph(board, seed.params.seed) : createEmptyGraph(seed.params.seed));
  const sites = regionCenters(g);
  seed = withArchipelagoBlobs(seed, sites, board?.rings);

  // Frame bounds from outermost blob extents (archipelago can be wider than radius)
  let extent = seed.params.radius * params.extentScale;
  for (const b of seed.blobs) {
    extent = Math.max(
      extent,
      Math.hypot(b.x, b.z) + b.radius * 1.35,
      Math.abs(b.x) + b.radius * 1.2,
      Math.abs(b.z) + b.radius * 1.2,
    );
  }
  const grid = {
    width: params.resolution,
    depth: params.resolution,
    bounds: { minX: -extent, maxX: extent, minZ: -extent, maxZ: extent },
  };

  let mask = fillIslandMaskGrid(seed, grid.width, grid.depth, grid.bounds);
  mask = smoothIslandMask(mask, grid.width, grid.depth, Math.max(0, params.smoothPasses - 1));
  mask = distanceTransformSoften(mask, grid.width, grid.depth);
  // Carve after soften so channels aren't blurred shut again
  mask = carveArchipelagoChannels(
    mask,
    grid,
    seed.blobs,
    sites,
    Math.max(seed.params.archipelagoSpread, seed.blobs.length > 1 ? 0.45 : 0),
    0.72,
  );
  mask = protectSiteFootprints(mask, grid, sites, 0.7, 0.64);
  // Light final smooth so carved shores aren't jagged
  if (params.smoothPasses > 0) {
    mask = smoothIslandMask(mask, grid.width, grid.depth, 1);
  }
  // Re-protect after smooth (blur can nibble site footprints)
  mask = protectSiteFootprints(mask, grid, sites, 0.85, 0.7);

  // Organic multi-island coastline — blobs sized to cover gameplay sites.
  const sdfField = computeSignedDistanceField(mask, grid);
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
