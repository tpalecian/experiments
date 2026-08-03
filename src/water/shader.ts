/**
 * Water colour from distanceToCoast — not from normals.
 * Live GLSL lives in src/render/water.ts; this module is the CPU / craft helper.
 */

import * as THREE from 'three';
import type { DistanceToCoast } from '../terrain/sdf';
import { foamAmount } from './foam';
import { causticMask, waveBand } from './waves';

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
  deepColor: new THREE.Color(0x1fafd4),
  midColor: new THREE.Color(0x37c9d9),
  shallowColor: new THREE.Color(0x62e7e0),
  lagoonColor: new THREE.Color(0x8cf7ec),
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
  const t = Math.max(0, Math.min(1, (d + 20) / 20));
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

export function sampleWaterEffects(
  d: DistanceToCoast,
  time: number,
): { foam: number; band: number; caustic: number } {
  return {
    foam: foamAmount(d),
    band: waveBand(d, 0.42, time, 0.28),
    caustic: causticMask(d),
  };
}

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
