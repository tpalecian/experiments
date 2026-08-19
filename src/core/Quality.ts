/** GPU/quality caps (folio Quality) — `?quality=low|medium|high` overrides. */

export type QualityLevel = 'low' | 'medium' | 'high';

export interface QualityCaps {
  pixelRatioMax: number;
  shadowMap: number;
  waterSegments: number;
  reflectionSize: number;
}

let cached: QualityLevel | null = null;

export function getQualityLevel(): QualityLevel {
  if (cached) return cached;
  if (typeof window === 'undefined') {
    cached = 'high';
    return cached;
  }
  const q = new URLSearchParams(window.location.search).get('quality');
  if (q === 'low' || q === 'medium' || q === 'high') {
    cached = q;
    return cached;
  }
  const cores = navigator.hardwareConcurrency ?? 4;
  const dpr = window.devicePixelRatio || 1;
  cached = cores <= 4 || dpr >= 3 ? 'medium' : 'high';
  return cached;
}

export function getQualityCaps(): QualityCaps {
  const level = getQualityLevel();
  switch (level) {
    case 'low':
      return { pixelRatioMax: 1, shadowMap: 512, waterSegments: 24, reflectionSize: 256 };
    case 'medium':
      return { pixelRatioMax: 1.5, shadowMap: 1024, waterSegments: 48, reflectionSize: 512 };
    case 'high':
      return { pixelRatioMax: 2, shadowMap: 2048, waterSegments: 128, reflectionSize: 768 };
    default: {
      const _exhaustive: never = level;
      return _exhaustive;
    }
  }
}

export function capWaterSegments(requested: number): number {
  return Math.min(Math.max(16, Math.round(requested)), getQualityCaps().waterSegments);
}
