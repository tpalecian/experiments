/**
 * Environment State — day/night/weather rendering only.
 *
 * World data (height, SDF, biomes, meshes, instances) is static.
 * Every frame, island/water/terrain renderers read this object.
 */

import * as THREE from 'three';
import type { AtmosphereSnapshot } from '../render/atmosphere';

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
  waterShallowColor: THREE.Color;
  waterShelfColor: THREE.Color;
  waterFoamColor: THREE.Color;

  waveBandIntensity: number;
  fresnelStrength: number;
  specularIntensity: number;
  shadowStrength: number;
  causticIntensity: number;
  foamBrightness: number;
  beachTint: THREE.Color;
  /** Horizon dissolve into sky. */
  horizonHaze: number;
  skyFresnelColor: THREE.Color;
  waterSunColor: THREE.Color;
}

/** Water depth palettes — shader lerps these by distanceToCoast. */
export interface WaterDepthPalette {
  deep: string;
  ocean: string;
  lagoon: string;
  shallow: string;
  shelf: string;
}

export const WATER_DEPTH_PALETTES: Record<EnvironmentScheme, WaterDepthPalette> = {
  day: {
    deep: '#1FAFD4',
    ocean: '#37C9D9',
    lagoon: '#62E7E0',
    shallow: '#8CF7EC',
    shelf: '#DDFCF8',
  },
  sunset: {
    deep: '#205A8C',
    ocean: '#3A91B8',
    lagoon: '#4FB8C4',
    shallow: '#7EC8C0',
    shelf: '#FFD8B8',
  },
  night: {
    deep: '#0C2340',
    ocean: '#10304F',
    lagoon: '#153B5F',
    shallow: '#1A4A6A',
    shelf: '#294A67',
  },
};

/** Beach albedo tints (geometry unchanged). */
export const BEACH_TINTS: Record<EnvironmentScheme, string> = {
  day: '#F5E6C8',
  sunset: '#E8A050',
  night: '#8A9AAA',
};

export const FRESNEL_STRENGTH: Record<EnvironmentScheme, number> = {
  day: 0.03,
  sunset: 0.1,
  night: 0.2,
};

export const WAVE_BAND_INTENSITY: Record<EnvironmentScheme, number> = {
  day: 1,
  sunset: 0.65,
  night: 0.35,
};

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
  state.waterShallowColor.set(p.shallow);
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
    waterShallowColor: new THREE.Color(),
    waterShelfColor: new THREE.Color(),
    waterFoamColor: new THREE.Color('#ffffff'),
    waveBandIntensity: 1,
    fresnelStrength: 0.03,
    specularIntensity: 0.28,
    shadowStrength: 1,
    causticIntensity: 1,
    foamBrightness: 1,
    beachTint: new THREE.Color(),
    horizonHaze: 0.22,
    skyFresnelColor: new THREE.Color('#62e7e0'),
    waterSunColor: new THREE.Color('#fff6e8'),
  };
  applyWaterPalette(state, scheme);
  return state;
}

/** Optional craft base colours / scalars blended with atmosphere response. */
export interface EnvironmentCraftBases {
  waterDeepOcean: string;
  waterOcean: string;
  waterLagoon: string;
  waterShallow: string;
  waterBeachEdge: string;
  waterFoam: string;
  waterBandIntensity: number;
  waterFresnelStrength: number;
  waterSpecularIntensity: number;
  waterCausticIntensity: number;
  waterShoreFoam: number;
}

/**
 * Map live AtmosphereSnapshot → EnvironmentState (no world regeneration).
 * Craft bases (when provided) are the Look palette; atmosphere multiplies / tints them.
 */
export function environmentFromAtmosphere(
  atm: AtmosphereSnapshot,
  sunDir: THREE.Vector3,
  target: EnvironmentState = createDefaultEnvironmentState(),
  craft?: EnvironmentCraftBases,
): EnvironmentState {
  target.sunDirection.copy(sunDir).normalize();
  target.sunColor.copy(atm.sunColor);
  target.moonDirection.copy(sunDir).multiplyScalar(-1).normalize();
  target.ambientColor.copy(atm.hemiSky);
  target.skyTopColor.copy(atm.skyZenith);
  target.skyHorizonColor.copy(atm.skyHorizon);
  target.fogColor.copy(atm.fogColor);

  const bright = atm.waterBrightness;
  const mix = atm.waterTintMix;
  const tint = atm.waterTint;

  const paint = (out: THREE.Color, hex: string) => {
    out.set(hex).multiplyScalar(bright).lerp(tint, mix);
  };

  if (craft) {
    paint(target.waterDeepColor, craft.waterDeepOcean);
    paint(target.waterOceanColor, craft.waterOcean);
    paint(target.waterLagoonColor, craft.waterLagoon);
    paint(target.waterShallowColor, craft.waterShallow);
    paint(target.waterShelfColor, craft.waterBeachEdge);
    target.waterFoamColor.set(craft.waterFoam);
    target.waveBandIntensity = craft.waterBandIntensity * Math.max(0.35, bright);
    target.fresnelStrength = Math.max(craft.waterFresnelStrength, atm.waterFresnelStrength);
    target.specularIntensity = atm.waterSpecularIntensity;
    target.causticIntensity = craft.waterCausticIntensity * (atm.waterCausticIntensity / 0.08 || 1);
    target.foamBrightness = craft.waterShoreFoam * bright;
  } else {
    target.waterDeepColor.copy(atm.waterTint).multiplyScalar(0.55 * bright);
    target.waterOceanColor.copy(atm.waterTint).multiplyScalar(0.75 * bright);
    target.waterLagoonColor.copy(atm.skyFresnelColor);
    target.waterShallowColor.copy(atm.skyFresnelColor).lerp(atm.skyHorizon, 0.35);
    target.waterShelfColor.copy(atm.skyHorizon);
    target.waterFoamColor.set('#ffffff');
    target.waveBandIntensity = Math.max(0.2, bright) * 0.11;
    target.fresnelStrength = atm.waterFresnelStrength;
    target.specularIntensity = atm.waterSpecularIntensity;
    target.causticIntensity = atm.waterCausticIntensity;
    target.foamBrightness = bright;
  }

  target.shadowStrength = atm.sunIntensity > 0.4 ? 1 : 0.35;
  target.horizonHaze = atm.horizonHaze;
  target.skyFresnelColor.copy(atm.skyFresnelColor);
  target.waterSunColor.copy(atm.waterSunColor);
  // Beach tint: warm ivory by day, cooler toward night (stars as proxy)
  target.beachTint
    .set(BEACH_TINTS.day)
    .lerp(new THREE.Color(BEACH_TINTS.sunset), Math.max(0, 1 - atm.waterBrightness) * 0.65)
    .lerp(new THREE.Color(BEACH_TINTS.night), atm.starsIntensity * 0.85);
  return target;
}
