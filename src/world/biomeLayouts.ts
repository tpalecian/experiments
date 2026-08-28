/**
 * Authored biome decoration layouts — stamped onto hexes at board build time.
 * Edited via ?view=biome-editor; persisted in localStorage.
 */
import * as THREE from 'three';
import { HEX_SIZE } from '../engine/board';
import type { Terrain } from '../engine/types';
import { getAssetById, type AssetCreateOptions } from './assets';

export const BIOME_PROP_KINDS = [
  'tree',
  'pine',
  'sheep',
  'fence',
  'stone-wall',
  'bush',
  'pasture-rock',
  'flower-tuft',
  'wheat',
  'rock',
  'mesa',
  'cactus',
  'barn',
  'windmill',
  'fallen-log',
  'mountain',
  'oasis',
] as const;

export type BiomePropKind = (typeof BIOME_PROP_KINDS)[number];

export const TERRAIN_ORDER: Terrain[] = ['wood', 'brick', 'sheep', 'wheat', 'ore', 'desert'];

export const TERRAIN_LABELS: Record<Terrain, string> = {
  wood: 'Forest',
  brick: 'Quarry',
  sheep: 'Pasture',
  wheat: 'Fields',
  ore: 'Mountains',
  desert: 'Desert',
};

export interface BiomePropInstance {
  id: string;
  kind: BiomePropKind;
  /** Local X relative to hex center. */
  x: number;
  /** Local Z relative to hex center. */
  z: number;
  /** Yaw in radians. */
  yaw: number;
  /** Uniform scale. */
  scale: number;
  /** Optional mesh variant (sheep, walls, bushes, …). */
  variant?: number;
}

export interface BiomeLayout {
  id: string;
  name: string;
  terrain: Terrain;
  props: BiomePropInstance[];
}

export interface BiomeLayoutLibrary {
  version: 1;
  layouts: BiomeLayout[];
}

const STORAGE_KEY = 'catan-biome-layouts-v1';
/** Saved layouts with hypot ≤ this were authored on a unit hex and need HEX_SIZE. */
const LEGACY_UNIT_HEX_MAX = 1.05;
/** Trees/sheep grow less than the floor so groves stay airy on the larger hex. */
const LAYOUT_PROP_SCALE = 1.38;

