/**
 * Coastline-first island pipeline.
 *
 *   mask → smooth → SDF (distanceToCoast) → height → biomes → scatter
 *
 * Default: one large island per hex / number token, spaced by layoutScale.
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
  enforceIslandSeparation,
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
    const r = boardRadiusWorld(board.rings) * base.layoutScale;
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

function scaleSites(sites: GraphPoint[], scale: number): GraphPoint[] {
  if (Math.abs(scale - 1) < 1e-6) return sites;
  return sites.map((s) => ({ ...s, x: s.x * scale, z: s.z * scale }));
}

function scatterProps(
  world: Omit<WorldData, 'trees' | 'rocks' | 'props'>,
  params: WorldGenerationParams,
): {
  trees: ScatterInstance[];
  rocks: ScatterInstance[];
  props: ScatterInstance[];
} {
  const rng = mulberry32(params.island.seed ^ 0x9e3779b9);
  const trees: ScatterInstance[] = [];
  const rocks: ScatterInstance[] = [];
  const props: ScatterInstance[] = [];
  const { width, depth } = world.grid;
  const step = Math.max(1, Math.floor(96 / Math.max(params.resolution, 32)));
  const blobs = world.seed.blobs;
  const beachKeep = params.beach.dryEnd + 0.08;

  for (let iz = 2; iz < depth - 2; iz += step) {
    for (let ix = 2; ix < width - 2; ix += step) {
      const i = iz * width + ix;
      const d = world.sdfField[i]!;
      if (d < beachKeep) continue;
      const h = world.heightField[i]!;
      const slope = sampleSlope(world.heightField, world.grid, ix, iz);
      const x =
        world.grid.bounds.minX +
        (ix / (width - 1)) * (world.grid.bounds.maxX - world.grid.bounds.minX);
      const z =
        world.grid.bounds.minZ +
        (iz / (depth - 1)) * (world.grid.bounds.maxZ - world.grid.bounds.minZ);
      const jx = x + (rng() - 0.5) * step * 0.4;
      const jz = z + (rng() - 0.5) * step * 0.4;
      const weights = sampleIslandBiome(blobs, jx, jz);
      const biome = dominantBiome(weights);

      // Find owning blob for clustering props toward landmarks
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

      switch (biome) {
        case 'forest': {
          if (
            rng() < params.treeDensity * 1.15 &&
            canSpawnTree(slope, h, weights, { ...DEFAULT_TREE_GATE, minForestWeight: 0.5 })
          ) {
            trees.push({
              x: jx,
              y: h,
              z: jz,
              scale: 0.85 + rng() * 0.7,
              yaw: rng() * Math.PI * 2,
            });
          }
          if (rng() < 0.2) {
            props.push({
              x: jx,
              y: h,
              z: jz,
              scale: 0.35 + rng() * 0.25,
              yaw: rng() * Math.PI * 2,
              kind: 'bush',
            });
          }
          break;
        }
        case 'pasture': {
          if (rng() < 0.22) {
            props.push({
              x: jx,
              y: h,
              z: jz,
              scale: 0.28 + rng() * 0.22,
              yaw: rng() * Math.PI * 2,
              kind: 'bush',
            });
          }
          break;
        }
        case 'wheat': {
          if (rng() < params.treeDensity * 0.95) {
            props.push({
              x: jx,
              y: h,
              z: jz,
              scale: 0.55 + rng() * 0.45,
              yaw: rng() * Math.PI * 2,
              kind: 'wheat',
            });
          }
          break;
        }
        case 'ore':
        case 'brick': {
          if (rng() < params.rockDensity * 1.6 && d > beachKeep + 0.2) {
            const toward = 0.4 + rng() * 0.45;
            rocks.push({
              x: jx + (bx - jx) * toward * 0.35 + (rng() - 0.5) * 0.4,
              y: h,
              z: jz + (bz - jz) * toward * 0.35 + (rng() - 0.5) * 0.4,
              scale: biome === 'ore' ? 0.55 + rng() * 0.65 : 0.45 + rng() * 0.5,
              scaleY: biome === 'ore' ? 3.2 + rng() * 4.2 : 2.2 + rng() * 2.8,
              yaw: rng() * Math.PI * 2,
              kind: 'pillar',
            });
          }
          break;
        }
        case 'desert': {
          if (rng() < params.rockDensity * 0.35 && canSpawnRock(slope, h, DEFAULT_ROCK_GATE)) {
            rocks.push({
              x: jx,
              y: h,
              z: jz,
              scale: 0.4 + rng() * 0.5,
              yaw: rng() * Math.PI * 2,
              kind: 'rock',
            });
          }
          break;
        }
        default: {
          const _exhaustive: never = biome;
          void _exhaustive;
          break;
        }
      }
    }
  }
  // Guaranteed landmark props at each island nucleus (every biome looks detailed)
  for (const b of blobs) {
    const nucleusH = (() => {
      const { width, depth, bounds } = world.grid;
      const u = (b.x - bounds.minX) / Math.max(bounds.maxX - bounds.minX, 1e-6);
      const v = (b.z - bounds.minZ) / Math.max(bounds.maxZ - bounds.minZ, 1e-6);
      const ix = Math.max(0, Math.min(width - 1, Math.round(u * (width - 1))));
      const iz = Math.max(0, Math.min(depth - 1, Math.round(v * (depth - 1))));
      return world.heightField[iz * width + ix]!;
    })();

    const ring = b.radius * 0.35;
    switch (b.biome) {
      case 'forest': {
        for (let n = 0; n < 7; n++) {
          const ang = (n / 7) * Math.PI * 2 + rng() * 0.4;
          const rad = ring * (0.35 + rng() * 0.65);
          trees.push({
            x: b.x + Math.cos(ang) * rad,
            y: nucleusH,
            z: b.z + Math.sin(ang) * rad,
            scale: 0.9 + rng() * 0.7,
            yaw: rng() * Math.PI * 2,
          });
        }
        break;
      }
      case 'wheat': {
        for (let n = 0; n < 10; n++) {
          const ang = rng() * Math.PI * 2;
          const rad = ring * (0.2 + rng() * 0.8);
          props.push({
            x: b.x + Math.cos(ang) * rad,
            y: nucleusH,
            z: b.z + Math.sin(ang) * rad,
            scale: 0.6 + rng() * 0.5,
            yaw: rng() * Math.PI * 2,
            kind: 'wheat',
          });
        }
        break;
      }
      case 'pasture': {
        for (let n = 0; n < 5; n++) {
          const ang = rng() * Math.PI * 2;
          const rad = ring * (0.3 + rng() * 0.7);
          props.push({
            x: b.x + Math.cos(ang) * rad,
            y: nucleusH,
            z: b.z + Math.sin(ang) * rad,
            scale: 0.35 + rng() * 0.3,
            yaw: rng() * Math.PI * 2,
            kind: 'bush',
          });
        }
        break;
      }
      case 'ore': {
        for (let n = 0; n < 6; n++) {
          const ang = -0.4 + n * 0.35 + rng() * 0.15;
          const rad = ring * (0.15 + rng() * 0.45);
          rocks.push({
            x: b.x + Math.cos(ang) * rad,
            y: nucleusH,
            z: b.z + Math.sin(ang) * rad,
            scale: 0.7 + rng() * 0.6,
            scaleY: 3.5 + rng() * 4.5,
            yaw: rng() * Math.PI * 2,
            kind: 'pillar',
          });
        }
        break;
      }
      case 'brick': {
        for (let n = 0; n < 5; n++) {
          const ang = rng() * Math.PI * 2;
          const rad = ring * (0.2 + rng() * 0.5);
          rocks.push({
            x: b.x + Math.cos(ang) * rad,
            y: nucleusH,
            z: b.z + Math.sin(ang) * rad,
            scale: 0.55 + rng() * 0.5,
            scaleY: 2.4 + rng() * 3.0,
            yaw: rng() * Math.PI * 2,
            kind: 'pillar',
          });
        }
        break;
      }
      case 'desert': {
        for (let n = 0; n < 4; n++) {
          const ang = rng() * Math.PI * 2;
          const rad = ring * (0.25 + rng() * 0.6);
          rocks.push({
            x: b.x + Math.cos(ang) * rad,
            y: nucleusH,
            z: b.z + Math.sin(ang) * rad,
            scale: 0.45 + rng() * 0.45,
            yaw: rng() * Math.PI * 2,
            kind: 'rock',
          });
        }
        break;
      }
      default: {
        const _exhaustive: never = b.biome;
        void _exhaustive;
        break;
      }
    }
  }

  return { trees, rocks, props };
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
  const g =
    graph ??
    (board
      ? boardToRegionGraph(board, seed.params.seed)
      : createEmptyGraph(seed.params.seed));

  // Spread hex centers so each island can be large with water between
  const rawSites = regionCenters(g);
  const sites = scaleSites(rawSites, params.layoutScale);
  for (const s of sites) {
    const r = g.regions.get(s.id);
    if (r) r.position = { x: s.x, z: s.z };
  }
  seed = withArchipelagoBlobs(seed, sites, board?.rings);

  let extent = seed.params.radius * params.extentScale;
  for (const b of seed.blobs) {
    extent = Math.max(
      extent,
      Math.hypot(b.x, b.z) + b.radius * 1.45,
      Math.abs(b.x) + b.radius * 1.25,
      Math.abs(b.z) + b.radius * 1.25,
    );
  }
  const grid = {
    width: params.resolution,
    depth: params.resolution,
    bounds: { minX: -extent, maxX: extent, minZ: -extent, maxZ: extent },
  };

  let mask = fillIslandMaskGrid(seed, grid.width, grid.depth, grid.bounds);
  // Soften expands land and bridges gaps — only for single landmass
  if (seed.blobs.length < 2) {
    mask = smoothIslandMask(mask, grid.width, grid.depth, Math.max(0, params.smoothPasses));
    mask = distanceTransformSoften(mask, grid.width, grid.depth);
  } else {
    // Light edge soften only (1 pass), then hard-separate
    if (params.smoothPasses > 0) {
      mask = smoothIslandMask(mask, grid.width, grid.depth, 1);
    }
    mask = enforceIslandSeparation(mask, grid, seed.blobs, sites, 1.05);
    mask = carveArchipelagoChannels(
      mask,
      grid,
      seed.blobs,
      sites,
      Math.max(seed.params.archipelagoSpread, 0.8),
      1.05,
    );
    mask = protectSiteFootprints(mask, grid, sites, 1.0, 0.78);
    mask = enforceIslandSeparation(mask, grid, seed.blobs, sites, 1.0);
    mask = keepSiteLandComponents(mask, grid, sites, 0.5);
    mask = protectSiteFootprints(mask, grid, sites, 0.95, 0.8);
  }

  if (seed.blobs.length < 2) {
    mask = protectSiteFootprints(mask, grid, sites, 0.9, 0.72);
  }

  const sdfField = computeSignedDistanceField(mask, grid);
  shallowSandbarShelf(sdfField, grid, seed.blobs, -0.32);
  const sdf = buildGridSdf(sdfField, grid);

  const heightParams = { ...params.height, verticalScale: params.verticalScale };
  const heightField = fillHeightField(sdf, grid, heightParams, seed.params.seed);
  for (let i = 0; i < heightField.length; i++) {
    if (sdfField[i]! < 0) {
      const shelf = sdfField[i]! > -0.55 ? -0.015 : -0.07;
      heightField[i] = Math.min(heightField[i]!, shelf);
    }
  }

  // Biome micro-relief: ore/brick rise; desert slightly dune-y
  for (let iz = 0; iz < grid.depth; iz++) {
    for (let ix = 0; ix < grid.width; ix++) {
      const i = iz * grid.width + ix;
      if (sdfField[i]! < params.beach.dryEnd) continue;
      const { x, z } = {
        x:
          grid.bounds.minX +
          (ix / (grid.width - 1)) * (grid.bounds.maxX - grid.bounds.minX),
        z:
          grid.bounds.minZ +
          (iz / (grid.depth - 1)) * (grid.bounds.maxZ - grid.bounds.minZ),
      };
      const biome = dominantBiome(sampleIslandBiome(seed.blobs, x, z));
      if (biome === 'ore') heightField[i]! += 0.06;
      else if (biome === 'brick') heightField[i]! += 0.035;
      else if (biome === 'desert') heightField[i]! += 0.02;
    }
  }

  const biomeField = fillIslandBiomeField(seed.blobs, grid, sdfField);
  const coast = extractCoastlineFromField(sdfField, grid);
  coast.loops = coast.loops.filter((l) => l.points.length >= 20);

  const partialWorld: Omit<WorldData, 'trees' | 'rocks' | 'props'> = {
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
  const { trees, rocks, props } = scatterProps(partialWorld, params);

  return { ...partialWorld, trees, rocks, props };
}
