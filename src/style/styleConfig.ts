export type CloudPuffShape = 'sphere' | 'icosahedron';

export type TimeOfDayModeConfig = 'morning' | 'afternoon' | 'evening' | 'night' | 'cycle';

export type WeatherKind = 'clear' | 'overcast' | 'rain';

export interface StyleConfig {
  // Time of day (game-level atmosphere)
  timeOfDay: TimeOfDayModeConfig;
  /** Seconds for one full day when cycling. */
  dayLengthSec: number;
  /** Seconds to ease when picking a fixed scheme. */
  dayTransitionSec: number;
  /** Environment-State weather — never rebuilds hex meshes. */
  weather: WeatherKind;

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
  /** Near-shore turquoise glow mix (hex edge hug). */
  waterShoreGlow: number;
  /** Large sine colour motion amplitude. */
  waterColorWave: number;

  // Water — sine swell motion
  waterWaveHeight: number;
  waterWaveSpeed: number;
  waterSegments: number;

  // Water — soft wave bands
  waterBandIntensity: number;
  waterBandScale: number;
  waterBandSpeed: number;
  /** Softness of band contours (higher = softer). */
  waterBandSoftness: number;

  // Water — Fresnel / specular
  waterFresnelStrength: number;
  waterFresnelPower: number;
  waterSpecularIntensity: number;
  waterSpecularPower: number;

  // Water — foam
  waterShoreFoam: number;
  waterFoamWidth: number;
  /** Foam breathing amplitude (0 = static). */
  waterFoamPulse: number;
  waterFoamPulseSpeed: number;

  // Water — caustics
  waterCausticIntensity: number;
  waterCausticScale: number;
  waterCausticSpeed: number;

  // Water — Bruno-like reflection + shore ripples
  /** How strongly the mirrored scene shows through (0–1). */
  waterReflectStrength: number;
  /** UV wobble on the reflection. */
  waterReflectDistort: number;
  /** Multi-tap blur radius in UV space. */
  waterReflectBlur: number;
  /** Marching shore ripple frequency (hex SDF). */
  waterRippleFreq: number;
  waterRippleSpeed: number;
  waterRippleIntensity: number;
  /** Sparse irregular drift waves across open water. */
  waterDriftIntensity: number;
  waterDriftScale: number;
  waterDriftSpeed: number;

  // Lighting (craft reference — atmosphere owns live values)
  exposure: number;
  sunIntensity: number;
  hemiIntensity: number;

  // Hex board & props
  hexHoverLift: number;
  productionPulseSec: number;
  productionPulseStrength: number;
  harborBobAmp: number;

  // Motion & feedback
  motionPieceSpawnSec: number;
  motionRoadSpawnSec: number;
  motionUpgradeSec: number;
  motionRobberHopSec: number;
  motionHighlightFade: number;
  motionCameraNudgeSec: number;
  motionCameraNudgeBlend: number;
}

export const DEFAULT_STYLE_CONFIG: StyleConfig = {
  timeOfDay: 'afternoon',
  dayLengthSec: 180,
  dayTransitionSec: 4,
  weather: 'clear',

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

  waterDeepOcean: '#0E2A5C',
  waterOcean: '#164A8C',
  waterLagoon: '#1FA8C8',
  waterShallow: '#3ED8E0',
  waterBeachEdge: '#A8FFF4',
  waterFoam: '#FFFFFF',

  waterShoreWidth: 7.0,
  waterDeepFade: 18,
  waterEdgeSoft: 90,
  waterShoreGlow: 0.18,
  waterColorWave: 0.03,

  waterWaveHeight: 0.035,
  waterWaveSpeed: 0.95,
  waterSegments: 80,

  waterBandIntensity: 0,
  waterBandScale: 0.42,
  waterBandSpeed: 0.22,
  waterBandSoftness: 0.6,

  waterFresnelStrength: 0.1,
  waterFresnelPower: 3.2,
  waterSpecularIntensity: 0.16,
  waterSpecularPower: 18,

  waterShoreFoam: 0.7,
  waterFoamWidth: 0.22,
  waterFoamPulse: 0.15,
  waterFoamPulseSpeed: 0.5,

  waterCausticIntensity: 0.03,
  waterCausticScale: 0.55,
  waterCausticSpeed: 0.3,

  waterReflectStrength: 0.48,
  waterReflectDistort: 0.022,
  waterReflectBlur: 0.018,
  // Open-water drift off by default; shore ripples use Bruno proximity flow
  waterRippleFreq: 0.95,
  waterRippleSpeed: 0.22,
  waterRippleIntensity: 0.75,
  waterDriftIntensity: 0,
  waterDriftScale: 0.16,
  waterDriftSpeed: 0.18,

  exposure: 1.15,
  sunIntensity: 1.45,
  hemiIntensity: 0.95,

  hexHoverLift: 0.045,
  productionPulseSec: 1.15,
  productionPulseStrength: 0.55,
  harborBobAmp: 0.035,

  motionPieceSpawnSec: 0.32,
  motionRoadSpawnSec: 0.26,
  motionUpgradeSec: 0.38,
  motionRobberHopSec: 0.48,
  motionHighlightFade: 8,
  motionCameraNudgeSec: 0.55,
  motionCameraNudgeBlend: 0.55,
};

