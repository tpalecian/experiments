import type { Axial, BoardState, Edge, Harbor, HexTile, MapSizeId, Resource, Terrain, Vertex } from './types';
import { RESOURCES, hexId, resourceFromTerrain } from './types';

/** Circumradius of one land hex. 1.75 gives ~3× floor area vs a unit hex so biome layouts can breathe. */
const HEX_SIZE = 1.75;
const SQRT3 = Math.sqrt(3);

export type { MapSizeId };

export interface MapSizeConfig {
  id: MapSizeId;
  label: string;
  /** Hex rings from center (2 → 19, 3 → 37, 4 → 61). */
  rings: number;
  blurb: string;
  winVp: number;
  maxSettlements: number;
  maxCities: number;
  maxRoads: number;
}

export const MAP_SIZES: Record<MapSizeId, MapSizeConfig> = {
  standard: {
    id: 'standard',
    label: 'Standard',
    rings: 2,
    blurb: '19 hexes — classic island',
    winVp: 10,
    maxSettlements: 5,
    maxCities: 4,
    maxRoads: 15,
  },
  large: {
    id: 'large',
    label: 'Large',
    rings: 3,
    blurb: '37 hexes — room to expand',
    winVp: 12,
    maxSettlements: 7,
    maxCities: 5,
    maxRoads: 22,
  },
  huge: {
    id: 'huge',
    label: 'Huge',
    rings: 4,
    blurb: '61 hexes — epic voyages',
    winVp: 15,
    maxSettlements: 9,
    maxCities: 6,
    maxRoads: 30,
  },
};

export const MAP_SIZE_ORDER: MapSizeId[] = ['standard', 'large', 'huge'];

