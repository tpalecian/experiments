/**
 * Light world chunking for instance budgets.
 */

export interface ChunkCoord {
  cx: number;
  cz: number;
}

export interface ChunkId {
  key: string;
  coord: ChunkCoord;
}

export function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

export function worldToChunk(x: number, z: number, chunkSize: number): ChunkCoord {
  return {
    cx: Math.floor(x / chunkSize),
    cz: Math.floor(z / chunkSize),
  };
}

export function chunksInRadius(
  origin: ChunkCoord,
  radius: number,
): ChunkId[] {
  const out: ChunkId[] = [];
  for (let dz = -radius; dz <= radius; dz++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dz * dz > radius * radius) continue;
      const cx = origin.cx + dx;
      const cz = origin.cz + dz;
      out.push({ key: chunkKey(cx, cz), coord: { cx, cz } });
    }
  }
  return out;
}
