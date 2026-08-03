/**
 * Settlements spawn at graph junctions, then offset to believable world spots.
 */

import type { BoardState } from '../game/types';
import type { RegionGraph } from './regions';
import type { WorldData } from '../world/types';
import { worldSampleBilinear } from '../world/types';

export interface SettlementSite {
  id: string;
  /** Junction key (e.g. sorted neighbor triple or vertex id). */
  junctionId: string;
  x: number;
  z: number;
  /** Optional vertical snap once heightmap exists. */
  y: number;
}

/**
 * Candidate junctions from hex board vertices (compat).
 * Prefer vertices that touch ≥2 land hexes.
 */
export function enumerateSettlementSites(
  graph: RegionGraph,
  board?: BoardState,
): SettlementSite[] {
  if (board) {
    const out: SettlementSite[] = [];
    for (const v of board.vertices.values()) {
      if (v.hexIds.length < 2) continue;
      out.push({
        id: v.id,
        junctionId: v.id,
        x: v.x,
        z: v.z,
        y: 0,
      });
    }
    return out;
  }

  // Fallback: region centers as provisional sites
  const out: SettlementSite[] = [];
  for (const r of graph.regions.values()) {
    out.push({
      id: r.id,
      junctionId: r.id,
      x: r.position.x,
      z: r.position.z,
      y: 0,
    });
  }
  return out;
}

/** Nudge a site off the exact junction toward flatter / coastal-believable ground. */
export function offsetSettlement(
  site: SettlementSite,
  dx: number,
  dz: number,
): SettlementSite {
  return { ...site, x: site.x + dx, z: site.z + dz };
}

/** Snap settlement Y to the world height field. */
export function snapSettlementToTerrain(
  site: SettlementSite,
  world: WorldData,
  lift = 0.02,
): SettlementSite {
  const y = worldSampleBilinear(world.heightField, world.grid, site.x, site.z);
  return { ...site, y: y + lift };
}

export function snapBoardVertexHeight(
  board: BoardState,
  vertexId: string,
  world: WorldData | null,
  baseY: number,
): number {
  if (!world) return baseY;
  const v = board.vertices.get(vertexId);
  if (!v) return baseY;
  return worldSampleBilinear(world.heightField, world.grid, v.x, v.z) + 0.02;
}
