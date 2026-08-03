/**
 * World chunking: terrain, water, trees, rocks, props per chunk.
 */

import * as THREE from 'three';

export type ChunkLayer = 'terrain' | 'water' | 'trees' | 'rocks' | 'props';

export interface ChunkCoord {
  cx: number;
  cz: number;
}

export interface Chunk {
  coord: ChunkCoord;
  root: THREE.Group;
  layers: Record<ChunkLayer, THREE.Group>;
}

export interface WorldChunks {
  chunkSize: number;
  chunks: Map<string, Chunk>;
  root: THREE.Group;
}

function chunkKey(c: ChunkCoord): string {
  return `${c.cx},${c.cz}`;
}

const LAYERS: ChunkLayer[] = ['terrain', 'water', 'trees', 'rocks', 'props'];

export function createWorldChunks(chunkSize = 16): WorldChunks {
  return {
    chunkSize,
    chunks: new Map(),
    root: new THREE.Group(),
  };
}

export function worldToChunk(x: number, z: number, chunkSize: number): ChunkCoord {
  return {
    cx: Math.floor(x / chunkSize),
    cz: Math.floor(z / chunkSize),
  };
}

export function ensureChunk(world: WorldChunks, coord: ChunkCoord): Chunk {
  const key = chunkKey(coord);
  const existing = world.chunks.get(key);
  if (existing) return existing;

  const root = new THREE.Group();
  root.name = `chunk-${key}`;
  root.position.set(
    (coord.cx + 0.5) * world.chunkSize,
    0,
    (coord.cz + 0.5) * world.chunkSize,
  );

  const layers = {} as Record<ChunkLayer, THREE.Group>;
  for (const layer of LAYERS) {
    const g = new THREE.Group();
    g.name = layer;
    root.add(g);
    layers[layer] = g;
  }

  world.root.add(root);
  const chunk: Chunk = { coord, root, layers };
  world.chunks.set(key, chunk);
  return chunk;
}
