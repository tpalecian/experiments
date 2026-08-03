/**
 * Delaunay + Voronoi from region centers, with Lloyd relaxation for organic cells.
 * Gameplay adjacency stays on the region graph; this is visual only.
 */

import type { GraphPoint } from './graph';

export interface VoronoiCell {
  siteId: string;
  /** Cell polygon in XZ (visual; may be blurred later). */
  polygon: { x: number; z: number }[];
}

export interface VoronoiDiagram {
  cells: VoronoiCell[];
  sites: GraphPoint[];
}

/** Build Voronoi from sites. Stub until Delaunay triangulation lands. */
export function buildVoronoi(sites: GraphPoint[]): VoronoiDiagram {
  return { cells: [], sites };
}

/**
 * Lloyd relaxation: move sites toward cell centroids, rebuild.
 * Improves visual spacing without changing gameplay neighbor lists.
 */
export function lloydRelax(
  diagram: VoronoiDiagram,
  _iterations: number,
): VoronoiDiagram {
  return diagram;
}
