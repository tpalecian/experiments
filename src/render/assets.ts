/**
 * Procedural mesh factories shared by BoardView and the Asset Lab preview.
 * Keep game pieces / props here so craft work can be inspected in isolation.
 */
import * as THREE from 'three';
import type { Terrain } from '../game/types';
import { STYLE, STYLIZED_PLAYER, STYLIZED_TERRAIN, STYLIZED_TERRAIN_SIDE, toonMat } from './style';

export type AssetCategory = 'pieces' | 'props' | 'board';

export interface AssetCreateOptions {
  /** Player color index 0–3 for settlements / cities / roads. */
  playerIndex?: number;
  /** Explicit hex color override for player-tinted pieces. */
  color?: number;
  /** Tree / prop scale multiplier. */
  scale?: number;
  /** Number token face value (2–12). */
  number?: number;
  /** Terrain for hex tile / rim samples. */
  terrain?: Terrain;
  /** Harbor label text (e.g. "3:1" or "2:1 W"). */
  harborLabel?: string;
  /** Harbor label background. */
  harborBg?: string;
}

export interface AssetDefinition {
  id: string;
  name: string;
  category: AssetCategory;
  description: string;
  /** Whether the player-color control applies. */
  playerTint?: boolean;
  create: (opts?: AssetCreateOptions) => THREE.Object3D;
}

export const TILE_HEIGHT = 0.28;

/** Pointy-top hex in the XY plane (matches board hexCorner angles). */
export function hexShape(size: number): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const x = size * Math.cos(angle);
    const y = size * Math.sin(angle);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

export function numberTexture(n: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 128, 128);
  ctx.beginPath();
  ctx.arc(64, 64, 56, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(48, 44, 10, 64, 64, 56);
  g.addColorStop(0, '#ffe7b0');
  g.addColorStop(1, '#d4a45a');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#5c3d2e';
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.fillStyle = n === 6 || n === 8 ? '#d62828' : '#3a2a18';
  ctx.font = 'bold 58px Fraunces, Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(n), 64, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function resolvePlayerColor(opts?: AssetCreateOptions): number {
  if (opts?.color !== undefined) return opts.color;
  const idx = Math.max(0, Math.min(3, opts?.playerIndex ?? 0));
  return STYLIZED_PLAYER[idx]!;
}

export function makeSettlement(opts?: AssetCreateOptions): THREE.Object3D {
  const color = resolvePlayerColor(opts);
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.26, 0.32), toonMat(color));
  base.position.y = 0.16;
  base.castShadow = true;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.26, 4), toonMat(STYLE.roof));
  roof.position.y = 0.4;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.02), toonMat(STYLE.woodTrim));
  door.position.set(0, 0.12, 0.17);
  g.add(base, roof, door);
  g.scale.setScalar(1.15);
  return g;
}

export function makeCity(opts?: AssetCreateOptions): THREE.Object3D {
  const color = resolvePlayerColor(opts);
  const g = new THREE.Group();
  const keep = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 0.36), toonMat(color));
  keep.position.y = 0.24;
  keep.castShadow = true;
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.55, 6), toonMat(color));
  tower.position.set(0.2, 0.3, 0.05);
  tower.castShadow = true;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.18, 6), toonMat(STYLE.roof));
  roof.position.set(0.2, 0.64, 0.05);
  roof.castShadow = true;
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.02), toonMat(STYLE.highlight));
  flag.position.set(0.28, 0.72, 0.05);
  g.add(keep, tower, roof, flag);
  g.scale.setScalar(1.1);
  return g;
}

export function makeRoad(opts?: AssetCreateOptions): THREE.Mesh {
  const color = resolvePlayerColor(opts);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.12, 0.2), toonMat(color));
  mesh.castShadow = true;
  mesh.position.y = 0.06;
  return mesh;
}

export function makeRobber(_opts?: AssetCreateOptions): THREE.Object3D {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.42, 6), toonMat(0x2a2430));
  body.position.y = 0.24;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), toonMat(0x3a3444));
  head.position.y = 0.52;
  head.castShadow = true;
  const eyeL = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 6, 4),
    new THREE.MeshBasicMaterial({ color: 0xffee88 }),
  );
  eyeL.position.set(-0.05, 0.54, 0.12);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.05;
  g.add(body, head, eyeL, eyeR);
  return g;
}

/** Tiny low-poly sheep for Classic Enhanced pasture hexes. */
export function makeSheep(_opts?: AssetCreateOptions): THREE.Object3D {
  const g = new THREE.Group();
  const wool = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.075, 0.07), toonMat(0xf4f0e6));
  wool.position.y = 0.055;
  wool.castShadow = true;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, 0.04), toonMat(0xe8e0d4));
  head.position.set(0.055, 0.06, 0);
  head.castShadow = true;
  const legGeo = new THREE.BoxGeometry(0.015, 0.03, 0.015);
  const legMat = toonMat(0x5c4a3a);
  const legs: [number, number][] = [
    [-0.03, 0.02],
    [-0.03, -0.02],
    [0.03, 0.02],
    [0.03, -0.02],
  ];
  for (const [lx, lz] of legs) {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(lx, 0.015, lz);
    g.add(leg);
  }
  g.add(wool, head);
  return g;
}

