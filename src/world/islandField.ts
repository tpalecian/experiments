/**
 * Hidden-hex island field — organic coast SDF + biome height/colour.
 *
 * Coastline is a union of rounded hex SDFs with a shared domain warp so
 * neighbouring tiles read as one miniature island. Biome influence still
 * follows soft hex weights. GPU water duplicates these constants.
 */
import { HEX_SIZE, axialToWorld, boardRadiusWorld } from '../engine/board';
import type { BoardState, Terrain } from '../engine/types';
import { DIORAMA_TERRAIN, DIORAMA_SAND, DIORAMA_SAND_WET } from '../style/style';

export const COAST_HEX_PAD = 0.18 * HEX_SIZE;
export const COAST_ROUND = 0.36 * HEX_SIZE;
export const COAST_WARP_FREQ = 0.38 / HEX_SIZE;
export const COAST_WARP_AMP = 0.55 * HEX_SIZE;
export const COAST_WARP_FREQ2 = 0.82 / HEX_SIZE;
export const COAST_WARP_AMP2 = 0.14 * HEX_SIZE;
export const BEACH_WIDTH = 0.58 * HEX_SIZE;
export const SHELF_WIDTH = 0.5 * HEX_SIZE;
/** Water discards inland of this (keeps transparent shallows over the shelf). */
export const WATER_INLAND_DISCARD = 0.48 * HEX_SIZE;

const HEX_APOTHEM = HEX_SIZE * Math.sqrt(3) * 0.5;
const TERRAINS: Terrain[] = ['wood', 'brick', 'sheep', 'wheat', 'ore', 'desert'];

export interface LandSite {
  id: string;
  x: number;
  z: number;
  terrain: Terrain;
}

export interface IslandSample {
  shoreDist: number;
  height: number;
  color: { r: number; g: number; b: number };
  terrain: Terrain;
  landMask: number;
  beachMask: number;
}

export interface GroundSampler {
  heightAt(x: number, z: number): number;
}

export function hash21(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function valueNoise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const a = hash21(ix, iz);
  const b = hash21(ix + 1, iz);
  const c = hash21(ix, iz + 1);
  const d = hash21(ix + 1, iz + 1);
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  return a + (b - a) * ux + (c - a) * uz * (1 - ux) + (d - b) * ux * uz;
}

/** Pointy-top hex SDF (matches WaterSurface `sdHexagon` with p.yx swap). */
export function sdHexagon(px: number, pz: number, r: number): number {
  let x = Math.abs(pz);
  let y = Math.abs(px);
  const kx = -0.866025404;
  const ky = 0.5;
  const kz = 0.577350269;
  const m = Math.min(kx * x + ky * y, 0) * 2;
  x -= m * kx;
  y -= m * ky;
  const clampX = Math.max(-kz * r, Math.min(x, kz * r));
  x -= clampX;
  y -= r;
  const len = Math.hypot(x, y);
  return len * Math.sign(y || 1);
}

