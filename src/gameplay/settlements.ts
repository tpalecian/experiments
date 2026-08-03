/**
 * Settlements spawn at graph junctions, then offset to believable world spots.
 */

import type { RegionGraph } from './regions';

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
 * Candidate junctions where ≥3 regions meet (or graph vertices in hex compat).
 * Stub until junction enumeration + terrain snap exist.
 */
export function enumerateSettlementSites(_graph: RegionGraph): SettlementSite[] {
  return [];
}

/** Nudge a site off the exact junction toward flatter / coastal-believable ground. */
export function offsetSettlement(
  site: SettlementSite,
  _dx: number,
  _dz: number,
): SettlementSite {
  return { ...site };
}