export type StylePresetId = 'day' | 'sunset' | 'night' | 'cinematic';

export interface StylePreset {
  id: StylePresetId;
  label: string;
  /** Partial overlay on defaults (then merged with current for unspecified). */
  patch: Partial<StyleConfig>;
}

/** Named looks — apply as overlay on current config (time / water / light focus). */
export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'day',
    label: 'Day',
    patch: {
      timeOfDay: 'afternoon',
      waterDeepOcean: '#0E2A5C',
      waterOcean: '#164A8C',
      waterLagoon: '#1FA8C8',
      waterShallow: '#3ED8E0',
      waterBeachEdge: '#A8FFF4',
      waterBandIntensity: 0,
      waterShoreFoam: 0.7,
      waterRippleIntensity: 0.75,
      waterDriftIntensity: 0.4,
      waterCausticIntensity: 0.04,
      exposure: 1.15,
      sunIntensity: 1.45,
      hemiIntensity: 0.95,
    },
  },
  {
    id: 'sunset',
    label: 'Sunset',
    patch: {
      timeOfDay: 'evening',
      waterDeepOcean: '#1A3A68',
      waterOcean: '#2A6A9A',
      waterLagoon: '#3A9BB0',
      waterShallow: '#5EC8D0',
      waterBeachEdge: '#FFD8B8',
      waterBandIntensity: 0,
      waterShoreFoam: 0.7,
      waterRippleIntensity: 0.7,
      waterDriftIntensity: 0.35,
      waterCausticIntensity: 0.03,
      exposure: 1.05,
      sunIntensity: 1.2,
      hemiIntensity: 0.85,
    },
  },
  {
    id: 'night',
    label: 'Night',
    patch: {
      timeOfDay: 'night',
      waterDeepOcean: '#0A1230',
      waterOcean: '#101C42',
      waterLagoon: '#1A2E5A',
      waterShallow: '#243A78',
      waterBeachEdge: '#2EC8E0',
      waterBandIntensity: 0.01,
      waterShoreFoam: 0.8,
      waterShoreGlow: 0.28,
      waterRippleIntensity: 0.75,
      waterDriftIntensity: 0.3,
      waterFresnelStrength: 0.18,
      waterReflectStrength: 0.4,
      exposure: 0.95,
      sunIntensity: 0.7,
      hemiIntensity: 0.55,
    },
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    patch: {
      timeOfDay: 'cycle',
      dayLengthSec: 120,
      waterShoreGlow: 0.26,
      waterColorWave: 0.05,
      waterBandIntensity: 0.03,
      waterBandSoftness: 0.65,
      waterShoreFoam: 0.9,
      waterFoamPulse: 0.22,
      waterRippleIntensity: 0.95,
      waterDriftIntensity: 0.45,
      waterCausticIntensity: 0.05,
      motionPieceSpawnSec: 0.42,
      motionRobberHopSec: 0.58,
      motionCameraNudgeSec: 0.7,
      hexHoverLift: 0.055,
      productionPulseStrength: 0.7,
    },
  },
];

const STORAGE_KEY = 'catan-style-config-v22';

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

export function applyStylePreset(current: StyleConfig, id: StylePresetId): StyleConfig {
  const preset = STYLE_PRESETS.find((p) => p.id === id);
  if (!preset) return current;
  return { ...current, ...preset.patch };
}
