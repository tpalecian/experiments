import { MAP_SIZE_ORDER, MAP_SIZES, createBoard } from './board';
import type { MapSizeId } from './board';
import {
  addResources,
  computeVictoryPoints,
  discardCount,
  legalSetupRoads,
  legalSetupSettlements,
  legalTargets,
  payCost,
  playersAdjacentToHex,
  productionDetails,
  tradeRate,
  updateLongestRoad,
} from './rules';
import type {
  BoardState,
  BuildMode,
  Phase,
  PlayerId,
  PlayerState,
  Resource,
  ResourceBank,
} from './types';
import {
  BUILD_COSTS,
  PLAYER_COLORS,
  PLAYER_NAMES,
  RESOURCES,
  bankTotal,
  emptyBank,
} from './types';

export type Listener = () => void;

export interface EngineSnapshot {
  phase: Phase;
  board: BoardState;
  players: PlayerState[];
  currentPlayer: PlayerId;
  playerCount: number;
  mapSize: MapSizeId;
  buildMode: BuildMode;
  lastRoll: [number, number] | null;
  setupIndex: number;
  setupGoingForward: boolean;
  lastSetupSettlement: string | null;
  discardRemaining: Map<PlayerId, number>;
  stealTargets: PlayerId[];
  longestRoadOwner: PlayerId | null;
  winner: PlayerId | null;
  message: string;
  legalHexes: string[];
  legalVertices: string[];
  legalEdges: string[];
  productionLog: string;
  winVp: number;
  gameId: number;
  rollId: number;
  productionHexIds: string[];
}

export class GameEngine {
  phase: Phase = 'lobby';
  board: BoardState = createBoard(1, 'standard');
  players: PlayerState[] = [];
  currentPlayer: PlayerId = 0;
  playerCount = 0;
  mapSize: MapSizeId = 'standard';
  buildMode: BuildMode = 'none';
  lastRoll: [number, number] | null = null;
  setupIndex = 0;
  setupGoingForward = true;
  lastSetupSettlement: string | null = null;
  discardRemaining = new Map<PlayerId, number>();
  stealTargets: PlayerId[] = [];
  longestRoadOwner: PlayerId | null = null;
  winner: PlayerId | null = null;
  message = 'Choose map size and players to start.';
  productionLog = '';
  gameId = 0;
  rollId = 0;
  productionHexIds: string[] = [];
  seed: number;

  private listeners = new Set<Listener>();
  private readonly random: () => number;

