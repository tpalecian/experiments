/**
 * Palette tables only.
 *
 * Live Environment State is `AtmosphereSnapshot` in `src/world/Atmosphere.ts`.
 * This file holds scheme palettes and scalar tables that Atmosphere imports;
 * it is not a runtime state object. Board meshes never regenerate —
 * see docs/DAY_NIGHT.md.
 */

/** Authoring schemes for palette tables (maps to live DayScheme). */
export type EnvironmentScheme = 'day' | 'sunset' | 'night';

/** Water depth palettes — shader lerps these by distanceToCoast. */
export interface WaterDepthPalette {
  deep: string;
  ocean: string;
  lagoon: string;
  shelf: string;
}

export const WATER_DEPTH_PALETTES: Record<EnvironmentScheme, WaterDepthPalette> = {
  day: {
    deep: '#0E2A5C',
    ocean: '#164A8C',
    lagoon: '#1FA8C8',
    shelf: '#A8FFF4',
  },
  sunset: {
    deep: '#1A3A68',
    ocean: '#2A6A9A',
    lagoon: '#3A9BB0',
    shelf: '#FFD8B8',
  },
  night: {
    deep: '#0A1230',
    ocean: '#101C42',
    lagoon: '#1A2E5A',
    shelf: '#2EC8E0',
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
