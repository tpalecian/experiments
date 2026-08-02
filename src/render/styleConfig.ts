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

  // Water
  waterColor: string;
  waterDeep: string;
  waterFoam: string;
  waterPatternScale: number;
  waterScrollSpeed: number;
  waterFoamSharpness: number;
  waterShoreFoam: number;

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

  waterColor: '#3a9fd4',
  waterDeep: '#2a7eb8',
  waterFoam: '#ffffff',
  waterPatternScale: 0.7,
  waterScrollSpeed: 1.15,
  waterFoamSharpness: 0.045,
  waterShoreFoam: 1.0,

  exposure: 1.15,
  sunIntensity: 1.45,
  hemiIntensity: 0.95,
};

const STORAGE_KEY = 'catan-style-config-v1';

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
