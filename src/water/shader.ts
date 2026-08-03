/**
 * Water colour from distanceToCoast — not from normals.
 *
 * Deep Ocean → Blue → Turquoise → Lagoon → Mint → Almost White
 */

import * as THREE from 'three';
import type { DistanceToCoast } from '../terrain/sdf';

export interface WaterShaderParams {
  deepColor: THREE.Color;
  midColor: THREE.Color;
  shallowColor: THREE.Color;
  lagoonColor: THREE.Color;
  foamWhite: THREE.Color;
  waveHeight: number;
  waveSpeed: number;
}

export const DEFAULT_WATER_SHADER: WaterShaderParams = {
  deepColor: new THREE.Color(0x0a3a62),
  midColor: new THREE.Color(0x1a7a9e),
  shallowColor: new THREE.Color(0x3ec7b8),
  lagoonColor: new THREE.Color(0x9ee8d0),
  foamWhite: new THREE.Color(0xf2fffb),
  waveHeight: 0.06,
  waveSpeed: 0.85,
};

/**
 * Sample tropical water colour from signed coastline distance (d < 0 = ocean).
 */
export function waterColour(
  d: DistanceToCoast,
  params: WaterShaderParams = DEFAULT_WATER_SHADER,
  target = new THREE.Color(),
): THREE.Color {
  if (d >= 0) {
    return target.copy(params.foamWhite);
  }
  // Map d ∈ [-100, 0] across the tropical gradient.
  const t = Math.max(0, Math.min(1, (d + 100) / 100));
  if (t < 0.35) {
    return target.copy(params.deepColor).lerp(params.midColor, t / 0.35);
  }
  if (t < 0.65) {
    return target.copy(params.midColor).lerp(params.shallowColor, (t - 0.35) / 0.3);
  }
  if (t < 0.9) {
    return target.copy(params.shallowColor).lerp(params.lagoonColor, (t - 0.65) / 0.25);
  }
  return target.copy(params.lagoonColor).lerp(params.foamWhite, (t - 0.9) / 0.1);
}

/**
 * Build a temporary material until GLSL migrates from `src/render/water.ts`.
 */
export function createWaterMaterial(
  params: Partial<WaterShaderParams> = {},
): THREE.MeshStandardMaterial {
  const p = { ...DEFAULT_WATER_SHADER, ...params };
  return new THREE.MeshStandardMaterial({
    color: p.shallowColor,
    transparent: true,
    opacity: 0.85,
    roughness: 0.35,
    metalness: 0.05,
  });
}
