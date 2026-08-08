import * as THREE from 'three';
import type { Terrain } from '../game/types';

/** Cozy stylized fantasy palette — warm, saturated, Nintendo-adjacent. */
export const STYLE = {
  fog: 0xd6e8f2,
  ambientSky: 0xffe6c8,
  ambientGround: 0x7a9a5a,
  sun: 0xfff2d6,
  fill: 0xa8d4e8,
  waterDeep: 0x1fafd4,
  waterShallow: 0x8cf7ec,
  waterFoam: 0xffffff,
  waterMid: 0x37c9d9,
  skyZenith: 0x5eb0e0,
  skyHorizon: 0xffe0b8,
  sunDisc: 0xfff3c0,
  highlight: 0xfff0a0,
  roof: 0x5c3d2e,
  woodTrim: 0x8b5a3c,
  dirt: 0x8b6a42,
} as const;

/** Hand-painted terrain tops. */
export const STYLIZED_TERRAIN: Record<Terrain, number> = {
  wood: 0x3f8f4a,
  brick: 0xd4784a,
  sheep: 0x7bc95a,
  wheat: 0xf0c84a,
  ore: 0x8a92a6,
  desert: 0xe8c988,
};

/** Slightly darker sides for chunky hex blocks. */
export const STYLIZED_TERRAIN_SIDE: Record<Terrain, number> = {
  wood: 0x2f6a38,
  brick: 0xb05e38,
  sheep: 0x5a9a42,
  wheat: 0xc9a030,
  ore: 0x6a7286,
  desert: 0xc9a868,
};

export const STYLIZED_PLAYER: number[] = [0xf04545, 0x4a9fff, 0xfff6e8, 0xffb020];

let toonGradient: THREE.DataTexture | null = null;

/** 4-step toon ramp for MeshToonMaterial. */
export function getToonGradient(): THREE.DataTexture {
  if (toonGradient) return toonGradient;
  const data = new Uint8Array([
    80, 80, 80, 255, 140, 140, 140, 255, 200, 200, 200, 255, 255, 255, 255, 255,
  ]);
  const tex = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  toonGradient = tex;
  return tex;
}

export function toonMat(color: number): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({
    color,
    gradientMap: getToonGradient(),
  });
}

let meadowFloorTex: THREE.CanvasTexture | null = null;
let meadowFloorMat: THREE.MeshToonMaterial | null = null;

/** Tiny seeded PRNG so meadow paint is stable across reloads. */
function meadowRand(seed: { n: number }): number {
  seed.n = (seed.n * 1664525 + 1013904223) >>> 0;
  return seed.n / 0xffffffff;
}

/**
 * Soft miniature meadow floor for pasture hex tops — grass strokes / patches
 * so the green ground reads textured (Classic Enhanced), not flat plastic.
 */
export function getMeadowFloorTexture(): THREE.CanvasTexture {
  if (meadowFloorTex) return meadowFloorTex;

  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const seed = { n: 0x5eed };
  const rnd = () => meadowRand(seed);

  // Base pasture green (matches STYLIZED_TERRAIN.sheep)
  ctx.fillStyle = '#7bc95a';
  ctx.fillRect(0, 0, size, size);

  // Soft large-scale meadow patches — readable “flow” at tabletop distance
  for (let i = 0; i < 28; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 40 + rnd() * 70;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const light = rnd() > 0.45;
    g.addColorStop(0, light ? 'rgba(175, 225, 105, 0.65)' : 'rgba(55, 125, 48, 0.5)');
    g.addColorStop(0.55, light ? 'rgba(155, 210, 95, 0.25)' : 'rgba(70, 140, 55, 0.2)');
    g.addColorStop(1, 'rgba(123, 201, 90, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Soft directional turf strokes (shared wind lean) — not dense noise
  const lean = -0.35;
  for (let i = 0; i < 900; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const len = 8 + rnd() * 14;
    const ang = lean + (rnd() - 0.5) * 0.7;
    const bright = rnd() > 0.5;
    ctx.strokeStyle = bright
      ? `rgba(200, 240, 130, ${0.28 + rnd() * 0.28})`
      : `rgba(45, 110, 40, ${0.22 + rnd() * 0.28})`;
    ctx.lineWidth = 1.5 + rnd() * 1.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.sin(ang) * len, y - Math.cos(ang) * len);
    ctx.stroke();
  }

  // Sparse lighter tip flecks
  for (let i = 0; i < 140; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    ctx.fillStyle = `rgba(230, 255, 175, ${0.3 + rnd() * 0.35})`;
    ctx.beginPath();
    ctx.arc(x, y, 1.2 + rnd() * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  meadowFloorTex = tex;
  return tex;
}

/** Toon material for ExtrudeGeometry lid (materialIndex 1) on pasture hexes. */
export function getMeadowFloorMaterial(): THREE.MeshToonMaterial {
  if (meadowFloorMat) return meadowFloorMat;
  meadowFloorMat = new THREE.MeshToonMaterial({
    map: getMeadowFloorTexture(),
    gradientMap: getToonGradient(),
    color: 0xffffff,
  });
  return meadowFloorMat;
}

export function standardStylized(
  color: number,
  opts?: { flat?: boolean; roughness?: number },
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts?.roughness ?? 0.72,
    metalness: 0.02,
    flatShading: opts?.flat ?? true,
  });
}
