import { verticesDistanceOk } from '../../src/engine/board';
import { GameEngine } from '../../src/engine/engine';
import { grantAffordableResources, startSeededGame } from '../../src/engine/fixtures';
import { legalRoads, legalSettlements, longestRoadLength } from '../../src/engine/rules';
import { emptyBank, type PlayerId, type PlayerState } from '../../src/engine/types';

const STOCK: Array<'road' | 'settlement'> = [
  'road',
  'road',
  'road',
  'road',
  'road',
  'road',
  'road',
  'road',
  'road',
  'road',
  'road',
  'road',
  'settlement',
  'settlement',
  'settlement',
];

export function awardPlayers(ids: readonly PlayerId[]): PlayerState[] {
  return ids.map((id) => ({
    id,
    name: String(id),
    color: 0,
    resources: emptyBank(),
    settlements: 0,
    cities: 0,
    roads: 0,
    victoryPoints: 0,
  }));
}

export function permute<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [items.slice()];
  const out: T[][] = [];
  items.forEach((item, index) => {
    for (const rest of permute([...items.slice(0, index), ...items.slice(index + 1)])) {
      out.push([item, ...rest]);
    }
  });
  return out;
}

function stock(engine: GameEngine, player: PlayerId): void {
  grantAffordableResources(engine.players[player], STOCK);
}

function placeLegalRoad(engine: GameEngine, player: PlayerId, edgeId: string): boolean {
  engine.currentPlayer = player;
  engine.phase = 'main';
  engine.setBuildMode('road');
  return engine.placeRoad(edgeId);
}

/** Grow `player`'s continuous road into open vertices until `target` length. */
export function growOpenLongestRoad(engine: GameEngine, player: PlayerId, target = 5): boolean {
  engine.currentPlayer = player;
  engine.phase = 'main';
  stock(engine, player);
  let guard = 0;
  while (longestRoadLength(engine.board, player) < target && guard++ < 30) {
    const legal = legalRoads(engine.board, player);
    if (legal.length === 0) return false;
    let best = legal[0];
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const edgeId of legal) {
      const edge = engine.board.edges.get(edgeId)!;
      engine.board.roads.set(edgeId, { edgeId, owner: player });
      const len = longestRoadLength(engine.board, player);
      engine.board.roads.delete(edgeId);
      const open =
        (verticesDistanceOk(engine.board, edge.vertexIds[0]) ? 1 : 0) +
        (verticesDistanceOk(engine.board, edge.vertexIds[1]) ? 1 : 0);
      const score = len * 10 + open;
      if (score > bestScore) {
        bestScore = score;
        best = edgeId;
      }
    }
    if (!placeLegalRoad(engine, player, best)) return false;
  }
  return longestRoadLength(engine.board, player) >= target;
}

function otherVertex(vertexIds: [string, string], vertexId: string): string {
  return vertexIds[0] === vertexId ? vertexIds[1] : vertexIds[0];
}

function networkVertices(engine: GameEngine, player: PlayerId): Set<string> {
  const verts = new Set<string>();
  for (const road of engine.board.roads.values()) {
    if (road.owner !== player) continue;
    const edge = engine.board.edges.get(road.edgeId);
    if (!edge) continue;
    verts.add(edge.vertexIds[0]);
    verts.add(edge.vertexIds[1]);
  }
  return verts;
}

function shortestEmptyPath(engine: GameEngine, player: PlayerId, target: string, maxLen: number): string[] | null {
  const targetVertex = engine.board.vertices.get(target);
  if (!targetVertex) return null;
  if (targetVertex.edgeIds.some((id) => engine.board.roads.get(id)?.owner === player)) return [];

  const starts = networkVertices(engine, player);
  const queue: Array<{ vid: string; edges: string[] }> = [];
  const seen = new Set(starts);
  for (const vid of starts) queue.push({ vid, edges: [] });

  let index = 0;
  while (index < queue.length) {
    const cur = queue[index++];
    if (cur.vid === target && cur.edges.length > 0) return cur.edges;
    if (cur.edges.length >= maxLen) continue;
    const vertex = engine.board.vertices.get(cur.vid);
    if (!vertex) continue;
    for (const edgeId of vertex.edgeIds) {
      if (engine.board.roads.has(edgeId) || cur.edges.includes(edgeId)) continue;
      const edge = engine.board.edges.get(edgeId);
      if (!edge) continue;
      const next = otherVertex(edge.vertexIds, cur.vid);
      if (next !== target && seen.has(next)) continue;
      if (next !== target) seen.add(next);
      queue.push({ vid: next, edges: [...cur.edges, edgeId] });
    }
  }
  return null;
}

