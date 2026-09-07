import { GameEngine } from './engine';
import type { MapSizeId } from './board';
import { legalSetupRoads, legalSetupSettlements } from './rules';
import type { BoardState, PlayerState, Resource } from './types';
import { BUILD_COSTS, RESOURCES } from './types';

export type BuildKind = 'road' | 'settlement' | 'city';

export interface SeededGameOptions {
  playerCount?: number;
  mapSize?: MapSizeId;
  random?: () => number;
  completeSetup?: boolean;
}

export function startSeededGame(seed: number, options: SeededGameOptions = {}): GameEngine {
  const engine = new GameEngine(seed, options.random);
  engine.startGame(options.playerCount ?? 2, options.mapSize ?? 'standard', seed);
  if (options.completeSetup) completeLegalSetup(engine);
  return engine;
}

/** Place the first legal settlement/road until setup finishes. Idempotent after roll. */
export function completeLegalSetup(engine: GameEngine): void {
  while (engine.phase === 'setupSettlement' || engine.phase === 'setupRoad') {
    if (engine.phase === 'setupSettlement') {
      const verts = legalSetupSettlements(engine.board);
      if (verts.length === 0 || !engine.placeSettlement(verts[0])) return;
    }
    if (engine.phase === 'setupRoad') {
      const settlement = engine.lastSetupSettlement;
      if (!settlement) return;
      const edges = legalSetupRoads(engine.board, engine.currentPlayer, settlement);
      if (edges.length === 0 || !engine.placeRoad(edges[0])) return;
    }
  }
}

export function grantAffordableResources(player: PlayerState, kinds: readonly BuildKind[] = ['road', 'settlement', 'city']): void {
  for (const kind of kinds) {
    const cost = BUILD_COSTS[kind];
    for (const r of RESOURCES) {
      player.resources[r] += cost[r] ?? 0;
    }
  }
}

/** Finish setup and enter main with enough resources for the named builds. */
export function prepareAffordableMain(
  engine: GameEngine,
  kinds: readonly BuildKind[] = ['road', 'settlement', 'city'],
): void {
  completeLegalSetup(engine);
  if (engine.phase === 'roll') {
    engine.phase = 'main';
    engine.message = `${engine.player().name}: trade or build, then end turn.`;
  }
  grantAffordableResources(engine.player(), kinds);
}

export function boardLayoutFingerprint(board: BoardState): string {
  const hexes = [...board.hexes.values()]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((h) => `${h.id}:${h.terrain}:${h.number ?? '-'}`)
    .join(',');
  const harbors = [...board.harbors]
    .map((h) => `${h.edgeId}:${h.type}:${h.ratio}`)
    .sort()
    .join(',');
  return `${board.mapSize}|${board.robberHexId}|${hexes}|${harbors}`;
}

export function fixtureStateFingerprint(engine: GameEngine): string {
  const snap = engine.snapshot();
  const players = snap.players
    .map((p) => {
      const res = RESOURCES.map((r: Resource) => `${r}:${p.resources[r]}`).join(',');
      return `${p.id}:${p.settlements}/${p.cities}/${p.roads}:${res}`;
    })
    .join(';');
  const buildings = [...snap.board.buildings.values()]
    .map((b) => `${b.vertexId}:${b.owner}:${b.kind}`)
    .sort()
    .join(',');
  const roads = [...snap.board.roads.values()]
    .map((r) => `${r.edgeId}:${r.owner}`)
    .sort()
    .join(',');
  const roll = snap.lastRoll ? `${snap.lastRoll[0]}+${snap.lastRoll[1]}` : '-';
  return `${boardLayoutFingerprint(snap.board)}|${snap.phase}|${snap.currentPlayer}|${roll}|${players}|${buildings}|${roads}`;
}

/** Public-engine action sequence for the review debug control. */
export function runDeterministicActionSequence(engine: GameEngine): void {
  completeLegalSetup(engine);
  if (engine.phase === 'roll') engine.rollDice();
  if (engine.phase !== 'main') return;

  grantAffordableResources(engine.player(), ['road', 'city']);
  engine.setBuildMode('road');
  const roadId = engine.snapshot().legalEdges[0];
  if (roadId) engine.placeRoad(roadId);

  engine.setBuildMode('city');
  const cityId = engine.snapshot().legalVertices[0];
  if (cityId) engine.placeCity(cityId);
}
