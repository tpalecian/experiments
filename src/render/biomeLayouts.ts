/**
 * Authored biome decoration layouts — stamped onto hexes at board build time.
 * Edited via ?view=biome-editor; persisted in localStorage.
 */
import * as THREE from 'three';
import type { Terrain } from '../game/types';
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

/** One authored layout per terrain approximating the former procedural scatter. */
export function createDefaultLayouts(): BiomeLayout[] {
  const layouts: BiomeLayout[] = [];

  // Forest — 3 trees
  {
    const rand = seeded(101);
    const props: BiomePropInstance[] = [];
    for (let i = 0; i < 3; i++) {
      const a = rand() * Math.PI * 2;
      const d = 0.25 + rand() * 0.4;
      props.push(prop(rand, 'tree', Math.cos(a) * d, Math.sin(a) * d, rand() * Math.PI, 0.7 + rand() * 0.4));
    }
    layouts.push({ id: 'wood-default', name: 'Grove', terrain: 'wood', props });
  }
  {
    const rand = seeded(102);
    const props: BiomePropInstance[] = [];
    for (let i = 0; i < 4; i++) {
      const a = rand() * Math.PI * 2;
      const d = 0.2 + rand() * 0.45;
      props.push(prop(rand, 'tree', Math.cos(a) * d, Math.sin(a) * d, rand() * Math.PI, 0.65 + rand() * 0.45));
    }
    layouts.push({ id: 'wood-dense', name: 'Dense canopy', terrain: 'wood', props });
  }

  // Hills — mesa
  {
    const rand = seeded(201);
    layouts.push({
      id: 'brick-default',
      name: 'Mesa',
      terrain: 'brick',
      props: [prop(rand, 'mesa', (rand() - 0.5) * 0.3, (rand() - 0.5) * 0.3, 0, 1)],
    });
  }
  {
    const rand = seeded(202);
    layouts.push({
      id: 'brick-offset',
      name: 'Offset mesa',
      terrain: 'brick',
      props: [prop(rand, 'mesa', 0.22, -0.12, rand() * 0.4, 1.05)],
    });
  }

  // Pasture — flock + walls + clutter
  {
    const rand = seeded(301);
    const props: BiomePropInstance[] = [];
    for (let i = 0; i < 5; i++) {
      const a = rand() * Math.PI * 2;
      const d = 0.22 + rand() * 0.4;
      props.push(
        prop(rand, 'sheep', Math.cos(a) * d, Math.sin(a) * d, rand() * Math.PI * 2, 0.9 + rand() * 0.28, Math.floor(rand() * 4)),
      );
    }
    for (let e = 0; e < 6; e++) {
      if (rand() > 0.62) continue;
      const a = (e * Math.PI) / 3;
      const d = 0.72;
      props.push(
        prop(
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
    for (let i = 0; i < 2; i++) {
      const a = rand() * Math.PI * 2;
      const d = 0.35 + rand() * 0.38;
      props.push(
        prop(rand, 'bush', Math.cos(a) * d, Math.sin(a) * d, rand() * Math.PI, 0.85 + rand() * 0.35, Math.floor(rand() * 3)),
      );
    }
    {
      const a = rand() * Math.PI * 2;
      const d = 0.3 + rand() * 0.4;
      props.push(
        prop(rand, 'pasture-rock', Math.cos(a) * d, Math.sin(a) * d, rand() * Math.PI, 0.85 + rand() * 0.4, Math.floor(rand() * 4)),
      );
    }
    {
      const a = rand() * Math.PI * 2;
      const d = 0.25 + rand() * 0.4;
      props.push(prop(rand, 'flower-tuft', Math.cos(a) * d, Math.sin(a) * d, 0, 1, Math.floor(rand() * 2)));
    }
    {
      const a = rand() * Math.PI * 2;
      const d = 0.42 + rand() * 0.28;
      props.push(prop(rand, 'pine', Math.cos(a) * d, Math.sin(a) * d, rand() * Math.PI, 0.55 + rand() * 0.25));
    }
    layouts.push({ id: 'sheep-default', name: 'Meadow flock', terrain: 'sheep', props });
  }
  {
    const rand = seeded(302);
    const props: BiomePropInstance[] = [];
    for (let i = 0; i < 4; i++) {
      const a = rand() * Math.PI * 2;
      const d = 0.2 + rand() * 0.45;
      props.push(
        prop(rand, 'sheep', Math.cos(a) * d, Math.sin(a) * d, rand() * Math.PI * 2, 0.95 + rand() * 0.2, Math.floor(rand() * 4)),
      );
    }
    for (let e = 0; e < 6; e += 2) {
      const a = (e * Math.PI) / 3;
      const d = 0.7;
      props.push(prop(rand, 'stone-wall', Math.cos(a) * d, Math.sin(a) * d, a + Math.PI * 0.5, 1, 0));
    }
    layouts.push({ id: 'sheep-open', name: 'Open pasture', terrain: 'sheep', props });
  }

  // Wheat — stalks
  {
    const rand = seeded(401);
    const props: BiomePropInstance[] = [];
    for (let i = 0; i < 5; i++) {
      const a = rand() * Math.PI * 2;
      const d = 0.2 + rand() * 0.45;
      props.push(prop(rand, 'wheat', Math.cos(a) * d, Math.sin(a) * d, 0, 1));
    }
    layouts.push({ id: 'wheat-default', name: 'Field rows', terrain: 'wheat', props });
  }
  {
    const rand = seeded(402);
    const props: BiomePropInstance[] = [];
    for (let i = 0; i < 7; i++) {
      const a = rand() * Math.PI * 2;
      const d = 0.15 + rand() * 0.5;
      props.push(prop(rand, 'wheat', Math.cos(a) * d, Math.sin(a) * d, rand() * 0.3, 0.9 + rand() * 0.2));
    }
    layouts.push({ id: 'wheat-lush', name: 'Lush field', terrain: 'wheat', props });
  }

  // Ore — rocks
  {
    const rand = seeded(501);
    const props: BiomePropInstance[] = [];
    for (let i = 0; i < 3; i++) {
      const a = rand() * Math.PI * 2;
      const d = 0.2 + rand() * 0.4;
      props.push(prop(rand, 'rock', Math.cos(a) * d, Math.sin(a) * d, rand() * Math.PI, 0.85 + rand() * 0.7));
    }
    layouts.push({ id: 'ore-default', name: 'Rock pile', terrain: 'ore', props });
  }
  {
    const rand = seeded(502);
    const props: BiomePropInstance[] = [];
    for (let i = 0; i < 4; i++) {
      const a = rand() * Math.PI * 2;
      const d = 0.18 + rand() * 0.42;
      props.push(prop(rand, 'rock', Math.cos(a) * d, Math.sin(a) * d, rand() * Math.PI, 0.7 + rand() * 0.8));
    }
    layouts.push({ id: 'ore-craggy', name: 'Craggy ridge', terrain: 'ore', props });
  }

  // Desert — cactus
  {
    const rand = seeded(601);
    layouts.push({
      id: 'desert-default',
      name: 'Lone cactus',
      terrain: 'desert',
      props: [prop(rand, 'cactus', 0.25, -0.15, 0, 1)],
    });
  }
  {
    const rand = seeded(602);
    layouts.push({
      id: 'desert-pair',
      name: 'Cactus pair',
      terrain: 'desert',
      props: [
        prop(rand, 'cactus', 0.2, -0.2, 0.2, 1),
        prop(rand, 'cactus', -0.28, 0.15, -0.3, 0.75),
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
  const layouts = layoutsRaw.map(sanitizeLayout).filter((l): l is BiomeLayout => l !== null);
  if (layouts.length === 0) return fallback;
  // Ensure every terrain has at least one layout
  for (const t of TERRAIN_ORDER) {
    if (!layouts.some((l) => l.terrain === t)) {
      layouts.push(...fallback.layouts.filter((l) => l.terrain === t));
    }
  }
  return { version: 1, layouts };
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
): void {
  for (const instance of layout.props) {
    const obj = createPropObject(instance);
    if (!obj) continue;
    obj.position.x += worldX;
    obj.position.y += worldY;
    obj.position.z += worldZ;
    parent.add(obj);
  }
}