function seeded(n: number): () => number {
  let s = (n * 16807) % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function uid(prefix: string, rand: () => number): string {
  return `${prefix}-${Math.floor(rand() * 1e9).toString(36)}`;
}

function prop(
  rand: () => number,
  kind: BiomePropKind,
  x: number,
  z: number,
  yaw: number,
  scale: number,
  variant?: number,
): BiomePropInstance {
  const p: BiomePropInstance = { id: uid(kind, rand), kind, x, z, yaw, scale };
  if (variant !== undefined) p.variant = variant;
  return p;
}

/** One authored layout per terrain approximating silhouette-first diorama biomes. */
export function createDefaultLayouts(): BiomeLayout[] {
  const layouts: BiomeLayout[] = [];
  const H = HEX_SIZE;
  const S = LAYOUT_PROP_SCALE;
  const p = (
    rand: () => number,
    kind: BiomePropKind,
    x: number,
    z: number,
    yaw: number,
    scale: number,
    variant?: number,
  ): BiomePropInstance => prop(rand, kind, x * H, z * H, yaw, scale * S, variant);

  // Forest — dense oversized trees filling most of the hex
  {
    const rand = seeded(101);
    const props: BiomePropInstance[] = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rand() * 0.35;
      const d = 0.22 + rand() * 0.52;
      props.push(p(rand, 'tree', Math.cos(a) * d, Math.sin(a) * d, rand() * Math.PI, 0.95 + rand() * 0.55));
    }
    props.push(p(rand, 'fallen-log', 0.18, -0.42, 0.6, 0.95));
    props.push(p(rand, 'rock', -0.48, 0.28, rand() * Math.PI, 0.6));
    props.push(p(rand, 'pine', 0.52, 0.18, 0.3, 0.72));
    layouts.push({ id: 'wood-default', name: 'Grove', terrain: 'wood', props });
  }
  {
    const rand = seeded(102);
    const props: BiomePropInstance[] = [];
    for (let i = 0; i < 11; i++) {
      const a = rand() * Math.PI * 2;
      const d = 0.14 + rand() * 0.58;
      props.push(p(rand, 'tree', Math.cos(a) * d, Math.sin(a) * d, rand() * Math.PI, 0.85 + rand() * 0.6));
    }
    props.push(p(rand, 'pine', -0.52, 0.38, 0.2, 0.75));
    props.push(p(rand, 'fallen-log', -0.16, 0.32, -0.4, 0.85));
    layouts.push({ id: 'wood-dense', name: 'Dense canopy', terrain: 'wood', props });
  }

  // Brick — terraces and clay
  {
    const rand = seeded(201);
    layouts.push({
      id: 'brick-default',
      name: 'Mesa',
      terrain: 'brick',
      props: [
        p(rand, 'mesa', 0.08, -0.06, 0.1, 1.2),
        p(rand, 'rock', 0.48, 0.28, 0.4, 0.75),
        p(rand, 'rock', -0.42, -0.22, 0.8, 0.5),
        p(rand, 'bush', -0.4, 0.34, 0, 0.75, 1),
      ],
    });
  }
  {
    const rand = seeded(202);
    layouts.push({
      id: 'brick-offset',
      name: 'Offset mesa',
      terrain: 'brick',
      props: [
        p(rand, 'mesa', 0.24, -0.16, rand() * 0.4, 1.1),
        p(rand, 'rock', -0.38, 0.32, 1.1, 0.65),
        p(rand, 'rock', 0.46, 0.4, 0.2, 0.5),
      ],
    });
  }

  // Pasture — flock + walls + clutter
  {
    const rand = seeded(301);
    const props: BiomePropInstance[] = [];
    for (let i = 0; i < 7; i++) {
      const a = rand() * Math.PI * 2;
      const d = 0.18 + rand() * 0.52;
      props.push(
        p(rand, 'sheep', Math.cos(a) * d, Math.sin(a) * d, rand() * Math.PI * 2, 0.9 + rand() * 0.28, Math.floor(rand() * 4)),
      );
    }
    for (let e = 0; e < 6; e++) {
      if (rand() > 0.5) continue;
      const a = (e * Math.PI) / 3;
      const d = 0.72;
      props.push(
        p(
          rand,
          'stone-wall',
          Math.cos(a) * d,
          Math.sin(a) * d,
          a + Math.PI * 0.5,
          0.95 + rand() * 0.15,
          rand() > 0.7 ? 1 : rand() > 0.5 ? 2 : 0,
        ),
      );
    }
    for (let i = 0; i < 3; i++) {
      const a = rand() * Math.PI * 2;
      const d = 0.35 + rand() * 0.38;
      props.push(
        p(rand, 'bush', Math.cos(a) * d, Math.sin(a) * d, rand() * Math.PI, 0.85 + rand() * 0.35, Math.floor(rand() * 3)),
      );
    }
    {
      const a = rand() * Math.PI * 2;
      const d = 0.3 + rand() * 0.42;
      props.push(
        p(rand, 'pasture-rock', Math.cos(a) * d, Math.sin(a) * d, rand() * Math.PI, 0.85 + rand() * 0.4, Math.floor(rand() * 4)),
      );
    }
    {
      const a = rand() * Math.PI * 2;
      const d = 0.22 + rand() * 0.48;
      props.push(p(rand, 'flower-tuft', Math.cos(a) * d, Math.sin(a) * d, 0, 1, Math.floor(rand() * 2)));
    }
    layouts.push({ id: 'sheep-default', name: 'Meadow flock', terrain: 'sheep', props });
  }
  {
    const rand = seeded(302);
    const props: BiomePropInstance[] = [];
    for (let i = 0; i < 5; i++) {
      const a = rand() * Math.PI * 2;
      const d = 0.18 + rand() * 0.55;
      props.push(
        p(rand, 'sheep', Math.cos(a) * d, Math.sin(a) * d, rand() * Math.PI * 2, 0.95 + rand() * 0.2, Math.floor(rand() * 4)),
      );
    }
    for (let e = 0; e < 6; e += 2) {
      const a = (e * Math.PI) / 3;
      const d = 0.7;
      props.push(p(rand, 'stone-wall', Math.cos(a) * d, Math.sin(a) * d, a + Math.PI * 0.5, 1, 0));
    }
    props.push(p(rand, 'flower-tuft', 0.32, -0.22, 0, 1.1, 0));
    layouts.push({ id: 'sheep-open', name: 'Open pasture', terrain: 'sheep', props });
  }

  // Wheat — crop rows + barn / mill
  {
    const rand = seeded(401);
    const props: BiomePropInstance[] = [];
    for (let row = -3; row <= 3; row++) {
      for (let col = -2; col <= 2; col++) {
        props.push(p(rand, 'wheat', col * 0.2 + 0.04, row * 0.18, 0.05, 0.95 + rand() * 0.15));
      }
    }
    props.push(p(rand, 'barn', 0.42, 0.48, 0.4, 1.05));
    layouts.push({ id: 'wheat-default', name: 'Field rows', terrain: 'wheat', props });
  }
  {
    const rand = seeded(402);
    const props: BiomePropInstance[] = [];
    for (let i = 0; i < 16; i++) {
      const col = (i % 4) - 1.5;
      const row = Math.floor(i / 4) - 1.5;
      props.push(p(rand, 'wheat', col * 0.26, row * 0.22, rand() * 0.2, 0.9 + rand() * 0.2));
    }
    props.push(p(rand, 'windmill', -0.42, 0.4, 0.2, 1.05));
    layouts.push({ id: 'wheat-lush', name: 'Lush field', terrain: 'wheat', props });
  }

  // Ore — dramatic faceted peaks
  {
    const rand = seeded(501);
    const props: BiomePropInstance[] = [];
    props.push(p(rand, 'mountain', 0.04, -0.06, 0.2, 1.12));
    props.push(p(rand, 'rock', 0.48, 0.28, rand() * Math.PI, 0.9));
    props.push(p(rand, 'rock', -0.42, 0.34, rand() * Math.PI, 0.75));
    props.push(p(rand, 'rock', 0.22, -0.48, rand() * Math.PI, 0.55));
    layouts.push({ id: 'ore-default', name: 'Rock pile', terrain: 'ore', props });
  }
  {
    const rand = seeded(502);
    const props: BiomePropInstance[] = [];
    props.push(p(rand, 'mountain', -0.18, 0.12, 0.5, 1));
    props.push(p(rand, 'mountain', 0.4, -0.26, -0.3, 0.7));
    props.push(p(rand, 'rock', 0.12, 0.5, rand() * Math.PI, 0.7));
    layouts.push({ id: 'ore-craggy', name: 'Craggy ridge', terrain: 'ore', props });
  }

  // Desert — dunes, cactus, oasis
  {
    const rand = seeded(601);
    layouts.push({
      id: 'desert-default',
      name: 'Lone cactus',
      terrain: 'desert',
      props: [
        p(rand, 'cactus', 0.32, -0.18, 0.1, 1.15),
        p(rand, 'cactus', -0.42, 0.28, -0.2, 0.8),
        p(rand, 'cactus', 0.08, 0.48, 0.5, 0.55),
        p(rand, 'rock', 0.16, 0.42, 0.4, 0.5),
      ],
    });
  }
  {
    const rand = seeded(602);
    layouts.push({
      id: 'desert-pair',
      name: 'Oasis',
      terrain: 'desert',
      props: [
        p(rand, 'oasis', 0.06, 0.04, 0, 1.08),
        p(rand, 'cactus', -0.48, 0.32, -0.3, 0.85),
        p(rand, 'cactus', 0.44, -0.3, 0.2, 0.65),
      ],
    });
  }

  return layouts;
}

