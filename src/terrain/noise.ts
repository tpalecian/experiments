/**
 * Low-frequency value / simplex-ish noise for island silhouette.
 * Never use high-frequency noise on the coastline.
 */

/** Mulberry32 — deterministic [0,1). */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function grad2(hash: number, x: number, y: number): number {
  const h = hash & 3;
  const u = h < 2 ? x : y;
  const v = h < 2 ? y : x;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

/** Build a 256-entry perm table from seed. */
export function makePerm(seed: number): Uint8Array {
  const p = new Uint8Array(512);
  const src = new Uint8Array(256);
  for (let i = 0; i < 256; i++) src[i] = i;
  const rng = mulberry32(seed);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = src[i]!;
    src[i] = src[j]!;
    src[j] = tmp;
  }
  for (let i = 0; i < 512; i++) p[i] = src[i & 255]!;
  return p;
}

/** Classic Perlin noise in 2D, range roughly [-1, 1]. */
export function perlin2(perm: Uint8Array, x: number, y: number): number {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const u = fade(xf);
  const v = fade(yf);
  const aa = perm[X + perm[Y]!]!;
  const ab = perm[X + perm[Y + 1]!]!;
  const ba = perm[X + 1 + perm[Y]!]!;
  const bb = perm[X + 1 + perm[Y + 1]!]!;
  const x1 = lerp(grad2(aa, xf, yf), grad2(ba, xf - 1, yf), u);
  const x2 = lerp(grad2(ab, xf, yf - 1), grad2(bb, xf - 1, yf - 1), u);
  return lerp(x1, x2, v);
}

/** 2–3 octave FBM at low frequency only. */
export function fbm2(
  perm: Uint8Array,
  x: number,
  y: number,
  octaves = 3,
  lacunarity = 2,
  gain = 0.5,
): number {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * perlin2(perm, x * freq, y * freq);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / Math.max(norm, 1e-6);
}
