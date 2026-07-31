import { verticesDistanceOk } from './board';
import type {
  BoardState,
  BuildMode,
  PlayerId,
  PlayerState,
  Resource,
  ResourceBank,
} from './types';
import { BUILD_COSTS, MAX_CITIES, MAX_ROADS, MAX_SETTLEMENTS, RESOURCES, emptyBank } from './types';

export function canAfford(player: PlayerState, cost: Partial<ResourceBank>): boolean {
  for (const r of RESOURCES) {
    const need = cost[r] ?? 0;
    if (player.resources[r] < need) return false;
  }
  return true;
}

export function payCost(player: PlayerState, cost: Partial<ResourceBank>): void {
  for (const r of RESOURCES) {
    const need = cost[r] ?? 0;
    player.resources[r] -= need;
  }
}

export function addResources(player: PlayerState, gain: Partial<ResourceBank>): void {
  for (const r of RESOURCES) {
    const n = gain[r] ?? 0;
    player.resources[r] += n;
  }
}

export function legalSetupSettlements(board: BoardState): string[] {
  const out: string[] = [];
  for (const v of board.vertices.values()) {
    if (verticesDistanceOk(board, v.id)) out.push(v.id);
  }
  return out;
}

export function legalSetupRoads(board: BoardState, _playerId: PlayerId, lastSettlement: string): string[] {
  const v = board.vertices.get(lastSettlement);
  if (!v) return [];
  return v.edgeIds.filter((eid) => !board.roads.has(eid));
}

function playerOwnsAdjacentRoad(board: BoardState, vertexId: string, playerId: PlayerId): boolean {
  const v = board.vertices.get(vertexId);
  if (!v) return false;
  return v.edgeIds.some((eid) => board.roads.get(eid)?.owner === playerId);
}

function playerOwnsRoadToEdge(board: BoardState, edgeId: string, playerId: PlayerId): boolean {
  const e = board.edges.get(edgeId);
  if (!e) return false;
  for (const vid of e.vertexIds) {
    const building = board.buildings.get(vid);
    if (building?.owner === playerId) return true;
    const v = board.vertices.get(vid)!;
    for (const otherEid of v.edgeIds) {
      if (otherEid === edgeId) continue;
      if (board.roads.get(otherEid)?.owner === playerId) {
        const otherBuilding = board.buildings.get(vid);
        if (!otherBuilding || otherBuilding.owner === playerId) return true;
      }
    }
  }
  return false;
}

export function legalSettlements(board: BoardState, playerId: PlayerId): string[] {
  const out: string[] = [];
  for (const v of board.vertices.values()) {
    if (!verticesDistanceOk(board, v.id)) continue;
    if (!playerOwnsAdjacentRoad(board, v.id, playerId)) continue;
    out.push(v.id);
  }
  return out;
}

export function legalCities(board: BoardState, playerId: PlayerId): string[] {
  const out: string[] = [];
  for (const b of board.buildings.values()) {
    if (b.owner === playerId && b.kind === 'settlement') out.push(b.vertexId);
  }
  return out;
}

export function legalRoads(board: BoardState, playerId: PlayerId): string[] {
  const out: string[] = [];
  for (const e of board.edges.values()) {
    if (board.roads.has(e.id)) continue;
    if (playerOwnsRoadToEdge(board, e.id, playerId)) out.push(e.id);
  }
  return out;
}