export function defaultBiomeLibrary(): BiomeLayoutLibrary {
  return { version: 1, layouts: createDefaultLayouts() };
}

function isPropKind(v: unknown): v is BiomePropKind {
  return typeof v === 'string' && (BIOME_PROP_KINDS as readonly string[]).includes(v);
}

function isTerrain(v: unknown): v is Terrain {
  return typeof v === 'string' && (TERRAIN_ORDER as string[]).includes(v);
}

function sanitizeProp(raw: unknown): BiomePropInstance | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (!isPropKind(o.kind)) return null;
  const x = Number(o.x);
  const z = Number(o.z);
  const yaw = Number(o.yaw);
  const scale = Number(o.scale);
  if (![x, z, yaw, scale].every((n) => Number.isFinite(n))) return null;
  const id = typeof o.id === 'string' && o.id ? o.id : `prop-${Math.random().toString(36).slice(2, 9)}`;
  const out: BiomePropInstance = {
    id,
    kind: o.kind,
    x,
    z,
    yaw,
    scale: Math.max(0.05, scale),
  };
  if (o.variant !== undefined && Number.isFinite(Number(o.variant))) {
    out.variant = Math.floor(Number(o.variant));
  }
  return out;
}

function sanitizeLayout(raw: unknown): BiomeLayout | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (!isTerrain(o.terrain)) return null;
  const id = typeof o.id === 'string' && o.id ? o.id : `layout-${Math.random().toString(36).slice(2, 9)}`;
  const name = typeof o.name === 'string' && o.name ? o.name : 'Untitled';
  const propsRaw = Array.isArray(o.props) ? o.props : [];
  const props = propsRaw.map(sanitizeProp).filter((p): p is BiomePropInstance => p !== null);
  return { id, name, terrain: o.terrain, props };
}

