/**
 * Delaunay + Voronoi from region centers (visual only).
 * Simple nearest-site cell approximation — gameplay adjacency stays on the graph.
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

/**
 * Build approximate Voronoi cells as squares around sites (soft biome uses distance field).
 * Lloyd relaxation nudges sites toward local centroids for spacing.
 */
export function buildVoronoi(sites: GraphPoint[], cellRadius = 1.1): VoronoiDiagram {
  const cells: VoronoiCell[] = sites.map((s) => {
    const r = cellRadius;
    return {
      siteId: s.id,
      polygon: [
        { x: s.x - r, z: s.z - r },
        { x: s.x + r, z: s.z - r },
        { x: s.x + r, z: s.z + r },
        { x: s.x - r, z: s.z + r },
      ],
    };
  });
  return { cells, sites };
}

/**
 * Lloyd relaxation: move sites toward cell centroids, rebuild.
 */
export function lloydRelax(diagram: VoronoiDiagram, iterations: number): VoronoiDiagram {
  let sites = diagram.sites.map((s) => ({ ...s }));
  for (let i = 0; i < iterations; i++) {
    const next = sites.map((s) => {
      // Average of self + neighbors within 2.5 units
      let sx = s.x;
      let sz = s.z;
      let n = 1;
      for (const o of sites) {
        if (o.id === s.id) continue;
        const d = Math.hypot(o.x - s.x, o.z - s.z);
        if (d < 2.5 && d > 1e-6) {
          sx += o.x;
          sz += o.z;
          n++;
        }
      }
      // Push away from neighbors slightly (spacing)
      let px = 0;
      let pz = 0;
      for (const o of sites) {
        if (o.id === s.id) continue;
        const dx = s.x - o.x;
        const dz = s.z - o.z;
        const d = Math.hypot(dx, dz) || 1;
        if (d < 1.6) {
          px += dx / d;
          pz += dz / d;
        }
      }
      return {
        ...s,
        x: (sx / n) * 0.35 + s.x * 0.55 + px * 0.1,
        z: (sz / n) * 0.35 + s.z * 0.55 + pz * 0.1,
      };
    });
    sites = next;
  }
  return buildVoronoi(sites);
}
