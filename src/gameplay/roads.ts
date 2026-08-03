/**
 * Roads: A* over the hidden region graph, then spline for dirt-path rendering.
 */

import type { RegionGraph } from './regions';

export interface PathNode {
  regionId: string;
  x: number;
  z: number;
}

export interface RoadPath {
  nodes: PathNode[];
  /** Sampled points along a smoothed spline for mesh generation. */
  samples: { x: number; z: number }[];
}

/**
 * Shortest path over region adjacency.
 * Stub: returns empty path until A* is implemented.
 */
export function findRoadPath(
  _graph: RegionGraph,
  _fromId: string,
  _toId: string,
): RoadPath {
  return { nodes: [], samples: [] };
}

/** Convert graph nodes into evenly spaced spline samples. */
export function pathToSpline(nodes: PathNode[], _segments = 8): { x: number; z: number }[] {
  if (nodes.length === 0) return [];
  // Placeholder: polyline midpoints; replace with Catmull-Rom / cubic later.
  return nodes.map((n) => ({ x: n.x, z: n.z }));
}