function connectByEmptyPath(engine: GameEngine, player: PlayerId, target: string, maxLen: number): boolean {
  engine.currentPlayer = player;
  engine.phase = 'main';
  stock(engine, player);
  const path = shortestEmptyPath(engine, player, target, maxLen);
  if (!path) return false;
  for (const edgeId of path) {
    if (engine.board.roads.has(edgeId)) continue;
    if (!legalRoads(engine.board, player).includes(edgeId)) return false;
    if (!placeLegalRoad(engine, player, edgeId)) return false;
  }
  const vertex = engine.board.vertices.get(target);
  return Boolean(vertex?.edgeIds.some((id) => engine.board.roads.get(id)?.owner === player));
}

function ownerIncidentCount(engine: GameEngine, vertexId: string, player: PlayerId): number {
  const vertex = engine.board.vertices.get(vertexId);
  if (!vertex) return 0;
  return vertex.edgeIds.filter((id) => engine.board.roads.get(id)?.owner === player).length;
}

function lengthIfBlocked(engine: GameEngine, player: PlayerId, vertexId: string, blocker: PlayerId): number {
  const prev = engine.board.buildings.get(vertexId);
  engine.board.buildings.set(vertexId, { vertexId, owner: blocker, kind: 'settlement' });
  const len = longestRoadLength(engine.board, player);
  if (prev) engine.board.buildings.set(vertexId, prev);
  else engine.board.buildings.delete(vertexId);
  return len;
}

export interface LegalRouteInterruption {
  engine: GameEngine;
  blockVertex: string;
  ownerBefore: PlayerId | null;
  p0LengthBefore: number;
  p1LengthBefore: number;
  p0VpBefore: number;
  p1VpBefore: number;
}

/**
 * Seeded real board: player 0 holds Longest Road, player 1 can legally settle on
 * an existing chain vertex so the route drops below five.
 */
export function arrangeLegalRouteInterruption(seed = 11): LegalRouteInterruption | null {
  const base = startSeededGame(seed, { completeSetup: true });
  base.phase = 'main';
  if (!growOpenLongestRoad(base, 0, 5)) return null;

  const candidates: string[] = [];
  const seen = new Set<string>();
  for (const road of base.board.roads.values()) {
    if (road.owner !== 0) continue;
    const edge = base.board.edges.get(road.edgeId);
    if (!edge) continue;
    for (const vertexId of edge.vertexIds) {
      if (seen.has(vertexId)) continue;
      seen.add(vertexId);
      if (ownerIncidentCount(base, vertexId, 0) < 2) continue;
      if (!verticesDistanceOk(base.board, vertexId)) continue;
      if (lengthIfBlocked(base, 0, vertexId, 1) >= 5) continue;
      candidates.push(vertexId);
    }
  }

  for (const blockVertex of candidates) {
    const engine = startSeededGame(seed, { completeSetup: true });
    engine.phase = 'main';
    if (!growOpenLongestRoad(engine, 0, 5)) continue;
    if (!connectByEmptyPath(engine, 1, blockVertex, 4)) continue;
    engine.currentPlayer = 1;
    engine.phase = 'main';
    stock(engine, 1);
    engine.setBuildMode('settlement');
    if (!legalSettlements(engine.board, 1).includes(blockVertex)) continue;
    if (engine.longestRoadOwner !== 0) continue;

    return {
      engine,
      blockVertex,
      ownerBefore: engine.longestRoadOwner,
      p0LengthBefore: longestRoadLength(engine.board, 0),
      p1LengthBefore: longestRoadLength(engine.board, 1),
      p0VpBefore: engine.players[0].victoryPoints,
      p1VpBefore: engine.players[1].victoryPoints,
    };
  }
  return null;
}
