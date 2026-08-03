/**
 * DEPRECATED / unused — organic coastline-first island pipeline.
 *
 * The product path keeps readable hex tiles (`src/render/BoardView.ts`).
 * Do not wire this into the live game. See docs/TERRAIN.md and docs/VISION.md.
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
