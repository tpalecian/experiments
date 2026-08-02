export type CloudPuffShape = 'sphere' | 'icosahedron';

export interface StyleConfig {
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

  // Sky
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

  // Lighting
  exposure: number;
  sunIntensity: number;
  hemiIntensity: number;
}

export const DEFAULT_STYLE_CONFIG: StyleConfig = {
  cloudCount: 8,
  cloudScale: 7,
  cloudOrbitMin: 14,
  cloudOrbitMax: 24,
  cloudHeightMin: 6,
  cloudHeightMax: 13,
  cloudDriftSpeed: 0.004,
  cloudLit: '#fff5ff',
  cloudShade: '#d4c2ec',
  cloudPuffShape: 'sphere',
  cloudPuffSegments: 7,

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
};

const STORAGE_KEY = 'catan-style-config-v2';

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
