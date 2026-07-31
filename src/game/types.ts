export type Resource = 'wood' | 'brick' | 'sheep' | 'wheat' | 'ore';

export type Terrain = Resource | 'desert';

export type PlayerId = 0 | 1 | 2 | 3;

export type Phase =
  | 'lobby'
  | 'setupSettlement'
  | 'setupRoad'
  | 'roll'
  | 'discard'
  | 'robber'
  | 'steal'
  | 'main'
  | 'gameOver';

export type BuildMode = 'none' | 'road' | 'settlement' | 'city';

export interface Axial {
  q: number;
  r: number;
}

export interface HexTile {
  id: string;
  q: number;
  r: number;
  terrain: Terrain;
  number: number | null;
  vertexIds: string[];
  edgeIds: string[];
}

export interface Vertex {
  id: string;
  x: number;
  z: number;
  hexIds: string[];
  edgeIds: string[];
  harbor: Harbor | null;
}

export interface Edge {
  id: string;
  vertexIds: [string, string];
  hexIds: string[];
  midX: number;
  midZ: number;
  angle: number;
}

export interface Harbor {
  type: 'generic' | Resource;
  ratio: 2 | 3;
  edgeId: string;
}

export interface Building {
  vertexId: string;
  owner: PlayerId;
  kind: 'settlement' | 'city';
}

export interface Road {
  edgeId: string;
  owner: PlayerId;
}

export type ResourceBank = Record<Resource, number>;

export interface PlayerState {
  id: PlayerId;
  name: string;
  color: number;
  resources: ResourceBank;
  settlements: number;
  cities: number;
  roads: number;
  victoryPoints: number;
}

export interface BoardState {
  hexes: Map<string, HexTile>;
  vertices: Map<string, Vertex>;
  edges: Map<string, Edge>;
  buildings: Map<string, Building>;
  roads: Map<string, Road>;
  robberHexId: string;
  harbors: Harbor[];
}

export const RESOURCES: Resource[] = ['wood', 'brick', 'sheep', 'wheat', 'ore'];

export const TERRAIN_COLORS: Record<Terrain, number> = {
  wood: 0x2d6a4f,
  brick: 0xb85c38,
  sheep: 0x8fbf5f,
  wheat: 0xd4a017,
  ore: 0x6b7280,
  desert: 0xc2a878,
};

export const PLAYER_COLORS: number[] = [0xd64545, 0x3b82f6, 0xf0f0f0, 0xf59e0b];

export const PLAYER_NAMES = ['Red', 'Blue', 'White', 'Orange'];

export const BUILD_COSTS: Record<'road' | 'settlement' | 'city', Partial<ResourceBank>> = {
  road: { wood: 1, brick: 1 },
  settlement: { wood: 1, brick: 1, sheep: 1, wheat: 1 },
  city: { wheat: 2, ore: 3 },
};

export const MAX_SETTLEMENTS = 5;
export const MAX_CITIES = 4;
export const MAX_ROADS = 15;
export const WIN_VP = 10;

export function emptyBank(): ResourceBank {
  return { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
}

export function bankTotal(bank: ResourceBank): number {
  return RESOURCES.reduce((sum, r) => sum + bank[r], 0);
}

export function hexId(q: number, r: number): string {
  return `${q},${r}`;
}

export function resourceFromTerrain(terrain: Terrain): Resource | null {
  if (terrain === 'desert') return null;
  return terrain;
}
