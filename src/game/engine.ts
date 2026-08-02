import { MAP_SIZES, createBoard } from './board';
import type { MapSizeId } from './board';
import {
  addResources,
  canAfford,
  computeVictoryPoints,
  discardCount,
  distributeProduction,
  legalCities,
  legalRoads,
  legalSettlements,
  legalSetupRoads,
  legalSetupSettlements,
  payCost,
  pieceLimits,
  playersAdjacentToHex,
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
  seed: number;

  private listeners = new Set<Listener>();

  constructor(seed = Date.now()) {
    this.seed = seed;
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
    };
  }

  startGame(playerCount: number, mapSize: MapSizeId = this.mapSize, seed = this.seed): void {
    if (playerCount < 2 || playerCount > 4) return;
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
    this.phase = 'setupSettlement';
    const sizeLabel = MAP_SIZES[mapSize].label;
    this.message = `${sizeLabel} map · ${this.player().name}: place your first settlement.`;
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
    if (this.phase === 'main') {
      if (this.buildMode === 'settlement') return legalSettlements(this.board, this.currentPlayer);
      if (this.buildMode === 'city') return legalCities(this.board, this.currentPlayer);
    }
    return [];
  }

  private computeLegalEdges(): string[] {
    if (this.phase === 'setupRoad' && this.lastSetupSettlement) {
      return legalSetupRoads(this.board, this.currentPlayer, this.lastSetupSettlement);
    }
    if (this.phase === 'main' && this.buildMode === 'road') {
      return legalRoads(this.board, this.currentPlayer);
    }
    return [];
  }

  private computeLegalHexes(): string[] {
    if (this.phase !== 'robber') return [];
    return [...this.board.hexes.keys()].filter((id) => id !== this.board.robberHexId);
  }

  placeSettlement(vertexId: string): boolean {
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
      const limits = pieceLimits(this.board);
      if (p.settlements >= limits.maxSettlements) return false;
      if (!canAfford(p, BUILD_COSTS.settlement)) return false;
      if (!legalSettlements(this.board, p.id).includes(vertexId)) return false;
      payCost(p, BUILD_COSTS.settlement);
      this.board.buildings.set(vertexId, {
        vertexId,
        owner: p.id,
        kind: 'settlement',
      });
      p.settlements += 1;
      this.buildMode = 'none';
      this.refreshVp();
      this.checkWin();
      this.message = `${p.name} built a settlement.`;
      this.emit();
      return true;
    }
    return false;
  }

  placeRoad(edgeId: string): boolean {
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
      const limits = pieceLimits(this.board);
      if (p.roads >= limits.maxRoads) return false;
      if (!canAfford(p, BUILD_COSTS.road)) return false;
      if (!legalRoads(this.board, p.id).includes(edgeId)) return false;
      payCost(p, BUILD_COSTS.road);
      this.board.roads.set(edgeId, { edgeId, owner: p.id });
      p.roads += 1;
      this.longestRoadOwner = updateLongestRoad(this.board, this.players, this.longestRoadOwner);
      this.buildMode = 'none';
      this.refreshVp();
      this.checkWin();
      this.message = `${p.name} built a road.`;
      this.emit();
      return true;
    }
    return false;
  }

  placeCity(vertexId: string): boolean {
    if (this.phase !== 'main' || this.buildMode !== 'city') return false;
    const p = this.player();
    const limits = pieceLimits(this.board);
    if (p.cities >= limits.maxCities) return false;
    if (!canAfford(p, BUILD_COSTS.city)) return false;
    if (!legalCities(this.board, p.id).includes(vertexId)) return false;
    payCost(p, BUILD_COSTS.city);
    const b = this.board.buildings.get(vertexId)!;
    b.kind = 'city';
    p.settlements -= 1;
    p.cities += 1;
    this.buildMode = 'none';
    this.refreshVp();
    this.checkWin();
    this.message = `${p.name} upgraded to a city.`;
    this.emit();
    return true;
  }

  private grantInitialResources(vertexId: string): void {
    const v = this.board.vertices.get(vertexId);
    if (!v) return;
    const gain = emptyBank();
    for (const hid of v.hexIds) {
      const hex = this.board.hexes.get(hid)!;
      if (hex.terrain === 'desert') continue;
      gain[hex.terrain] += 1;
    }
    addResources(this.player(), gain);
  }

  private advanceSetup(): void {
    const totalPlacements = this.playerCount * 2;
    this.setupIndex += 1;
    this.lastSetupSettlement = null;

    if (this.setupIndex >= totalPlacements) {
      this.phase = 'roll';
      this.currentPlayer = 0;
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
    const d1 = 1 + Math.floor(Math.random() * 6);
    const d2 = 1 + Math.floor(Math.random() * 6);
    this.lastRoll = [d1, d2];
    const total = d1 + d2;
    this.productionLog = '';

    if (total === 7) {
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

    const gains = distributeProduction(this.board, this.players, total);
    const parts: string[] = [];
    for (const p of this.players) {
      const g = gains.get(p.id)!;
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
    const need = this.discardRemaining.get(playerId);
    if (!need) return false;
    const p = this.players[playerId];
    let total = 0;
    for (const r of RESOURCES) {
      const n = resources[r] ?? 0;
      if (n < 0 || n > p.resources[r]) return false;
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
      (pid) => bankTotal(this.players[pid].resources) > 0,
    );
    if (targets.length === 0) {
      this.phase = 'main';
      this.message = `${this.player().name}: robber moved. Trade or build, then end turn.`;
    } else if (targets.length === 1) {
      this.stealFrom(targets[0]);
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
    if (this.phase !== 'steal' && this.phase !== 'robber') return false;
    if (this.phase === 'steal' && !this.stealTargets.includes(target)) return false;
    const victim = this.players[target];
    const pool: Resource[] = [];
    for (const r of RESOURCES) {
      for (let i = 0; i < victim.resources[r]; i++) pool.push(r);
    }
    if (pool.length === 0) {
      this.phase = 'main';
      this.stealTargets = [];
      this.message = `${this.player().name}: nothing to steal.`;
      this.emit();
      return true;
    }
    const stolen = pool[Math.floor(Math.random() * pool.length)];
    victim.resources[stolen] -= 1;
    this.player().resources[stolen] += 1;
    this.stealTargets = [];
    this.phase = 'main';
    this.message = `${this.player().name} stole ${stolen} from ${victim.name}.`;
    this.emit();
    return true;
  }

  setBuildMode(mode: BuildMode): void {
    if (this.phase !== 'main') return;
    this.buildMode = this.buildMode === mode ? 'none' : mode;
    const labels: Record<BuildMode, string> = {
      none: 'Select an action.',
      road: 'Click a highlighted edge to build a road.',
      settlement: 'Click a highlighted vertex to build a settlement.',
      city: 'Click a settlement to upgrade to a city.',
    };
    this.message = labels[mode];
    this.emit();
  }

  bankTrade(give: Resource, receive: Resource): boolean {
    if (this.phase !== 'main') return false;
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
    this.phase = 'roll';
    this.productionLog = '';
    this.message = `${this.player().name}: roll the dice.`;
    this.emit();
    return true;
  }

  private refreshVp(): void {
    for (const p of this.players) {
      p.victoryPoints = computeVictoryPoints(this.board, p, this.longestRoadOwner);
    }
  }

  private checkWin(): void {
    this.refreshVp();
    const winVp = MAP_SIZES[this.mapSize].winVp;
    for (const p of this.players) {
      if (p.victoryPoints >= winVp) {
        this.winner = p.id;
        this.phase = 'gameOver';
        this.message = `${p.name} wins with ${p.victoryPoints} victory points!`;
        return;
      }
    }
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
