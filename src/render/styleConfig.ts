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
  waterShoreGlow: 0.16,
  waterColorWave: 0.05,

  waterWaveHeight: 0.05,
  waterWaveSpeed: 1.15,
  waterSegments: 80,

  waterBandIntensity: 0.02,
  waterBandScale: 0.42,
  waterBandSpeed: 0.28,
  waterBandSoftness: 0.55,

  waterFresnelStrength: 0.12,
  waterFresnelPower: 3.5,
  waterSpecularIntensity: 0.28,
  waterSpecularPower: 14,

  waterShoreFoam: 0.35,
  waterFoamWidth: 0.4,
  waterFoamPulse: 0.22,
  waterFoamPulseSpeed: 0.7,

  waterCausticIntensity: 0.05,
  waterCausticScale: 0.55,
  waterCausticSpeed: 0.35,

  waterReflectStrength: 0.72,
  waterReflectDistort: 0.035,
  waterReflectBlur: 0.01,
  // Sparse blotches (not full rings); open-water drift stays visible
  waterRippleFreq: 0.95,
  waterRippleSpeed: 0.2,
  waterRippleIntensity: 0.62,
  waterDriftIntensity: 0.72,
  waterDriftScale: 0.2,
  waterDriftSpeed: 0.32,

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
      waterDeepOcean: '#1FAFD4',
      waterOcean: '#37C9D9',
      waterLagoon: '#62E7E0',
      waterShallow: '#8CF7EC',
      waterBeachEdge: '#DDFCF8',
      waterBandIntensity: 0.12,
      waterShoreFoam: 0.55,
      waterCausticIntensity: 0.1,
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
      waterDeepOcean: '#205A8C',
      waterOcean: '#3A91B8',
      waterLagoon: '#4FB8C4',
      waterShallow: '#7AD4CF',
      waterBeachEdge: '#FFD8B8',
      waterBandIntensity: 0.08,
      waterShoreFoam: 0.45,
      waterCausticIntensity: 0.06,
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
      waterDeepOcean: '#0C2340',
      waterOcean: '#10304F',
      waterLagoon: '#153B5F',
      waterShallow: '#1A466E',
      waterBeachEdge: '#294A67',
      waterBandIntensity: 0.05,
      waterShoreFoam: 0.35,
      waterCausticIntensity: 0.03,
      waterFresnelStrength: 0.2,
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
      waterShoreGlow: 0.22,
      waterColorWave: 0.07,
      waterBandIntensity: 0.14,
      waterBandSoftness: 0.65,
      waterShoreFoam: 0.7,
      waterFoamPulse: 0.3,
      waterCausticIntensity: 0.12,
      motionPieceSpawnSec: 0.42,
      motionRobberHopSec: 0.58,
      motionCameraNudgeSec: 0.7,
      hexHoverLift: 0.055,
      productionPulseStrength: 0.7,
    },
  },
];

const STORAGE_KEY = 'catan-style-config-v10';

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
