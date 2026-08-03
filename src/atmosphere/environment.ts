/**
 * Environment State — day/night/weather rendering only.
 *
 * Hex board data (tiles, props, pieces, water mesh, grass) is static.
 * Every frame, renderers read this object; nothing regenerates.
 *
 * Live path: `AtmosphereSnapshot` + `TimeOfDayController` in
 * `src/render/atmosphere.ts` import these palette tables every frame.
 * Board meshes never regenerate — see docs/DAY_NIGHT.md.
 */

import * as THREE from 'three';

/** Authoring schemes for palette tables (maps to live DayScheme). */
export type EnvironmentScheme = 'day' | 'sunset' | 'night';

/**
 * Shared render state. Expand freely for weather — never write world meshes here.
 */
export interface EnvironmentState {
  sunDirection: THREE.Vector3;
  sunColor: THREE.Color;
  moonDirection: THREE.Vector3;

  ambientColor: THREE.Color;

  skyTopColor: THREE.Color;
  skyHorizonColor: THREE.Color;

  fogColor: THREE.Color;

  waterDeepColor: THREE.Color;
  waterOceanColor: THREE.Color;
  waterLagoonColor: THREE.Color;
  waterShelfColor: THREE.Color;

  waveBandIntensity: number;
  fresnelStrength: number;
  shadowStrength: number;
  causticIntensity: number;
  foamBrightness: number;
  beachTint: THREE.Color;
}

/** Water depth palettes — shader lerps these by distanceToCoast. */
export interface WaterDepthPalette {
  deep: string;
  ocean: string;
  lagoon: string;
  shelf: string;
}

export const WATER_DEPTH_PALETTES: Record<EnvironmentScheme, WaterDepthPalette> = {
  day: {
    deep: '#1FAFD4',
    ocean: '#37C9D9',
    lagoon: '#62E7E0',
    shelf: '#DDFCF8',
  },
  sunset: {
    deep: '#205A8C',
    ocean: '#3A91B8',
    lagoon: '#4FB8C4',
    shelf: '#FFD8B8',
  },
  night: {
    deep: '#0C2340',
    ocean: '#10304F',
    lagoon: '#153B5F',
    shelf: '#294A67',
  },
};

/** Beach albedo tints (geometry unchanged). */
export const BEACH_TINTS: Record<EnvironmentScheme, string> = {
  day: '#F5E6C8', // warm ivory
  sunset: '#E8A050', // golden orange
  night: '#8A9AAA', // cool grey
};

/** Fresnel strength guides (morning/midday ≈ day). */
export const FRESNEL_STRENGTH: Record<EnvironmentScheme, number> = {
  day: 0.03,
  sunset: 0.1,
  night: 0.2,
};

/** Wave-band opacity multipliers. */
export const WAVE_BAND_INTENSITY: Record<EnvironmentScheme, number> = {
  day: 1,
  sunset: 0.65,
  night: 0.35,
};

/** Caustic intensity multipliers (placement still from SDF). */
export const CAUSTIC_INTENSITY: Record<EnvironmentScheme, number> = {
  day: 1,
  sunset: 0.7,
  night: 0.3,
};

export function applyWaterPalette(
  state: EnvironmentState,
  scheme: EnvironmentScheme,
): void {
  const p = WATER_DEPTH_PALETTES[scheme];
  state.waterDeepColor.set(p.deep);
  state.waterOceanColor.set(p.ocean);
  state.waterLagoonColor.set(p.lagoon);
  state.waterShelfColor.set(p.shelf);
  state.fresnelStrength = FRESNEL_STRENGTH[scheme];
  state.waveBandIntensity = WAVE_BAND_INTENSITY[scheme];
  state.causticIntensity = CAUSTIC_INTENSITY[scheme];
  state.beachTint.set(BEACH_TINTS[scheme]);
  state.foamBrightness = scheme === 'night' ? 0.55 : scheme === 'sunset' ? 0.75 : 1;
}

export function createDefaultEnvironmentState(
  scheme: EnvironmentScheme = 'day',
): EnvironmentState {
  const state: EnvironmentState = {
    sunDirection: new THREE.Vector3(0.4, 0.85, 0.3).normalize(),
    sunColor: new THREE.Color('#fff2d6'),
    moonDirection: new THREE.Vector3(-0.3, 0.6, -0.5).normalize(),
    ambientColor: new THREE.Color('#ffe6c8'),
    skyTopColor: new THREE.Color('#4aa8e0'),
    skyHorizonColor: new THREE.Color('#d8eef8'),
    fogColor: new THREE.Color('#d6e8f2'),
    waterDeepColor: new THREE.Color(),
    waterOceanColor: new THREE.Color(),
    waterLagoonColor: new THREE.Color(),
    waterShelfColor: new THREE.Color(),
    waveBandIntensity: 1,
    fresnelStrength: 0.03,
    shadowStrength: 1,
    causticIntensity: 1,
    foamBrightness: 1,
    beachTint: new THREE.Color(),
  };
  applyWaterPalette(state, scheme);
  return state;
}