export function sanitizeLibrary(raw: unknown): BiomeLayoutLibrary {
  const fallback = defaultBiomeLibrary();
  if (!raw || typeof raw !== 'object') return fallback;
  const o = raw as Record<string, unknown>;
  const layoutsRaw = Array.isArray(o.layouts) ? o.layouts : [];
  const parsed = layoutsRaw.map(sanitizeLayout).filter((l): l is BiomeLayout => l !== null);
  if (parsed.length === 0) return fallback;
  const scaled = scaleLegacyUnitLayouts({ version: 1, layouts: parsed }).layouts;
  for (const t of TERRAIN_ORDER) {
    if (!scaled.some((l) => l.terrain === t)) {
      scaled.push(...fallback.layouts.filter((l) => l.terrain === t));
    }
  }
  return { version: 1, layouts: scaled };
}

/** Per-layout: unit-hex saves (hypot ≤ 1.05) get multiplied into the current HEX_SIZE. */
function scaleLegacyUnitLayouts(lib: BiomeLayoutLibrary): BiomeLayoutLibrary {
  return {
    version: 1,
    layouts: lib.layouts.map((layout) => {
      let maxR = 0;
      for (const p of layout.props) maxR = Math.max(maxR, Math.hypot(p.x, p.z));
      if (maxR <= 0 || maxR > LEGACY_UNIT_HEX_MAX) return layout;
      return {
        ...layout,
        props: layout.props.map((p) => ({ ...p, x: p.x * HEX_SIZE, z: p.z * HEX_SIZE })),
      };
    }),
  };
}

export function loadBiomeLayouts(): BiomeLayoutLibrary {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultBiomeLibrary();
    return sanitizeLibrary(JSON.parse(raw) as unknown);
  } catch {
    return defaultBiomeLibrary();
  }
}

