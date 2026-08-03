export type CloudPuffShape = 'sphere' | 'icosahedron';

export type TimeOfDayModeConfig = 'morning' | 'afternoon' | 'evening' | 'night' | 'cycle';

export interface StyleConfig {
  // Time of day (game-level atmosphere)
  timeOfDay: TimeOfDayModeConfig;
  /** Seconds for one full day when cycling. */
  dayLengthSec: number;
  /** Seconds to ease when picking a fixed scheme. */
  dayTransitionSec: number;

  // Clouds
  cloudCount: number;
  cloudScale: number;
  cloudOrbitMin: number;
  cloudOrbitMax: number;
  cloudHeightMin: number;
  cloudHeightMax: number;
  cloudDriftSpeed: number;
  cloudLit: string;
  cloudShade: string;
  cloudPuffShape: CloudPuffShape;
  cloudPuffSegments: number;

  // Sky (craft / afternoon reference — overridden live by atmosphere)
  skyZenith: string;
  skyHorizon: string;

  // Water — colors
  waterDeepOcean: string;
  waterOcean: string;
  waterLagoon: string;
  waterShallow: string;
  waterBeachEdge: string;
  waterFoam: string;

  // Water — depth / shoreline
  waterShoreWidth: number;
  waterDeepFade: number;
  /** Soft radial fade so the sea disc rim dissolves into the sky. */
  waterEdgeSoft: number;

  // Water — sine swell motion
  waterWaveHeight: number;
  waterWaveSpeed: number;
  waterSegments: number;

  // Water — soft wave bands
  waterBandIntensity: number;
  waterBandScale: number;
  waterBandSpeed: number;

  // Water — Fresnel / specular
  waterFresnelStrength: number;
  waterFresnelPower: number;
  waterSpecularIntensity: number;
  waterSpecularPower: number;

  // Water — foam
  waterShoreFoam: number;
  waterFoamWidth: number;

  // Water — caustics
  waterCausticIntensity: number;
  waterCausticScale: number;
  waterCausticSpeed: number;

  // Lighting (craft reference — atmosphere owns live values)
  exposure: number;
  sunIntensity: number;
  hemiIntensity: number;

  // World / Generation (rebuilds island — Apply)
  islandSeed: number;
  islandRadiusScale: number;
  islandFalloff: number;
  islandWarp: number;
  islandSmoothPasses: number;
  islandResolution: number;
  islandVerticalScale: number;
  islandLargeNoise: number;
  islandSmallNoise: number;
  beachWetEnd: number;
  beachDryEnd: number;
  biomeBlur: number;
  treeDensity: number;
  rockDensity: number;

  // Debug
  showHexOverlay: boolean;
  showSdfOverlay: boolean;
}

export const DEFAULT_STYLE_CONFIG: StyleConfig = {
  timeOfDay: 'afternoon',
  dayLengthSec: 180,
  dayTransitionSec: 4,

  cloudCount: 12,
  cloudScale: 1.45,
  cloudOrbitMin: 11,
  cloudOrbitMax: 26,
  cloudHeightMin: 8,
  cloudHeightMax: 15,
  cloudDriftSpeed: 0.003,
  cloudLit: '#d4dde8',
  cloudShade: '#8496ab',
  cloudPuffShape: 'icosahedron',
  cloudPuffSegments: 5,

  skyZenith: '#4aa8e0',
  skyHorizon: '#d8eef8',

  waterDeepOcean: '#1FAFD4',
  waterOcean: '#37C9D9',
  waterLagoon: '#62E7E0',
  waterShallow: '#8CF7EC',
  waterBeachEdge: '#DDFCF8',
  waterFoam: '#FFFFFF',

  waterShoreWidth: 9.5,
  waterDeepFade: 14,
  waterEdgeSoft: 90,

  waterWaveHeight: 0.14,
  waterWaveSpeed: 1.15,
  waterSegments: 80,

  waterBandIntensity: 0.11,
  waterBandScale: 0.42,
  waterBandSpeed: 0.28,

  waterFresnelStrength: 0.12,
  waterFresnelPower: 3.5,
  waterSpecularIntensity: 0.28,
  waterSpecularPower: 14,

  waterShoreFoam: 0.55,
  waterFoamWidth: 0.55,

  waterCausticIntensity: 0.08,
  waterCausticScale: 0.55,
  waterCausticSpeed: 0.35,

  exposure: 1.15,
  sunIntensity: 1.45,
  hemiIntensity: 0.95,

  islandSeed: 42,
  islandRadiusScale: 1.05,
  islandFalloff: 1.12,
  islandWarp: 0.42,
  islandSmoothPasses: 2,
  islandResolution: 128,
  islandVerticalScale: 0.055,
  islandLargeNoise: 0.22,
  islandSmallNoise: 0.06,
  beachWetEnd: 0.55,
  beachDryEnd: 1.35,
  biomeBlur: 1.4,
  treeDensity: 0.55,
  rockDensity: 0.4,

  showHexOverlay: false,
  showSdfOverlay: false,
};

/** Keys that require regenerating WorldData. */
export const WORLD_REBUILD_KEYS: (keyof StyleConfig)[] = [
  'islandSeed',
  'islandRadiusScale',
  'islandFalloff',
  'islandWarp',
  'islandSmoothPasses',
  'islandResolution',
  'islandVerticalScale',
  'islandLargeNoise',
  'islandSmallNoise',
  'beachWetEnd',
  'beachDryEnd',
  'biomeBlur',
  'treeDensity',
  'rockDensity',
  'showSdfOverlay',
];

const STORAGE_KEY = 'catan-style-config-v6';

export function loadStyleConfig(): StyleConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STYLE_CONFIG };
    const parsed = JSON.parse(raw) as Partial<StyleConfig>;
    return { ...DEFAULT_STYLE_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_STYLE_CONFIG };
  }
}

export function saveStyleConfig(config: StyleConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function resetStyleConfig(): StyleConfig {
  localStorage.removeItem(STORAGE_KEY);
  return { ...DEFAULT_STYLE_CONFIG };
}

export function styleToWorldPartial(config: StyleConfig): {
  island: { seed: number; falloff: number; warp: number; radius?: number };
  smoothPasses: number;
  resolution: number;
  verticalScale: number;
  height: { verticalScale: number; largeNoise: number; smallNoise: number };
  beach: { wetEnd: number; dryEnd: number };
  biomeBlur: number;
  treeDensity: number;
  rockDensity: number;
  showHexOverlay: boolean;
  showSdfOverlay: boolean;
} {
  return {
    island: {
      seed: config.islandSeed,
      falloff: config.islandFalloff,
      warp: config.islandWarp,
    },
    smoothPasses: config.islandSmoothPasses,
    resolution: config.islandResolution,
    verticalScale: config.islandVerticalScale,
    height: {
      verticalScale: config.islandVerticalScale,
      largeNoise: config.islandLargeNoise,
      smallNoise: config.islandSmallNoise,
    },
    beach: {
      wetEnd: config.beachWetEnd,
      dryEnd: config.beachDryEnd,
    },
    biomeBlur: config.biomeBlur,
    treeDensity: config.treeDensity,
    rockDensity: config.rockDensity,
    showHexOverlay: config.showHexOverlay,
    showSdfOverlay: config.showSdfOverlay,
  };
}