/** Short wooden fence segment for pasture hexes. */
export function makeFence(_opts?: AssetCreateOptions): THREE.Object3D {
  const g = new THREE.Group();
  const postMat = toonMat(STYLE.woodTrim);
  const postGeo = new THREE.BoxGeometry(0.025, 0.1, 0.025);
  for (const px of [-0.09, 0.09]) {
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(px, 0.05, 0);
    post.castShadow = true;
    g.add(post);
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.018), postMat);
  rail.position.set(0, 0.07, 0);
  rail.castShadow = true;
  const rail2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.018, 0.016), postMat);
  rail2.position.set(0, 0.04, 0);
  g.add(rail, rail2);
  return g;
}

export function makeTree(opts?: AssetCreateOptions): THREE.Object3D {
  const scale = opts?.scale ?? 1;
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.16, 5), toonMat(STYLE.woodTrim));
  trunk.position.y = 0.08;
  trunk.castShadow = true;
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.32, 5), toonMat(0x3d9a4a));
  canopy.position.y = 0.3;
  canopy.castShadow = true;
  const canopy2 = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.24, 5), toonMat(0x52b85c));
  canopy2.position.y = 0.42;
  canopy2.castShadow = true;
  g.add(trunk, canopy, canopy2);
  g.scale.setScalar(scale);
  return g;
}

export function makeWheatStalk(_opts?: AssetCreateOptions): THREE.Object3D {
  const stalk = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.28, 4), toonMat(0xf5d56a));
  stalk.position.y = 0.14;
  stalk.castShadow = true;
  return stalk;
}

export function makeRock(opts?: AssetCreateOptions): THREE.Object3D {
  const scale = opts?.scale ?? 1;
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.14 * scale, 0), toonMat(0x9aa3b5));
  rock.position.y = 0.1 * scale;
  rock.castShadow = true;
  return rock;
}

export function makeMesa(_opts?: AssetCreateOptions): THREE.Object3D {
  const mesa = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.35, 0.22, 5), toonMat(0xc4683a));
  mesa.position.y = 0.11;
  mesa.castShadow = true;
  return mesa;
}

export function makeCactus(_opts?: AssetCreateOptions): THREE.Object3D {
  const cactus = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.28, 5), toonMat(0x4aa05a));
  trunk.position.y = 0.14;
  trunk.castShadow = true;
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.14, 5), toonMat(0x4aa05a));
  arm.position.set(0.08, 0.18, 0);
  arm.rotation.z = -0.8;
  arm.castShadow = true;
  cactus.add(trunk, arm);
  return cactus;
}

export function makeNumberToken(opts?: AssetCreateOptions): THREE.Object3D {
  const n = opts?.number ?? 8;
  const token = new THREE.Mesh(
    new THREE.CircleGeometry(0.3, 6),
    new THREE.MeshBasicMaterial({ map: numberTexture(n), transparent: true }),
  );
  token.rotation.x = -Math.PI / 2;
  token.position.y = 0.02;
  return token;
}

export function makeHarborPier(_opts?: AssetCreateOptions): THREE.Object3D {
  const pier = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, 0.18), toonMat(STYLE.woodTrim));
  pier.position.y = 0.03;
  pier.castShadow = true;
  return pier;
}

export function makeHarborLabel(opts?: AssetCreateOptions): THREE.Object3D {
  const text = opts?.harborLabel ?? '3:1';
  const bg = opts?.harborBg ?? '#ffe8c0';
  return makeLabelSprite(text, bg);
}

export function makeLabelSprite(text: string, bg: string): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 96;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.strokeStyle = '#5c3d2e';
  ctx.lineWidth = 8;
  roundRect(ctx, 8, 8, 240, 80, 20);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#3a2a18';
  ctx.font = 'bold 36px Fraunces, Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 52);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const s = new THREE.Sprite(mat);
  s.scale.set(1.15, 0.42, 1);
  s.position.y = 0.35;
  return s;
}

export function makeDirtSkirt(_opts?: AssetCreateOptions): THREE.Object3D {
  const skirt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.94, 1.08, 0.22, 6),
    toonMat(STYLE.dirt),
  );
  skirt.position.y = -0.1;
  skirt.receiveShadow = true;
  return skirt;
}

