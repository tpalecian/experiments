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
import { dominantBiome, fillIslandBiomeField, sampleIslandBiome } from './biome';
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
import {
  carveArchipelagoChannels,
  keepSiteLandComponents,
  protectSiteFootprints,
  shallowSandbarShelf,
} from './channels';
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
  const blobs = world.seed.blobs;

  for (let iz = 2; iz < depth - 2; iz += step) {
    for (let ix = 2; ix < width - 2; ix += step) {
      const i = iz * width + ix;
      const d = world.sdfField[i]!;
      // Keep scatter inland of the beach ring
      if (d < params.beach.dryEnd + 0.2) continue;
      const h = world.heightField[i]!;
      const slope = sampleSlope(world.heightField, world.grid, ix, iz);
      const x =
        world.grid.bounds.minX +
        (ix / (width - 1)) * (world.grid.bounds.maxX - world.grid.bounds.minX);
      const z =
        world.grid.bounds.minZ +
        (iz / (depth - 1)) * (world.grid.bounds.maxZ - world.grid.bounds.minZ);
      const jx = x + (rng() - 0.5) * step * 0.35;
      const jz = z + (rng() - 0.5) * step * 0.35;
      const weights = sampleIslandBiome(blobs, jx, jz);
      const biome = dominantBiome(weights);

      if (
        biome === 'forest' &&
        rng() < params.treeDensity &&
        canSpawnTree(slope, h, weights, DEFAULT_TREE_GATE)
      ) {
        trees.push({
          x: jx,
          y: h,
          z: jz,
          scale: 0.75 + rng() * 0.55,
          yaw: rng() * Math.PI * 2,
        });
      }

      const wantsPillars = biome === 'ore' || biome === 'brick';
      const rockChance = wantsPillars ? Math.min(1, params.rockDensity * 1.8) : params.rockDensity * 0.35;
      if (rng() < rockChance) {
        if (wantsPillars && d > params.beach.dryEnd + 0.35) {
          let bx = jx;
          let bz = jz;
          let best = Infinity;
          for (const b of blobs) {
            const dd = Math.hypot(jx - b.x, jz - b.z);
            if (dd < best) {
              best = dd;
              bx = b.x;
              bz = b.z;
            }
          }
          const toward = 0.35 + rng() * 0.45;
          rocks.push({
            x: jx + (bx - jx) * toward * 0.25 + (rng() - 0.5) * 0.35,
            y: h,
            z: jz + (bz - jz) * toward * 0.25 + (rng() - 0.5) * 0.35,
            scale: 0.45 + rng() * 0.55,
            scaleY: 2.4 + rng() * 3.2,
            yaw: rng() * Math.PI * 2,
          });
        } else if (canSpawnRock(slope, h, DEFAULT_ROCK_GATE)) {
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
    Math.max(seed.params.archipelagoSpread, seed.blobs.length > 1 ? 0.62 : 0),
    0.58,
  );
  // Small rescue disks only — large protect radii bridge adjacent island hexes
  mask = protectSiteFootprints(mask, grid, sites, 0.55, 0.72);
  // Drop carve speckles that don't hold gameplay sites
  mask = keepSiteLandComponents(mask, grid, sites, 0.5);
  // Archipelago: skip post-carve blur (it reseals thin sandbar channels)
  if (params.smoothPasses > 0 && seed.blobs.length < 2) {
    mask = smoothIslandMask(mask, grid.width, grid.depth, 1);
    mask = protectSiteFootprints(mask, grid, sites, 0.7, 0.7);
  } else {
    mask = protectSiteFootprints(mask, grid, sites, 0.5, 0.75);
    mask = keepSiteLandComponents(mask, grid, sites, 0.5);
  }

  // Organic multi-island coastline — blobs sized to cover gameplay sites.
  const sdfField = computeSignedDistanceField(mask, grid);
  shallowSandbarShelf(sdfField, grid, seed.blobs, -0.38);
  const sdf = buildGridSdf(sdfField, grid);

  const heightParams = { ...params.height, verticalScale: params.verticalScale };
  const heightField = fillHeightField(sdf, grid, heightParams, seed.params.seed);
  // Flatten underwater to slightly below sea for mesh / water discard
  for (let i = 0; i < heightField.length; i++) {
    if (sdfField[i]! < 0) {
      // Sandbar shallows sit just under the surface
      const shelf = sdfField[i]! > -0.5 ? -0.02 : -0.08;
      heightField[i] = Math.min(heightField[i]!, shelf);
    }
  }

  const biomeField = fillIslandBiomeField(seed.blobs, grid, sdfField);
  const coast = extractCoastlineFromField(sdfField, grid);
  // Drop speckles from noisy channel carving (keep real island outlines)
  coast.loops = coast.loops.filter((l) => l.points.length >= 24);

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
