/**
 * Island generation pipeline entry — wires seed → graph → SDF → mesh later.
 * Not hooked into the live hex BoardView yet; see docs/VISION.md.
 */

import { createEmptyGraph, type RegionGraph } from '../gameplay/regions';
import { createIslandSeed, type IslandParams, type IslandSeed } from './island';
import { buildIslandSdf, type IslandSdf } from './sdf';
import { regionCenters, type GraphPoint } from './graph';

export interface IslandPipelineResult {
  seed: IslandSeed;
  graph: RegionGraph;
  sites: GraphPoint[];
  sdf: IslandSdf;
}

/**
 * Bootstrap an island generation context.
 * Region filling / Lloyd / mesh extraction land in later milestones.
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