const HEX_DIRS: Axial[] = [
  { q: 1, r: 0 },
  { q: 0, r: 1 },
  { q: -1, r: 1 },
  { q: -1, r: 0 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
];

/** Classic Catan number frequency weights (no 7). */
const NUMBER_WEIGHTS: Record<number, number> = {
  2: 1,
  3: 2,
  4: 2,
  5: 2,
  6: 2,
  8: 2,
  9: 2,
  10: 2,
  11: 2,
  12: 1,
};

export function hexCountForRings(rings: number): number {
  return 1 + 3 * rings * (rings + 1);
}

export function generateRingCoords(rings: number): Axial[] {
  const coords: Axial[] = [{ q: 0, r: 0 }];
  for (let ring = 1; ring <= rings; ring++) {
    // Start at south neighbor of center, then walk the six sides
    let q = 0;
    let r = -ring;
    for (let dir = 0; dir < 6; dir++) {
      for (let step = 0; step < ring; step++) {
        coords.push({ q, r });
        q += HEX_DIRS[dir].q;
        r += HEX_DIRS[dir].r;
      }
    }
  }
  return coords;
}

/** Approximate classic ratios: wood/sheep/wheat heavy, fewer brick/ore, ~1 desert per 19. */
export function buildTerrainBag(landCount: number, rng: SeededRandom): Terrain[] {
  const desertCount = Math.max(1, Math.round(landCount / 19));
  const productive = landCount - desertCount;

  // Target shares of productive tiles (sum ≈ 1)
  const shares: Record<Resource, number> = {
    wood: 4 / 18,
    brick: 3 / 18,
    sheep: 4 / 18,
    wheat: 4 / 18,
    ore: 3 / 18,
  };

  const counts: Record<Resource, number> = {
    wood: 0,
    brick: 0,
    sheep: 0,
    wheat: 0,
    ore: 0,
  };

  let assigned = 0;
  for (const r of RESOURCES) {
    counts[r] = Math.floor(productive * shares[r]);
    assigned += counts[r];
  }
  // Distribute remainder by largest fractional part
  const frac = RESOURCES.map((r) => ({
    r,
    f: productive * shares[r] - Math.floor(productive * shares[r]),
  })).sort((a, b) => b.f - a.f);
  let rem = productive - assigned;
  for (let i = 0; rem > 0; i++, rem--) {
    counts[frac[i % RESOURCES.length].r] += 1;
  }

  const bag: Terrain[] = [];
  for (let i = 0; i < desertCount; i++) bag.push('desert');
  for (const r of RESOURCES) {
    for (let i = 0; i < counts[r]; i++) bag.push(r);
  }
  while (bag.length < landCount) bag.push(RESOURCES[bag.length % RESOURCES.length]);
  return rng.shuffle(bag).slice(0, landCount);
}

export function buildNumberBag(productiveCount: number, rng: SeededRandom): number[] {
  const bag: number[] = [];
  const numbers = Object.keys(NUMBER_WEIGHTS).map(Number);
  const weightSum = numbers.reduce((s, n) => s + NUMBER_WEIGHTS[n], 0);
  let assigned = 0;
  const counts = new Map<number, number>();
  for (const n of numbers) {
    const c = Math.floor((productiveCount * NUMBER_WEIGHTS[n]) / weightSum);
    counts.set(n, c);
    assigned += c;
  }
  const frac = numbers
    .map((n) => ({
      n,
      f: (productiveCount * NUMBER_WEIGHTS[n]) / weightSum - (counts.get(n) ?? 0),
    }))
    .sort((a, b) => b.f - a.f);
  let rem = productiveCount - assigned;
  for (let i = 0; rem > 0; i++, rem--) {
    const n = frac[i % frac.length].n;
    counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  for (const n of numbers) {
    for (let i = 0; i < (counts.get(n) ?? 0); i++) bag.push(n);
  }
  while (bag.length < productiveCount) {
    bag.push(numbers[bag.length % numbers.length]);
  }
  return rng.shuffle(bag).slice(0, productiveCount);
}

export function axialToWorld(q: number, r: number, size = HEX_SIZE): { x: number; z: number } {
  const x = size * (SQRT3 * q + (SQRT3 / 2) * r);
  const z = size * ((3 / 2) * r);
  return { x, z };
}

export function boardRadiusWorld(rings: number, size = HEX_SIZE): number {
  // Distance from center to outer hex center + hex size
  return size * (SQRT3 * rings) + size;
}

/** Pointy-top island apothem (center → flat) for the outer hex shoreline. */
export function islandHexApothem(rings: number, size = HEX_SIZE): number {
  // Outer hex center along +q, plus one tile apothem (√3/2 * size)
  return size * SQRT3 * (rings + 0.5);
}

function hexCorner(cx: number, cz: number, i: number, size = HEX_SIZE): { x: number; z: number } {
  const angle = (Math.PI / 180) * (60 * i - 30);
  return {
    x: cx + size * Math.cos(angle),
    z: cz + size * Math.sin(angle),
  };
}

function roundKey(x: number, z: number): string {
  return `${x.toFixed(4)},${z.toFixed(4)}`;
}

export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

function neighborsOk(coords: Axial[], numbers: Map<string, number | null>): boolean {
  for (const c of coords) {
    const id = hexId(c.q, c.r);
    const n = numbers.get(id);
    if (n !== 6 && n !== 8) continue;
    for (const d of HEX_DIRS) {
      const other = numbers.get(hexId(c.q + d.q, c.r + d.r));
      if (other === 6 || other === 8) return false;
    }
  }
  return true;
}

function axialDistance(a: Axial, b: Axial): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

/** Outward-facing edge index for a coastal hex (edge with no land neighbor). */
function coastalEdgeDirs(hex: HexTile, hexIds: Set<string>): number[] {
  const dirs: number[] = [];
  for (let i = 0; i < 6; i++) {
    const nq = hex.q + HEX_DIRS[i].q;
    const nr = hex.r + HEX_DIRS[i].r;
    if (!hexIds.has(hexId(nq, nr))) dirs.push(i);
  }
  return dirs;
}

function placeHarbors(
  hexes: Map<string, HexTile>,
  edges: Map<string, Edge>,
  vertices: Map<string, Vertex>,
  rings: number,
  rng: SeededRandom,
): Harbor[] {
  const hexIds = new Set(hexes.keys());
  // Collect candidate coastal edges (unique)
  const candidates: { edgeId: string; angle: number }[] = [];
  const seen = new Set<string>();

  for (const hex of hexes.values()) {
    if (axialDistance(hex, { q: 0, r: 0 }) < rings - 0.1 && rings > 0) {
      // Prefer outer ring for harbors; still allow any coastal for ring 1
    }
    const isOuter = axialDistance(hex, { q: 0, r: 0 }) >= rings - 0.01;
    if (!isOuter && rings >= 2) continue;

    for (const dir of coastalEdgeDirs(hex, hexIds)) {
      const edgeId = hex.edgeIds[dir];
      if (seen.has(edgeId)) continue;
      seen.add(edgeId);
      const e = edges.get(edgeId)!;
      const angle = Math.atan2(e.midZ, e.midX);
      candidates.push({ edgeId, angle });
    }
  }

  candidates.sort((a, b) => a.angle - b.angle);

  // Harbor count: ~9 on standard (19), scale with circumference ≈ 6*rings
  const harborCount = Math.max(5, Math.round(9 * (rings / 2)));
  if (candidates.length === 0) return [];

  const step = candidates.length / harborCount;
  const picked: string[] = [];
  for (let i = 0; i < harborCount; i++) {
    const idx = Math.floor(i * step) % candidates.length;
    const id = candidates[idx].edgeId;
    if (!picked.includes(id)) picked.push(id);
  }

  // Types: mix of generics and one of each resource, extras alternate
  const typeBag: Harbor['type'][] = [
    'generic',
    'wood',
    'generic',
    'brick',
    'generic',
    'sheep',
    'generic',
    'wheat',
    'ore',
  ];
  while (typeBag.length < picked.length) {
    typeBag.push(typeBag.length % 2 === 0 ? 'generic' : RESOURCES[typeBag.length % RESOURCES.length]);
  }
  const types = rng.shuffle(typeBag).slice(0, picked.length);

  const harbors: Harbor[] = [];
  for (let i = 0; i < picked.length; i++) {
    const edgeId = picked[i];
    const type = types[i];
    const harbor: Harbor = {
      type,
      ratio: type === 'generic' ? 3 : 2,
      edgeId,
    };
    harbors.push(harbor);
    const edge = edges.get(edgeId);
    if (edge) {
      for (const vid of edge.vertexIds) {
        const v = vertices.get(vid);
        if (v && !v.harbor) v.harbor = harbor;
      }
    }
  }
  return harbors;
}

export function createBoard(seed = Date.now(), mapSize: MapSizeId = 'standard'): BoardState {
  const config = MAP_SIZES[mapSize];
  const rings = config.rings;
  const landCoords = generateRingCoords(rings);
  const rng = new SeededRandom(seed);

  let terrains = buildTerrainBag(landCoords.length, rng);
  let numbers: Map<string, number | null> = new Map();
  let attempts = 0;

  const placeNumbers = (terrainList: Terrain[]): Map<string, number | null> => {
    const productive = terrainList.filter((t) => t !== 'desert').length;
    const bag = buildNumberBag(productive, rng);
    const map = new Map<string, number | null>();
    let ni = 0;
    for (let i = 0; i < landCoords.length; i++) {
      const id = hexId(landCoords[i].q, landCoords[i].r);
      if (terrainList[i] === 'desert') map.set(id, null);
      else map.set(id, bag[ni++]);
    }
    return map;
  };

  do {
    if (attempts > 0) terrains = buildTerrainBag(landCoords.length, rng);
    numbers = placeNumbers(terrains);
    attempts++;
  } while (!neighborsOk(landCoords, numbers) && attempts < 120);

  const vertices = new Map<string, Vertex>();
  const edges = new Map<string, Edge>();
  const hexes = new Map<string, HexTile>();
  let desertId = '';

  for (let i = 0; i < landCoords.length; i++) {
    const c = landCoords[i];
    const id = hexId(c.q, c.r);
    const { x: cx, z: cz } = axialToWorld(c.q, c.r);
    const terrain = terrains[i];
    const number = numbers.get(id) ?? null;
    if (terrain === 'desert' && !desertId) desertId = id;

    const cornerKeys: string[] = [];
    for (let k = 0; k < 6; k++) {
      const p = hexCorner(cx, cz, k);
      const key = roundKey(p.x, p.z);
      cornerKeys.push(key);
      let v = vertices.get(key);
      if (!v) {
        v = {
          id: key,
          x: p.x,
          z: p.z,
          hexIds: [],
          edgeIds: [],
          harbor: null,
        };
        vertices.set(key, v);
      }
      if (!v.hexIds.includes(id)) v.hexIds.push(id);
    }

    const edgeIds: string[] = [];
    for (let k = 0; k < 6; k++) {
      const a = cornerKeys[k];
      const b = cornerKeys[(k + 1) % 6];
      const edgeKey = [a, b].sort().join('|');
      let e = edges.get(edgeKey);
      if (!e) {
        const va = vertices.get(a)!;
        const vb = vertices.get(b)!;
        const midX = (va.x + vb.x) / 2;
        const midZ = (va.z + vb.z) / 2;
        const angle = Math.atan2(vb.z - va.z, vb.x - va.x);
        e = {
          id: edgeKey,
          vertexIds: [a, b],
          hexIds: [],
          midX,
          midZ,
          angle,
        };
        edges.set(edgeKey, e);
        va.edgeIds.push(edgeKey);
        vb.edgeIds.push(edgeKey);
      }
      if (!e.hexIds.includes(id)) e.hexIds.push(id);
      edgeIds.push(edgeKey);
    }

    hexes.set(id, {
      id,
      q: c.q,
      r: c.r,
      terrain,
      number,
      vertexIds: cornerKeys,
      edgeIds,
    });
  }

  // Prefer desert nearest center for robber start; else first desert
  if (!desertId) {
    for (const h of hexes.values()) {
      if (h.terrain === 'desert') {
        desertId = h.id;
        break;
      }
    }
  }

  const harbors = placeHarbors(hexes, edges, vertices, rings, rng);

  return {
    hexes,
    vertices,
    edges,
    buildings: new Map(),
    roads: new Map(),
    robberHexId: desertId || [...hexes.keys()][0],
    harbors,
    mapSize,
    rings,
  };
}

export function verticesDistanceOk(
  board: BoardState,
  vertexId: string,
  minDistance = 2,
): boolean {
  const start = board.vertices.get(vertexId);
  if (!start) return false;
  if (board.buildings.has(vertexId)) return false;

  const visited = new Set<string>([vertexId]);
  let frontier = [vertexId];
  for (let dist = 0; dist < minDistance - 1; dist++) {
    const next: string[] = [];
    for (const vid of frontier) {
      const v = board.vertices.get(vid)!;
      for (const eid of v.edgeIds) {
        const e = board.edges.get(eid)!;
        for (const n of e.vertexIds) {
          if (visited.has(n)) continue;
          visited.add(n);
          next.push(n);
          if (board.buildings.has(n)) return false;
        }
      }
    }
    frontier = next;
  }
  return true;
}

export function resourceProduced(hex: HexTile): Resource | null {
  return resourceFromTerrain(hex.terrain);
}

export { HEX_SIZE };