  constructor(seed = Date.now(), random: () => number = () => Math.random()) {
    this.seed = seed;
    this.random = random;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  snapshot(): EngineSnapshot {
    return {
      phase: this.phase,
      board: this.board,
      players: this.players,
      currentPlayer: this.currentPlayer,
      playerCount: this.playerCount,
      mapSize: this.mapSize,
      buildMode: this.buildMode,
      lastRoll: this.lastRoll,
      setupIndex: this.setupIndex,
      setupGoingForward: this.setupGoingForward,
      lastSetupSettlement: this.lastSetupSettlement,
      discardRemaining: this.discardRemaining,
      stealTargets: this.stealTargets,
      longestRoadOwner: this.longestRoadOwner,
      winner: this.winner,
      message: this.message,
      legalHexes: this.computeLegalHexes(),
      legalVertices: this.computeLegalVertices(),
      legalEdges: this.computeLegalEdges(),
      productionLog: this.productionLog,
      winVp: MAP_SIZES[this.mapSize].winVp,
      gameId: this.gameId,
      rollId: this.rollId,
      productionHexIds: [...this.productionHexIds],
    };
  }

  startGame(playerCount: number, mapSize: MapSizeId = this.mapSize, seed = this.seed): void {
    if (!Number.isInteger(playerCount) || playerCount < 2 || playerCount > 4) return;
    if (!isMapSizeId(mapSize)) return;
    if (!Number.isInteger(seed)) return;
    this.seed = seed;
    this.mapSize = mapSize;
    this.board = createBoard(seed, mapSize);
    this.playerCount = playerCount;
    this.players = Array.from({ length: playerCount }, (_, i) => ({
      id: i as PlayerId,
      name: PLAYER_NAMES[i],
      color: PLAYER_COLORS[i],
      resources: emptyBank(),
      settlements: 0,
      cities: 0,
      roads: 0,
      victoryPoints: 0,
    }));
    this.currentPlayer = 0;
    this.setupIndex = 0;
    this.setupGoingForward = true;
    this.lastSetupSettlement = null;
    this.buildMode = 'none';
    this.lastRoll = null;
    this.discardRemaining = new Map();
    this.stealTargets = [];
    this.longestRoadOwner = null;
    this.winner = null;
    this.productionLog = '';
    this.gameId += 1;
    this.rollId = 0;
    this.productionHexIds = [];
    this.phase = 'setupSettlement';
    this.message = `${this.player().name}: place your first settlement.`;
    this.emit();
  }

  resetToLobby(): void {
    this.phase = 'lobby';
    this.winner = null;
    this.buildMode = 'none';
    this.message = 'Choose map size and players to start.';
    this.emit();
  }

  player(id: PlayerId = this.currentPlayer): PlayerState {
    return this.players[id];
  }

  private computeLegalVertices(): string[] {
    if (this.phase === 'setupSettlement') return legalSetupSettlements(this.board);
    if (this.phase === 'main' && (this.buildMode === 'settlement' || this.buildMode === 'city')) {
      return legalTargets(this.board, this.player(), this.buildMode);
    }
    return [];
  }

  private computeLegalEdges(): string[] {
    if (this.phase === 'setupRoad' && this.lastSetupSettlement) {
      return legalSetupRoads(this.board, this.currentPlayer, this.lastSetupSettlement);
    }
    if (this.phase === 'main' && this.buildMode === 'road') {
      return legalTargets(this.board, this.player(), this.buildMode);
    }
    return [];
  }

  private computeLegalHexes(): string[] {
    if (this.phase !== 'robber') return [];
    return [...this.board.hexes.keys()].filter((id) => id !== this.board.robberHexId);
  }

  placeSettlement(vertexId: string): boolean {
    if (!this.board.vertices.has(vertexId)) return false;
    if (this.phase === 'setupSettlement') {
      const legal = legalSetupSettlements(this.board);
      if (!legal.includes(vertexId)) return false;
      this.board.buildings.set(vertexId, {
        vertexId,
        owner: this.currentPlayer,
        kind: 'settlement',
      });
      this.player().settlements += 1;
      this.lastSetupSettlement = vertexId;

      if (!this.setupGoingForward) {
        this.grantInitialResources(vertexId);
      }

      this.refreshVp();
      this.phase = 'setupRoad';
      this.message = `${this.player().name}: place a road touching that settlement.`;
      this.emit();
      return true;
    }

    if (this.phase === 'main' && this.buildMode === 'settlement') {
      const p = this.player();
      if (!legalTargets(this.board, p, 'settlement').includes(vertexId)) return false;
      payCost(p, BUILD_COSTS.settlement);
      this.board.buildings.set(vertexId, {
        vertexId,
        owner: p.id,
        kind: 'settlement',
      });
      p.settlements += 1;
      return this.completeBuild(`${p.name} built a settlement.`);
    }
    return false;
  }

  placeRoad(edgeId: string): boolean {
    if (!this.board.edges.has(edgeId)) return false;
    if (this.phase === 'setupRoad') {
      if (!this.lastSetupSettlement) return false;
      const legal = legalSetupRoads(this.board, this.currentPlayer, this.lastSetupSettlement);
      if (!legal.includes(edgeId)) return false;
      this.board.roads.set(edgeId, { edgeId, owner: this.currentPlayer });
      this.player().roads += 1;
      this.advanceSetup();
      this.emit();
      return true;
    }

    if (this.phase === 'main' && this.buildMode === 'road') {
      const p = this.player();
      if (!legalTargets(this.board, p, 'road').includes(edgeId)) return false;
      payCost(p, BUILD_COSTS.road);
      this.board.roads.set(edgeId, { edgeId, owner: p.id });
      p.roads += 1;
      return this.completeBuild(`${p.name} built a road.`);
    }
    return false;
  }

  placeCity(vertexId: string): boolean {
    if (this.phase !== 'main' || this.buildMode !== 'city') return false;
    if (!this.board.vertices.has(vertexId)) return false;
    const p = this.player();
    if (!legalTargets(this.board, p, 'city').includes(vertexId)) return false;
    const building = this.board.buildings.get(vertexId);
    if (!building) return false;
    payCost(p, BUILD_COSTS.city);
    building.kind = 'city';
    p.settlements -= 1;
    p.cities += 1;
    return this.completeBuild(`${p.name} upgraded to a city.`);
  }

  private grantInitialResources(vertexId: string): void {
    const v = this.board.vertices.get(vertexId);
    if (!v) return;
    const gain = emptyBank();
    for (const hid of v.hexIds) {
      const hex = this.board.hexes.get(hid);
      if (!hex || hex.terrain === 'desert') continue;
      gain[hex.terrain] += 1;
    }
    addResources(this.player(), gain);
  }

  private advanceSetup(): void {
    const totalPlacements = this.playerCount * 2;
    this.setupIndex += 1;
    this.lastSetupSettlement = null;

    if (this.setupIndex >= totalPlacements) {
      this.currentPlayer = 0;
      if (this.checkWin()) return;
      this.phase = 'roll';
      this.message = `${this.player().name}: roll the dice.`;
      return;
    }

    if (this.setupGoingForward) {
      if (this.setupIndex === this.playerCount) {
        this.setupGoingForward = false;
        this.currentPlayer = (this.playerCount - 1) as PlayerId;
      } else {
        this.currentPlayer = (this.currentPlayer + 1) as PlayerId;
      }
    } else {
      this.currentPlayer = (this.currentPlayer - 1) as PlayerId;
    }

    this.phase = 'setupSettlement';
    const round = this.setupGoingForward ? 'first' : 'second';
    this.message = `${this.player().name}: place your ${round} settlement.`;
  }

  rollDice(): boolean {
    if (this.phase !== 'roll') return false;
    const d1 = 1 + Math.floor(this.random() * 6);
    const d2 = 1 + Math.floor(this.random() * 6);
    this.lastRoll = [d1, d2];
    this.rollId += 1;
    const total = d1 + d2;
    this.productionLog = '';

    if (total === 7) {
      this.productionHexIds = [];
      this.discardRemaining = new Map();
      let needDiscard = false;
      for (const p of this.players) {
        const n = discardCount(bankTotal(p.resources));
        if (n > 0) {
          this.discardRemaining.set(p.id, n);
          needDiscard = true;
        }
      }
      if (needDiscard) {
        this.phase = 'discard';
        this.message = `Rolled 7! Players with more than 7 cards must discard.`;
      } else {
        this.phase = 'robber';
        this.message = `${this.player().name}: move the robber.`;
      }
      this.emit();
      return true;
    }

    const details = productionDetails(this.board, this.players, total);
    for (const p of this.players) {
      addResources(p, details.gains.get(p.id)!);
    }
    this.productionHexIds = details.hexIds;
    const parts: string[] = [];
    for (const p of this.players) {
      const g = details.gains.get(p.id)!;
      const got = RESOURCES.filter((r) => g[r] > 0).map((r) => `${g[r]} ${r}`);
      if (got.length) parts.push(`${p.name}: ${got.join(', ')}`);
    }
    this.productionLog = parts.length ? parts.join(' · ') : 'No production.';
    this.phase = 'main';
    this.message = `${this.player().name} rolled ${total}. Trade or build, then end turn.`;
    this.emit();
    return true;
  }

  discard(playerId: PlayerId, resources: Partial<ResourceBank>): boolean {
    if (this.phase !== 'discard') return false;
    if (!this.existingPlayer(playerId)) return false;
    const need = this.discardRemaining.get(playerId);
    if (need === undefined || need <= 0) return false;
    if (!resources || typeof resources !== 'object' || Array.isArray(resources)) return false;
    for (const key of Object.keys(resources)) {
      if (!isResource(key)) return false;
    }
    const p = this.players[playerId];
    let total = 0;
    for (const r of RESOURCES) {
      const n = resources[r] ?? 0;
      if (!Number.isInteger(n) || n < 0 || n > p.resources[r]) return false;
      total += n;
    }
    if (total !== need) return false;
    for (const r of RESOURCES) {
      p.resources[r] -= resources[r] ?? 0;
    }
    this.discardRemaining.delete(playerId);
    if (this.discardRemaining.size === 0) {
      this.phase = 'robber';
      this.message = `${this.player().name}: move the robber.`;
    } else {
      this.message = `Waiting for discards…`;
    }
    this.emit();
    return true;
  }

  moveRobber(hexId: string): boolean {
    if (this.phase !== 'robber') return false;
    if (!this.board.hexes.has(hexId)) return false;
    if (hexId === this.board.robberHexId) return false;
    this.board.robberHexId = hexId;
    const targets = playersAdjacentToHex(this.board, hexId, this.currentPlayer).filter(
      (pid) => this.existingPlayer(pid) && bankTotal(this.players[pid].resources) > 0,
    );
    if (targets.length === 0) {
      this.phase = 'main';
      this.message = `${this.player().name}: robber moved. Trade or build, then end turn.`;
    } else if (targets.length === 1) {
      this.transferStolenCard(targets[0]);
      return true;
    } else {
      this.stealTargets = targets;
      this.phase = 'steal';
      this.message = `${this.player().name}: choose a player to steal from.`;
    }
    this.emit();
    return true;
  }

  stealFrom(target: PlayerId): boolean {
    if (this.phase !== 'steal') return false;
    if (!this.existingPlayer(target)) return false;
    if (target === this.currentPlayer) return false;
    if (!this.stealTargets.includes(target)) return false;
    const victim = this.players[target];
    if (bankTotal(victim.resources) === 0) return false;
    this.transferStolenCard(target);
    return true;
  }

  setBuildMode(mode: BuildMode): void {
    if (this.phase !== 'main') return;
    if (!isBuildMode(mode)) return;
    this.buildMode = this.buildMode === mode ? 'none' : mode;
    const labels: Record<BuildMode, string> = {
      none: 'Select an action.',
      road: 'Click a highlighted edge to build a road.',
      settlement: 'Click a highlighted vertex to build a settlement.',
      city: 'Click a settlement to upgrade to a city.',
    };
    this.message = labels[this.buildMode];
    this.emit();
  }

  bankTrade(give: Resource, receive: Resource): boolean {
    if (this.phase !== 'main') return false;
    if (!isResource(give) || !isResource(receive)) return false;
    if (give === receive) return false;
    const p = this.player();
    const rate = tradeRate(this.board, p.id, give);
    if (p.resources[give] < rate) return false;
    p.resources[give] -= rate;
    p.resources[receive] += 1;
    this.message = `${p.name} traded ${rate} ${give} for 1 ${receive}.`;
    this.emit();
    return true;
  }

  endTurn(): boolean {
    if (this.phase !== 'main') return false;
    this.buildMode = 'none';
    this.currentPlayer = ((this.currentPlayer + 1) % this.playerCount) as PlayerId;
    this.productionLog = '';
    this.productionHexIds = [];
    if (this.checkWin()) {
      this.emit();
      return true;
    }
    this.phase = 'roll';
    this.message = `${this.player().name}: roll the dice.`;
    this.emit();
    return true;
  }

  private completeBuild(message: string): boolean {
    this.buildMode = 'none';
    this.refreshAwardsAndVp();
    if (!this.checkWin()) {
      this.message = message;
    }
    this.emit();
    return true;
  }

  private refreshAwardsAndVp(): void {
    this.longestRoadOwner = updateLongestRoad(this.board, this.players, this.longestRoadOwner);
    this.refreshVp();
  }

  private refreshVp(): void {
    for (const p of this.players) {
      p.victoryPoints = computeVictoryPoints(this.board, p, this.longestRoadOwner);
    }
  }

  private checkWin(): boolean {
    const p = this.player();
    const winVp = MAP_SIZES[this.mapSize].winVp;
    if (p.victoryPoints >= winVp) {
      this.winner = p.id;
      this.phase = 'gameOver';
      this.buildMode = 'none';
      this.message = `${p.name} wins with ${p.victoryPoints} victory points!`;
      return true;
    }
    return false;
  }

  private transferStolenCard(target: PlayerId): void {
    const victim = this.players[target];
    const pool: Resource[] = [];
    for (const r of RESOURCES) {
      for (let i = 0; i < victim.resources[r]; i++) pool.push(r);
    }
    this.stealTargets = [];
    if (pool.length === 0) {
      this.phase = 'main';
      this.message = `${this.player().name}: nothing to steal.`;
      this.emit();
      return;
    }
    const stolen = pool[Math.floor(this.random() * pool.length)];
    victim.resources[stolen] -= 1;
    this.player().resources[stolen] += 1;
    this.phase = 'main';
    this.message = `${this.player().name} stole ${stolen} from ${victim.name}.`;
    this.emit();
  }

  private existingPlayer(id: PlayerId): boolean {
    return Number.isInteger(id) && this.players.some((p) => p.id === id);
  }

  clickVertex(vertexId: string): void {
    if (this.phase === 'setupSettlement' || (this.phase === 'main' && this.buildMode === 'settlement')) {
      this.placeSettlement(vertexId);
      return;
    }
    if (this.phase === 'main' && this.buildMode === 'city') {
      this.placeCity(vertexId);
    }
  }

  clickEdge(edgeId: string): void {
    if (this.phase === 'setupRoad' || (this.phase === 'main' && this.buildMode === 'road')) {
      this.placeRoad(edgeId);
    }
  }

  clickHex(hexId: string): void {
    if (this.phase === 'robber') this.moveRobber(hexId);
  }
}

const BUILD_MODES: readonly BuildMode[] = ['none', 'road', 'settlement', 'city'];

function isMapSizeId(value: string): value is MapSizeId {
  return (MAP_SIZE_ORDER as readonly string[]).includes(value);
}

function isResource(value: string): value is Resource {
  return (RESOURCES as readonly string[]).includes(value);
}

function isBuildMode(value: string): value is BuildMode {
  return (BUILD_MODES as readonly string[]).includes(value);
}
