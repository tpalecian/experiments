/**
 * Stylized water material — depth, shoreline, swells, bands, caustics, foam, Fresnel.
 * Target home for the GLSL currently living in `src/render/water.ts`.
 */

import * as THREE from 'three';

export interface WaterShaderParams {
  deepColor: THREE.Color;
  shallowColor: THREE.Color;
  waveHeight: number;
  waveSpeed: number;
  foamWidth: number;
  bandStrength: number;
}

export const DEFAULT_WATER_SHADER: WaterShaderParams = {
  deepColor: new THREE.Color(0x0a4a6e),
  shallowColor: new THREE.Color(0x3ec7b8),
  waveHeight: 0.08,
  waveSpeed: 1,
  foamWidth: 0.45,
  bandStrength: 0.35,
};

/**
 * Build a ShaderMaterial driven by island SDF uniforms.
 * Stub: returns a simple transparent plane material until GLSL is migrated.
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
