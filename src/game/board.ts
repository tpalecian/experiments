import type { Axial, BoardState, Edge, Harbor, HexTile, Resource, Terrain, Vertex } from './types';
import { hexId, resourceFromTerrain } from './types';

const HEX_SIZE = 1;
const SQRT3 = Math.sqrt(3);

/** Standard Catan land hex axial coordinates (pointy-top). */
export const LAND_COORDS: Axial[] = [
  { q: 0, r: 0 },
  { q: 1, r: 0 },
  { q: 0, r: 1 },
  { q: -1, r: 1 },
  { q: -1, r: 0 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
  { q: 2, r: 0 },
  { q: 1, r: 1 },
  { q: 0, r: 2 },
  { q: -1, r: 2 },
  { q: -2, r: 2 },
  { q: -2, r: 1 },
  { q: -2, r: 0 },
  { q: -1, r: -1 },
  { q: 0, r: -2 },
  { q: 1, r: -2 },
  { q: 2, r: -2 },
  { q: 2, r: -1 },
];

const TERRAIN_BAG: Terrain[] = [
  'wood',
  'wood',
  'wood',
  'wood',
  'brick',
  'brick',
  'brick',
  'sheep',
  'sheep',
  'sheep',
  'sheep',
  'wheat',
  'wheat',
  'wheat',
  'wheat',
  'ore',
  'ore',
  'ore',
  'desert',
];

const NUMBER_BAG = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];

/** Coastal harbor edge midpoints expressed as preferred axial pairs (hex, direction index). */
const HARBOR_SPECS: { q: number; r: number; dir: number; type: Harbor['type'] }[] = [
  { q: 0, r: -2, dir: 5, type: 'generic' },
  { q: 1, r: -2, dir: 0, type: 'sheep' },
  { q: 2, r: -1, dir: 0, type: 'generic' },
  { q: 2, r: 0, dir: 1, type: 'ore' },
  { q: 1, r: 1, dir: 1, type: 'generic' },
  { q: 0, r: 2, dir: 2, type: 'wheat' },
  { q: -1, r: 2, dir: 2, type: 'generic' },
  { q: -2, r: 1, dir: 3, type: 'brick' },
  { q: -2, r: 0, dir: 4, type: 'wood' },
];

export function axialToWorld(q: number, r: number, size = HEX_SIZE): { x: number; z: number } {
  const x = size * (SQRT3 * q + (SQRT3 / 2) * r);
  const z = size * ((3 / 2) * r);
  return { x, z };
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

function neighborsOk(hexes: HexTile[], numbers: Map<string, number | null>): boolean {
  const dirs = [
    [1, 0],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [0, -1],
    [1, -1],
  ];
  for (const h of hexes) {
    const n = numbers.get(h.id);
    if (n !== 6 && n !== 8) continue;
    for (const [dq, dr] of dirs) {
      const nid = hexId(h.q + dq, h.r + dr);
      const other = numbers.get(nid);
      if (other === 6 || other === 8) return false;
    }
  }
  return true;
}

export function createBoard(seed = Date.now()): BoardState {
  const rng = new SeededRandom(seed);
  let terrains = rng.shuffle(TERRAIN_BAG);
  let numbers: Map<string, number | null> = new Map();
  let attempts = 0;

  const placeNumbers = (): Map<string, number | null> => {
    const bag = rng.shuffle(NUMBER_BAG);
    const map = new Map<string, number | null>();
    let ni = 0;
    for (let i = 0; i < LAND_COORDS.length; i++) {
      const id = hexId(LAND_COORDS[i].q, LAND_COORDS[i].r);
      if (terrains[i] === 'desert') {
        map.set(id, null);
      } else {
        map.set(id, bag[ni++]);
      }
    }
    return map;
  };

  const tempHexes: HexTile[] = LAND_COORDS.map((c, i) => ({
    id: hexId(c.q, c.r),
    q: c.q,
    r: c.r,
    terrain: terrains[i],
    number: null,
    vertexIds: [],
    edgeIds: [],
  }));

  do {
    if (attempts > 0) {
      terrains = rng.shuffle(TERRAIN_BAG);
      for (let i = 0; i < tempHexes.length; i++) tempHexes[i].terrain = terrains[i];
    }
    numbers = placeNumbers();
    attempts++;
  } while (!neighborsOk(tempHexes, numbers) && attempts < 80);

  const vertices = new Map<string, Vertex>();
  const edges = new Map<string, Edge>();
  const hexes = new Map<string, HexTile>();
  let desertId = '';

  for (let i = 0; i < LAND_COORDS.length; i++) {
    const c = LAND_COORDS[i];
    const id = hexId(c.q, c.r);
    const { x: cx, z: cz } = axialToWorld(c.q, c.r);
    const terrain = terrains[i];
    const number = numbers.get(id) ?? null;
    if (terrain === 'desert') desertId = id;

    const cornerKeys: string[] = [];
    const corners: { x: number; z: number }[] = [];
    for (let k = 0; k < 6; k++) {
      const p = hexCorner(cx, cz, k);
      const key = roundKey(p.x, p.z);
      cornerKeys.push(key);
      corners.push(p);
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

  const harbors: Harbor[] = [];
  for (const spec of HARBOR_SPECS) {
    const hid = hexId(spec.q, spec.r);
    const hex = hexes.get(hid);
    if (!hex) continue;
    const edgeId = hex.edgeIds[spec.dir];
    const harbor: Harbor = {
      type: spec.type,
      ratio: spec.type === 'generic' ? 3 : 2,
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

  return {
    hexes,
    vertices,
    edges,
    buildings: new Map(),
    roads: new Map(),
    robberHexId: desertId || [...hexes.keys()][0],
    harbors,
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