export function warpCoast(x: number, z: number): { x: number; z: number } {
  const n1 = valueNoise(x * COAST_WARP_FREQ, z * COAST_WARP_FREQ);
  const n2 = valueNoise(x * COAST_WARP_FREQ + 17.2, z * COAST_WARP_FREQ + 9.4);
  const n3 = valueNoise(x * COAST_WARP_FREQ2, z * COAST_WARP_FREQ2);
  const n4 = valueNoise(x * COAST_WARP_FREQ2 + 4.7, z * COAST_WARP_FREQ2 + 11.3);
  return {
    x: x + (n1 - 0.5) * COAST_WARP_AMP + (n3 - 0.5) * COAST_WARP_AMP2,
    z: z + (n2 - 0.5) * COAST_WARP_AMP + (n4 - 0.5) * COAST_WARP_AMP2,
  };
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function hexToRgb(hex: number): { r: number; g: number; b: number } {
  return {
    r: ((hex >> 16) & 255) / 255,
    g: ((hex >> 8) & 255) / 255,
    b: (hex & 255) / 255,
  };
}

const BIOME_RGB: Record<Terrain, { r: number; g: number; b: number }> = {
  wood: hexToRgb(DIORAMA_TERRAIN.wood),
  brick: hexToRgb(DIORAMA_TERRAIN.brick),
  sheep: hexToRgb(DIORAMA_TERRAIN.sheep),
  wheat: hexToRgb(DIORAMA_TERRAIN.wheat),
  ore: hexToRgb(DIORAMA_TERRAIN.ore),
  desert: hexToRgb(DIORAMA_TERRAIN.desert),
};

const SAND = hexToRgb(DIORAMA_SAND);
const SAND_WET = hexToRgb(DIORAMA_SAND_WET);

/** GLSL matching warp + rounded-hex union. Injected into water shaders. */
export function coastShaderChunk(maxHexes: number): string {
  return /* glsl */ `
float sdHexagon(vec2 p, float r) {
  p = abs(p.yx);
  vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}

float coastHash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float coastValueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = coastHash21(i);
  float b = coastHash21(i + vec2(1.0, 0.0));
  float c = coastHash21(i + vec2(0.0, 1.0));
  float d = coastHash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

vec2 warpCoast(vec2 p) {
  float n1 = coastValueNoise(p * ${COAST_WARP_FREQ.toFixed(3)});
  float n2 = coastValueNoise(p * ${COAST_WARP_FREQ.toFixed(3)} + vec2(17.2, 9.4));
  float n3 = coastValueNoise(p * ${COAST_WARP_FREQ2.toFixed(3)});
  float n4 = coastValueNoise(p * ${COAST_WARP_FREQ2.toFixed(3)} + vec2(4.7, 11.3));
  return p + (vec2(n1, n2) - 0.5) * ${COAST_WARP_AMP.toFixed(3)}
           + (vec2(n3, n4) - 0.5) * ${COAST_WARP_AMP2.toFixed(3)};
}

float shoreDistance(vec2 p) {
  vec2 w = warpCoast(p);
  float d = 1e5;
  float r = uHexApothem + ${COAST_HEX_PAD.toFixed(3)};
  float rnd = ${COAST_ROUND.toFixed(3)};
  for (int i = 0; i < ${maxHexes}; i++) {
    float alive = step(float(i), float(uHexCount) - 0.5);
    float hd = sdHexagon(w - uHexCenters[i], max(r - rnd, ${(0.05 * HEX_SIZE).toFixed(3)})) - rnd;
    d = min(d, mix(1e5, hd, alive));
  }
  return d;
}
`;
}

export class IslandField implements GroundSampler {
  readonly sites: LandSite[];
  readonly radius: number;

  constructor(sites: LandSite[], rings: number) {
    this.sites = sites;
    this.radius = boardRadiusWorld(rings) + 1.4 * HEX_SIZE;
  }

  static fromBoard(board: BoardState): IslandField {
    const sites: LandSite[] = [];
    for (const hex of board.hexes.values()) {
      const { x, z } = axialToWorld(hex.q, hex.r);
      sites.push({ id: hex.id, x, z, terrain: hex.terrain });
    }
    return new IslandField(sites, board.rings);
  }

  shoreDistance(x: number, z: number): number {
    const w = warpCoast(x, z);
    const r = HEX_APOTHEM + COAST_HEX_PAD;
    const rnd = COAST_ROUND;
    const minR = 0.05 * HEX_SIZE;
    let d = 1e5;
    for (const site of this.sites) {
      const hd = sdHexagon(w.x - site.x, w.z - site.z, Math.max(r - rnd, minR)) - rnd;
      if (hd < d) d = hd;
    }
    return d;
  }

  heightAt(x: number, z: number): number {
    return this.sample(x, z).height;
  }

  sample(x: number, z: number): IslandSample {
    const shoreDist = this.shoreDistance(x, z);
    const weights = this.biomeWeights(x, z);
    let terrain: Terrain = 'sheep';
    let best = -1;
    for (const t of TERRAINS) {
      if (weights[t] > best) {
        best = weights[t];
        terrain = t;
      }
    }

    let height = 0;
    let cr = 0;
    let cg = 0;
    let cb = 0;
    for (const t of TERRAINS) {
      const w = weights[t];
      if (w <= 0) continue;
      height += w * this.biomeHeight(t, x, z);
      const c = BIOME_RGB[t];
      cr += w * c.r;
      cg += w * c.g;
      cb += w * c.b;
    }

    const ux = x / HEX_SIZE;
    const uz = z / HEX_SIZE;
    const roll = (valueNoise(ux * 0.31, uz * 0.31) - 0.5) * 0.045 * HEX_SIZE;
    height += roll;

    const landMask = smoothstep(0.12 * HEX_SIZE, -0.08 * HEX_SIZE, shoreDist);
    const beachMask =
      smoothstep(BEACH_WIDTH, 0.02 * HEX_SIZE, shoreDist) * smoothstep(-0.12 * HEX_SIZE, 0.08 * HEX_SIZE, shoreDist);
    const shelfMask =
      smoothstep(-SHELF_WIDTH, -0.02 * HEX_SIZE, shoreDist) * smoothstep(0.1 * HEX_SIZE, -0.02 * HEX_SIZE, shoreDist);

    const beachH = HEX_SIZE * (0.042 + valueNoise(ux * 1.1, uz * 1.1) * 0.012);
    const shelfH = HEX_SIZE * -0.055 + shoreDist * 0.04;
    height = height * landMask + beachH * beachMask * (1 - landMask * 0.35);
    if (shelfMask > 0.01 && landMask < 0.5) {
      height = height * (1 - shelfMask) + shelfH * shelfMask;
    }

    const wet = smoothstep(0.18 * HEX_SIZE, -0.08 * HEX_SIZE, shoreDist);
    cr = cr * (1 - beachMask) + (SAND.r * (1 - wet) + SAND_WET.r * wet) * beachMask;
    cg = cg * (1 - beachMask) + (SAND.g * (1 - wet) + SAND_WET.g * wet) * beachMask;
    cb = cb * (1 - beachMask) + (SAND.b * (1 - wet) + SAND_WET.b * wet) * beachMask;
    if (shelfMask > 0.01) {
      cr = cr * (1 - shelfMask) + SAND_WET.r * shelfMask;
      cg = cg * (1 - shelfMask) + SAND_WET.g * shelfMask;
      cb = cb * (1 - shelfMask) + SAND_WET.b * shelfMask;
    }

    const speck = (valueNoise(ux * 2.4, uz * 2.4) - 0.5) * 0.04;
    cr = clamp01(cr + speck);
    cg = clamp01(cg + speck * 0.7);
    cb = clamp01(cb + speck * 0.4);

    return { shoreDist, height, color: { r: cr, g: cg, b: cb }, terrain, landMask, beachMask };
  }

  private biomeWeights(x: number, z: number): Record<Terrain, number> {
    const out: Record<Terrain, number> = {
      wood: 0,
      brick: 0,
      sheep: 0,
      wheat: 0,
      ore: 0,
      desert: 0,
    };
    let sum = 0;
    const pad = HEX_APOTHEM + 0.22 * HEX_SIZE;
    for (const site of this.sites) {
      const d = sdHexagon(x - site.x, z - site.z, pad);
      const w = smoothstep(0.34 * HEX_SIZE, -0.18 * HEX_SIZE, d);
      if (w <= 0) continue;
      out[site.terrain] += w;
      sum += w;
    }
    if (sum <= 1e-6) {
      out.sheep = 1;
      return out;
    }
    for (const t of TERRAINS) out[t] /= sum;
    return out;
  }

  private biomeHeight(terrain: Terrain, x: number, z: number): number {
    const ux = x / HEX_SIZE;
    const uz = z / HEX_SIZE;
    const n = valueNoise(ux * 0.55, uz * 0.55);
    switch (terrain) {
      case 'wood':
        return HEX_SIZE * (0.16 + n * 0.05);
      case 'sheep':
        return HEX_SIZE * (0.2 + Math.sin(ux * 0.9 + uz * 0.55) * 0.045 + n * 0.04);
      case 'wheat': {
        const rows = Math.sin(ux * 4.2 + uz * 0.35) * 0.018;
        return HEX_SIZE * (0.1 + rows + n * 0.02);
      }
      case 'brick': {
        const d = this.nearestDist(x, z, 'brick') / HEX_SIZE;
        const mesa = Math.max(0, 0.32 - d * 0.55);
        const terrace = Math.floor((n + d) * 4) * 0.018;
        return HEX_SIZE * (0.28 + mesa * 0.55 + terrace);
      }
      case 'ore': {
        const d = this.nearestDist(x, z, 'ore') / HEX_SIZE;
        const peak = Math.pow(Math.max(0, 1 - d / 0.72), 1.55) * 1.28;
        const facet = Math.abs(valueNoise(ux * 1.6, uz * 1.6) - 0.5) * 0.22;
        return HEX_SIZE * (0.22 + peak + facet);
      }
      case 'desert': {
        const dunes = Math.sin(ux * 1.7 + uz * 0.4) * 0.055 + Math.sin(uz * 2.1) * 0.03;
        return HEX_SIZE * (0.08 + dunes + n * 0.02);
      }
      default: {
        const _exhaustive: never = terrain;
        return _exhaustive;
      }
    }
  }

  private nearestDist(x: number, z: number, terrain: Terrain): number {
    let best = 1e5;
    for (const site of this.sites) {
      if (site.terrain !== terrain) continue;
      const d = Math.hypot(x - site.x, z - site.z);
      if (d < best) best = d;
    }
    return best;
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