export function legalTargets(board: BoardState, player: PlayerState, mode: BuildMode): string[] {
  switch (mode) {
    case 'none':
      return [];
    case 'road':
      if (player.roads >= MAX_ROADS) return [];
      if (!canAfford(player, BUILD_COSTS.road)) return [];
      return legalRoads(board, player.id);
    case 'settlement':
      if (player.settlements >= MAX_SETTLEMENTS) return [];
      if (!canAfford(player, BUILD_COSTS.settlement)) return [];
      return legalSettlements(board, player.id);
    case 'city':
      if (player.cities >= MAX_CITIES) return [];
      if (!canAfford(player, BUILD_COSTS.city)) return [];
      return legalCities(board, player.id);
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}

export function tradeRate(board: BoardState, playerId: PlayerId, resource: Resource): number {
  let best = 4;
  for (const b of board.buildings.values()) {
    if (b.owner !== playerId) continue;
    const v = board.vertices.get(b.vertexId);
    const harbor = v?.harbor;
    if (!harbor) continue;
    if (harbor.type === 'generic') best = Math.min(best, 3);
    if (harbor.type === resource) best = Math.min(best, 2);
  }
  return best;
}

export function distributeProduction(
  board: BoardState,
  players: PlayerState[],
  roll: number,
): Map<PlayerId, ResourceBank> {
  const gains = new Map<PlayerId, ResourceBank>();
  for (const p of players) gains.set(p.id, emptyBank());

  for (const hex of board.hexes.values()) {
    if (hex.number !== roll) continue;
    if (hex.id === board.robberHexId) continue;
    const res = hex.terrain === 'desert' ? null : hex.terrain;
    if (!res) continue;
    for (const vid of hex.vertexIds) {
      const b = board.buildings.get(vid);
      if (!b) continue;
      const amount = b.kind === 'city' ? 2 : 1;
      const bank = gains.get(b.owner)!;
      bank[res] += amount;
    }
  }

  for (const p of players) {
    addResources(p, gains.get(p.id)!);
  }
  return gains;
}

export function computeVictoryPoints(board: BoardState, player: PlayerState, longestRoadOwner: PlayerId | null): number {
  let vp = 0;
  for (const b of board.buildings.values()) {
    if (b.owner !== player.id) continue;
    vp += b.kind === 'city' ? 2 : 1;
  }
  if (longestRoadOwner === player.id) vp += 2;
  return vp;
}

/** Longest continuous road for a player (simplified DFS). */
export function longestRoadLength(board: BoardState, playerId: PlayerId): number {
  const owned = [...board.roads.values()].filter((r) => r.owner === playerId).map((r) => r.edgeId);
  if (owned.length === 0) return 0;

  const adj = new Map<string, string[]>();
  for (const eid of owned) {
    const e = board.edges.get(eid)!;
    for (const vid of e.vertexIds) {
      const building = board.buildings.get(vid);
      if (building && building.owner !== playerId) continue;
      if (!adj.has(vid)) adj.set(vid, []);
      adj.get(vid)!.push(eid);
    }
  }

  let best = 0;

  const dfs = (edgeId: string, fromVertex: string, used: Set<string>): number => {
    used.add(edgeId);
    const e = board.edges.get(edgeId)!;
    const nextV = e.vertexIds[0] === fromVertex ? e.vertexIds[1] : e.vertexIds[0];
    const building = board.buildings.get(nextV);
    if (building && building.owner !== playerId) {
      used.delete(edgeId);
      return 1;
    }
    let maxExt = 0;
    for (const nextE of adj.get(nextV) ?? []) {
      if (used.has(nextE)) continue;
      maxExt = Math.max(maxExt, dfs(nextE, nextV, used));
    }
    used.delete(edgeId);
    return 1 + maxExt;
  };

  for (const eid of owned) {
    const e = board.edges.get(eid)!;
    best = Math.max(best, dfs(eid, e.vertexIds[0], new Set()));
    best = Math.max(best, dfs(eid, e.vertexIds[1], new Set()));
  }
  return best;
}

export function updateLongestRoad(
  board: BoardState,
  players: PlayerState[],
  currentOwner: PlayerId | null,
): PlayerId | null {
  let bestLen = 0;
  let bestPlayer: PlayerId | null = null;
  for (const p of players) {
    const len = longestRoadLength(board, p.id);
    if (len > bestLen) {
      bestLen = len;
      bestPlayer = p.id;
    }
  }
  if (bestLen < 5) return null;
  if (currentOwner !== null) {
    const currentLen = longestRoadLength(board, currentOwner);
    if (currentLen >= bestLen && currentLen >= 5) return currentOwner;
  }
  return bestPlayer;
}

export function playersAdjacentToHex(board: BoardState, hexId: string, exclude: PlayerId): PlayerId[] {
  const hex = board.hexes.get(hexId);
  if (!hex) return [];
  const set = new Set<PlayerId>();
  for (const vid of hex.vertexIds) {
    const b = board.buildings.get(vid);
    if (b && b.owner !== exclude) set.add(b.owner);
  }
  return [...set];
}

export function discardCount(totalCards: number): number {
  if (totalCards <= 7) return 0;
  return Math.floor(totalCards / 2);
}
