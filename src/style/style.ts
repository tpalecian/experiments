import * as THREE from 'three';
import type { Terrain } from '../engine/types';

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
  sheep: 0x8fcf4a,
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

/** Sheep-grassland prop / UI palette cues. */
export const MEADOW = {
  base: '#8fcf4a',
  lime: '#b4e35c',
  tan: '#d2b46a',
  bush: '#2f6b32',
  flowerWhite: '#f7f4ec',
  flowerYellow: '#f0d45a',
  stone: '#9aa3aa',
  wool: '#f2efe8',
  face: '#3a3a42',
} as const;

/** Hand-painted seamless meadow map (sheep grassland floor). */
export const MEADOW_FLOOR_URL = '/textures/sheep-grassland.png';

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

let meadowFloorTex: THREE.Texture | null = null;
let meadowFloorMat: THREE.MeshToonMaterial | null = null;

/**
 * Sheep-grassland floor texture — loads the hand-painted seamless meadow map.
 * TextureLoader returns a Texture immediately; the image fills in async.
 */
export function getMeadowFloorTexture(): THREE.Texture {
  if (meadowFloorTex) return meadowFloorTex;

  const tex = new THREE.TextureLoader().load(MEADOW_FLOOR_URL);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  meadowFloorTex = tex;
  return tex;
}

/** Toon material for ExtrudeGeometry lid on pasture hexes. */
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
