/**
 * Coastline-first island pipeline.
 *
 *   mask → smooth → SDF (distanceToCoast) → height → mesh / water / props
 *
 * Not hooked into the live hex BoardView yet; see docs/TERRAIN.md.
 */

import { createEmptyGraph, type RegionGraph } from '../gameplay/regions';
import { createIslandSeed, type IslandParams, type IslandSeed } from './island';
import { buildIslandSdf, type IslandSdf } from './sdf';
import { regionCenters, type GraphPoint } from './graph';

export interface IslandPipelineResult {
  seed: IslandSeed;
  graph: RegionGraph;
  sites: GraphPoint[];
  /** Shared field: ocean < 0, coast = 0, land > 0. */
  sdf: IslandSdf;
}

/**
 * Bootstrap an island generation context.
 * Mask smoothing, true distance transform, and mesh extraction land later.
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
