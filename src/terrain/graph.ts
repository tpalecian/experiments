/**
 * Spatial bridge from gameplay regions → points used by Voronoi / SDF.
 */

import type { Region, RegionGraph } from '../gameplay/regions';

export interface GraphPoint {
  id: string;
  x: number;
  z: number;
  resource: Region['resource'];
}

export function regionCenters(graph: RegionGraph): GraphPoint[] {
  const out: GraphPoint[] = [];
  for (const r of graph.regions.values()) {
    out.push({
      id: r.id,
      x: r.position.x,
      z: r.position.z,
      resource: r.resource,
    });
  }
  return out;
}
