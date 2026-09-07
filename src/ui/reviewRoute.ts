import type { MapSizeId } from '../engine/board';

export type ReviewLook = 'day' | 'sunset' | 'night';

export interface ReviewParams {
  seed: number;
  map: MapSizeId;
  look: ReviewLook;
}

export const REVIEW_DEFAULTS: ReviewParams = {
  seed: 11,
  map: 'standard',
  look: 'day',
};

export const REVIEW_PLAYER_COUNT = 2;

export function isReviewRoute(search: string = window.location.search): boolean {
  return new URLSearchParams(search).get('view') === 'review';
}

export function parseReviewQuery(search: string): ReviewParams {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return {
    seed: parseSeed(params.get('seed')),
    map: parseMap(params.get('map')),
    look: parseLook(params.get('look')),
  };
}

export function reviewHref(params: Partial<ReviewParams> = {}): string {
  const merged = { ...REVIEW_DEFAULTS, ...params };
  return `?view=review&seed=${merged.seed}&map=${merged.map}&look=${merged.look}`;
}

function parseSeed(raw: string | null): number {
  if (raw === null || raw === '') return REVIEW_DEFAULTS.seed;
  if (!/^-?\d+$/.test(raw)) return REVIEW_DEFAULTS.seed;
  const n = Number(raw);
  if (!Number.isSafeInteger(n)) return REVIEW_DEFAULTS.seed;
  return n;
}

function parseMap(raw: string | null): MapSizeId {
  switch (raw) {
    case 'standard':
    case 'large':
    case 'huge':
      return raw;
    default:
      return REVIEW_DEFAULTS.map;
  }
}

function parseLook(raw: string | null): ReviewLook {
  switch (raw) {
    case 'day':
    case 'sunset':
    case 'night':
      return raw;
    default:
      return REVIEW_DEFAULTS.look;
  }
}