export function saveBiomeLayouts(library: BiomeLayoutLibrary): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
}

export function resetBiomeLayouts(): BiomeLayoutLibrary {
  localStorage.removeItem(STORAGE_KEY);
  return defaultBiomeLibrary();
}

export function exportBiomeLayoutsJson(library: BiomeLayoutLibrary): string {
  return JSON.stringify(library, null, 2);
}

export function importBiomeLayoutsJson(json: string): BiomeLayoutLibrary {
  return sanitizeLibrary(JSON.parse(json) as unknown);
}

export function layoutsForTerrain(library: BiomeLayoutLibrary, terrain: Terrain): BiomeLayout[] {
  return library.layouts.filter((l) => l.terrain === terrain);
}

/** Deterministic layout pick from hex seed string / number. */
export function pickLayout(library: BiomeLayoutLibrary, terrain: Terrain, seed: string | number): BiomeLayout {
  const list = layoutsForTerrain(library, terrain);
  if (list.length === 0) {
    const fallback = createDefaultLayouts().find((l) => l.terrain === terrain);
    if (!fallback) throw new Error(`No biome layout for terrain ${terrain}`);
    return fallback;
  }
  const n =
    typeof seed === 'number'
      ? seed
      : seed.split('').reduce((a, c) => a + c.charCodeAt(0), 1);
  const idx = Math.abs(Math.floor(n * 16807)) % list.length;
  return list[idx]!;
}

export function createEmptyLayout(terrain: Terrain, name = 'New layout'): BiomeLayout {
  return {
    id: `layout-${terrain}-${Date.now().toString(36)}`,
    name,
    terrain,
    props: [],
  };
}

export function createPropInstance(kind: BiomePropKind, x = 0, z = 0): BiomePropInstance {
  return {
    id: `prop-${kind}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`,
    kind,
    x,
    z,
    yaw: 0,
    scale: 1,
  };
}

export function isBiomePropKind(id: string): id is BiomePropKind {
  return (BIOME_PROP_KINDS as readonly string[]).includes(id);
}

/** Prop kinds whose factories honor `opts.scale` (others need Object3D.scale). */
const SCALE_VIA_OPTS: ReadonlySet<BiomePropKind> = new Set([
  'tree',
  'pine',
  'sheep',
  'stone-wall',
  'bush',
  'pasture-rock',
  'flower-tuft',
  'rock',
  'mountain',
  'fallen-log',
]);

/** Instantiate a layout prop as a Three.js object (local xz; preserves factory local y). */
export function createPropObject(instance: BiomePropInstance): THREE.Object3D | null {
  const def = getAssetById(instance.kind);
  if (!def) return null;
  const opts: AssetCreateOptions = { scale: instance.scale };
  if (instance.variant !== undefined) opts.variant = instance.variant;
  const obj = def.create(opts);
  if (!SCALE_VIA_OPTS.has(instance.kind)) {
    obj.scale.setScalar(instance.scale);
  }
  const localY = obj.position.y;
  obj.position.set(instance.x, localY, instance.z);
  obj.rotation.y = instance.yaw;
  obj.userData.biomePropId = instance.id;
  obj.userData.biomePropKind = instance.kind;
  return obj;
}

/** Stamp all props from a layout into a parent group at world hex center (x,z). */
export function stampLayout(
  layout: BiomeLayout,
  parent: THREE.Object3D,
  worldX: number,
  worldY: number,
  worldZ: number,
  heightAt?: (x: number, z: number) => number,
): void {
  for (const instance of layout.props) {
    const obj = createPropObject(instance);
    if (!obj) continue;
    const wx = worldX + instance.x;
    const wz = worldZ + instance.z;
    const wy = heightAt ? heightAt(wx, wz) : worldY;
    obj.position.x += worldX;
    obj.position.y += wy;
    obj.position.z += worldZ;
    parent.add(obj);
  }
}
