import type { Building, PlayerId, Road } from '../../src/engine/types';

/** Minimal graph for pure longest-road tests. Do not pass to rendering or trade helpers. */
export interface SyntheticRoadGraph {
  roads: Map<string, Road>;
  edges: Map<string, { vertexIds: [string, string] }>;
  buildings: Map<string, Building>;
}

export function emptyRoadGraph(): SyntheticRoadGraph {
  return {
    roads: new Map(),
    edges: new Map(),
    buildings: new Map(),
  };
}

export function addRoad(
  graph: SyntheticRoadGraph,
  player: PlayerId,
  edgeId: string,
  vertexA: string,
  vertexB: string,
): void {
  graph.edges.set(edgeId, { vertexIds: [vertexA, vertexB] });
  graph.roads.set(edgeId, { edgeId, owner: player });
}

/** Linear chain of `edgeCount` roads. Vertices are `${prefix}v0` … `${prefix}vN`. */
export function addRoadChain(
  graph: SyntheticRoadGraph,
  player: PlayerId,
  edgeCount: number,
  prefix: string,
): void {
  for (let i = 0; i < edgeCount; i++) {
    addRoad(graph, player, `${prefix}e${i}`, `${prefix}v${i}`, `${prefix}v${i + 1}`);
  }
}

export function addBlockingSettlement(
  graph: SyntheticRoadGraph,
  vertexId: string,
  owner: PlayerId,
): void {
  graph.buildings.set(vertexId, { vertexId, owner, kind: 'settlement' });
}