export function makeHexTile(opts?: AssetCreateOptions): THREE.Object3D {
  const terrain = opts?.terrain ?? 'wood';
  const tileRadius = 1;
  const geom = new THREE.ExtrudeGeometry(hexShape(tileRadius), {
    depth: TILE_HEIGHT,
    bevelEnabled: false,
  });
  geom.rotateX(-Math.PI / 2);
  geom.computeVertexNormals();
  const mesh = new THREE.Mesh(geom, toonMat(STYLIZED_TERRAIN[terrain]));
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const g = new THREE.Group();
  g.add(mesh);

  const rimShape = hexShape(tileRadius * 0.985);
  const hole = new THREE.Path();
  for (let i = 5; i >= 0; i--) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const x = tileRadius * 0.9 * Math.cos(angle);
    const y = tileRadius * 0.9 * Math.sin(angle);
    if (i === 5) hole.moveTo(x, y);
    else hole.lineTo(x, y);
  }
  hole.closePath();
  rimShape.holes.push(hole);
  const rimGeom = new THREE.ShapeGeometry(rimShape);
  rimGeom.rotateX(-Math.PI / 2);
  const rim = new THREE.Mesh(
    rimGeom,
    new THREE.MeshBasicMaterial({
      color: STYLIZED_TERRAIN_SIDE[terrain],
      side: THREE.DoubleSide,
    }),
  );
  rim.position.y = TILE_HEIGHT + 0.002;
  g.add(rim);
  return g;
}

export const ASSET_CATALOG: AssetDefinition[] = [
  {
    id: 'settlement',
    name: 'Settlement',
    category: 'pieces',
    description: 'Player house placed on vertices.',
    playerTint: true,
    create: makeSettlement,
  },
  {
    id: 'city',
    name: 'City',
    category: 'pieces',
    description: 'Upgraded settlement with keep + tower.',
    playerTint: true,
    create: makeCity,
  },
  {
    id: 'road',
    name: 'Road',
    category: 'pieces',
    description: 'Edge piece connecting settlements.',
    playerTint: true,
    create: makeRoad,
  },
  {
    id: 'robber',
    name: 'Robber',
    category: 'pieces',
    description: 'Blocks production; hops between hexes.',
    create: makeRobber,
  },
  {
    id: 'tree',
    name: 'Tree',
    category: 'props',
    description: 'Forest canopy prop (wood / pasture).',
    create: (opts) => makeTree({ ...opts, scale: opts?.scale ?? 1 }),
  },
  {
    id: 'sheep',
    name: 'Sheep',
    category: 'props',
    description: 'Tiny pasture sheep.',
    create: makeSheep,
  },
  {
    id: 'fence',
    name: 'Fence',
    category: 'props',
    description: 'Short wooden fence segment.',
    create: makeFence,
  },
  {
    id: 'wheat',
    name: 'Wheat stalk',
    category: 'props',
    description: 'Field cone for wheat hexes.',
    create: makeWheatStalk,
  },
  {
    id: 'rock',
    name: 'Ore rock',
    category: 'props',
    description: 'Dodecahedron rock for ore hexes.',
    create: makeRock,
  },
  {
    id: 'mesa',
    name: 'Brick mesa',
    category: 'props',
    description: 'Hill / mesa for brick hexes.',
    create: makeMesa,
  },
  {
    id: 'cactus',
    name: 'Cactus',
    category: 'props',
    description: 'Desert cactus prop.',
    create: makeCactus,
  },
  {
    id: 'number-token',
    name: 'Number token',
    category: 'board',
    description: 'Wooden production chit (default 8).',
    create: makeNumberToken,
  },
  {
    id: 'harbor-pier',
    name: 'Harbor pier',
    category: 'board',
    description: 'Dock stub outside coastal edges.',
    create: makeHarborPier,
  },
  {
    id: 'harbor-label',
    name: 'Harbor label',
    category: 'board',
    description: 'Billboard trade ratio sprite.',
    create: makeHarborLabel,
  },
  {
    id: 'dirt-skirt',
    name: 'Dirt skirt',
    category: 'board',
    description: 'Pedestal under hex tiles.',
    create: makeDirtSkirt,
  },
  {
    id: 'hex-wood',
    name: 'Hex · wood',
    category: 'board',
    description: 'Extruded forest tile + rim.',
    create: () => makeHexTile({ terrain: 'wood' }),
  },
  {
    id: 'hex-brick',
    name: 'Hex · brick',
    category: 'board',
    description: 'Extruded hills tile + rim.',
    create: () => makeHexTile({ terrain: 'brick' }),
  },
  {
    id: 'hex-sheep',
    name: 'Hex · sheep',
    category: 'board',
    description: 'Extruded pasture tile + rim.',
    create: () => makeHexTile({ terrain: 'sheep' }),
  },
  {
    id: 'hex-wheat',
    name: 'Hex · wheat',
    category: 'board',
    description: 'Extruded fields tile + rim.',
    create: () => makeHexTile({ terrain: 'wheat' }),
  },
  {
    id: 'hex-ore',
    name: 'Hex · ore',
    category: 'board',
    description: 'Extruded mountains tile + rim.',
    create: () => makeHexTile({ terrain: 'ore' }),
  },
  {
    id: 'hex-desert',
    name: 'Hex · desert',
    category: 'board',
    description: 'Extruded desert tile + rim.',
    create: () => makeHexTile({ terrain: 'desert' }),
  },
];

export const ASSET_CATEGORIES: { id: AssetCategory; label: string }[] = [
  { id: 'pieces', label: 'Pieces' },
  { id: 'props', label: 'Props' },
  { id: 'board', label: 'Board' },
];

export function getAssetById(id: string): AssetDefinition | undefined {
  return ASSET_CATALOG.find((a) => a.id === id);
}
