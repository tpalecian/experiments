/**
 * Hidden gameplay region graph.
 * Controls resources and adjacency only — never rendered as tiles.
 */

export type ResourceKind =
  | 'forest'
  | 'wheat'
  | 'ore'
  | 'brick'
  | 'pasture'
  | 'desert';

export interface Region {
  id: string;
  resource: ResourceKind;
  neighbors: string[];
  /** Planar center in world XZ (y unused). */
  position: { x: number; z: number };
}

export interface RegionGraph {
  regions: Map<string, Region>;
  seed: number;
}

export function createEmptyGraph(seed: number): RegionGraph {
  return { regions: new Map(), seed };
}

export function getRegion(graph: RegionGraph, id: string): Region | undefined {
  return graph.regions.get(id);
}

export function addRegion(graph: RegionGraph, region: Region): void {
  graph.regions.set(region.id, region);
}

export function linkNeighbors(graph: RegionGraph, a: string, b: string): void {
  const ra = graph.regions.get(a);
  const rb = graph.regions.get(b);
  if (!ra || !rb) return;
  if (!ra.neighbors.includes(b)) ra.neighbors.push(b);
  if (!rb.neighbors.includes(a)) rb.neighbors.push(a);
}
