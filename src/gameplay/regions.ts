/**
 * Hidden gameplay region graph.
 * Controls resources and adjacency only — never rendered as tiles.
 */

import { axialToWorld } from '../game/board';
import type { BoardState, Terrain } from '../game/types';

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
  /** Hex axial coords during MVP compat (optional). */
  q?: number;
  r?: number;
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

const HEX_DIRS = [
  { q: 1, r: 0 },
  { q: 0, r: 1 },
  { q: -1, r: 1 },
  { q: -1, r: 0 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
];

export function terrainToResourceKind(terrain: Terrain): ResourceKind {
  switch (terrain) {
    case 'wood':
      return 'forest';
    case 'brick':
      return 'brick';
    case 'sheep':
      return 'pasture';
    case 'wheat':
      return 'wheat';
    case 'ore':
      return 'ore';
    case 'desert':
      return 'desert';
    default: {
      const _exhaustive: never = terrain;
      return _exhaustive;
    }
  }
}

export const RESOURCE_KIND_INDEX: Record<ResourceKind, number> = {
  forest: 0,
  wheat: 1,
  ore: 2,
  brick: 3,
  pasture: 4,
  desert: 5,
};

export const RESOURCE_KINDS: ResourceKind[] = [
  'forest',
  'wheat',
  'ore',
  'brick',
  'pasture',
  'desert',
];

/**
 * Compat adapter: one region per land hex, neighbors from hex adjacency,
 * positions from axial→world. Rules stay on BoardState; this graph drives visuals.
 */
export function boardToRegionGraph(board: BoardState, seed = 1): RegionGraph {
  const graph = createEmptyGraph(seed);
  for (const hex of board.hexes.values()) {
    const { x, z } = axialToWorld(hex.q, hex.r);
    addRegion(graph, {
      id: hex.id,
      resource: terrainToResourceKind(hex.terrain),
      neighbors: [],
      position: { x, z },
      q: hex.q,
      r: hex.r,
    });
  }
  for (const hex of board.hexes.values()) {
    for (const d of HEX_DIRS) {
      const nid = `${hex.q + d.q},${hex.r + d.r}`;
      if (board.hexes.has(nid)) linkNeighbors(graph, hex.id, nid);
    }
  }
  return graph;
}
