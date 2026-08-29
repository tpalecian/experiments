/**
 * Hex tile, harbor, and biome prop factories.
 */
import * as THREE from 'three';
import {
  STYLE,
  STYLIZED_TERRAIN,
  STYLIZED_TERRAIN_SIDE,
  getMeadowFloorMaterial,
  toonMat,
} from '../../style/style';
import type { AssetCreateOptions } from './types';
import { TILE_HEIGHT, hexShape, numberTexture, roundRect } from './types';
import { HEX_SIZE } from '../../engine/board';

export function makeSheep(opts?: AssetCreateOptions): THREE.Object3D {
  const variant = Math.abs(Math.floor(opts?.variant ?? 0)) % 4;
  const g = new THREE.Group();
  const woolMat = toonMat(0xf2efe8);
  const faceMat = toonMat(0x3a3a42);
  const legMat = toonMat(0x2e2e34);

  // Soft wool body — overlapping spheres read as cloud fluff at tabletop scale
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), woolMat);
  body.position.y = 0.062;
  body.scale.set(1.15, 0.95, 1.05);
  body.castShadow = true;
  g.add(body);

  const bumps: [number, number, number, number][] = [
    [0.04, 0.078, 0.015, 0.032],
    [-0.035, 0.072, -0.02, 0.03],
    [0.01, 0.088, -0.03, 0.028],
    [-0.01, 0.055, 0.035, 0.026],
    [0.03, 0.06, -0.035, 0.024],
  ];
  for (const [bx, by, bz, r] of bumps) {
    const fluff = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 5), woolMat);
    fluff.position.set(bx, by, bz);
    fluff.castShadow = true;
    g.add(fluff);
  }

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.024, 7, 6), faceMat);
  // Pose variants: head lean / forward bias
  const headX = 0.062 + (variant === 1 ? 0.008 : variant === 2 ? -0.004 : 0);
  const headY = 0.068 + (variant === 3 ? 0.01 : 0);
  const headZ = variant === 2 ? 0.012 : variant === 1 ? -0.01 : 0;
  head.position.set(headX, headY, headZ);
  head.castShadow = true;
  g.add(head);

  const earGeo = new THREE.SphereGeometry(0.01, 5, 4);
  const earL = new THREE.Mesh(earGeo, faceMat);
  earL.position.set(headX - 0.005, headY + 0.012, headZ + 0.018);
  earL.scale.set(0.7, 1.1, 0.5);
  const earR = earL.clone();
  earR.position.z = headZ - 0.018;
  g.add(earL, earR);

  const legGeo = new THREE.CylinderGeometry(0.007, 0.009, 0.032, 5);
  const legs: [number, number][] = [
    [-0.028, 0.018],
    [-0.028, -0.018],
    [0.03, 0.018],
    [0.03, -0.018],
  ];
  for (const [lx, lz] of legs) {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(lx, 0.016, lz);
    leg.castShadow = true;
    g.add(leg);
  }

  if (opts?.scale !== undefined) g.scale.setScalar(opts.scale);
  return g;
}

/** Short wooden fence segment (legacy pasture prop; kept for Asset Lab). */
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

/**
 * Low weathered stone wall segment for sheep-grassland enclosure.
 * variant 0 = straight edge, 1 = corner bend cue, 2 = thicker rubble.
 */
export function makeStoneWall(opts?: AssetCreateOptions): THREE.Object3D {
  const variant = Math.abs(Math.floor(opts?.variant ?? 0)) % 3;
  const g = new THREE.Group();
  const greys = [0x9aa0a8, 0x8e949c, 0xa8adb4, 0x7d838c];
  const count = variant === 2 ? 5 : 4;
  const span = variant === 1 ? 0.22 : 0.28;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const x = (t - 0.5) * span;
    const h = 0.055 + ((i * 17 + variant * 9) % 5) * 0.006;
    const w = 0.055 + ((i * 13) % 3) * 0.008;
    const d = 0.04 + ((i * 11) % 3) * 0.006;
    const stone = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      toonMat(greys[(i + variant) % greys.length]!),
    );
    stone.position.set(x, h * 0.5, variant === 1 ? (t - 0.5) * 0.08 : 0);
    stone.rotation.y = ((i % 3) - 1) * 0.08;
    stone.castShadow = true;
    g.add(stone);
  }
  // Cap stones
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(span * 0.92, 0.022, 0.045),
    toonMat(0xb0b5bc),
  );
  cap.position.set(0, 0.078, variant === 1 ? 0.02 : 0);
  cap.castShadow = true;
  g.add(cap);

  if (opts?.scale !== undefined) g.scale.setScalar(opts.scale);
  return g;
}

/** Rounded dark-green shrub for meadow clutter. */
export function makeBush(opts?: AssetCreateOptions): THREE.Object3D {
  const variant = Math.abs(Math.floor(opts?.variant ?? 0)) % 3;
  const g = new THREE.Group();
  const greens = [0x3d7a3a, 0x4a8f42, 0x2f6b38];
  const clusters: [number, number, number, number][] =
    variant === 0
      ? [
          [0, 0.04, 0, 0.045],
          [0.03, 0.035, 0.02, 0.032],
          [-0.028, 0.032, -0.015, 0.03],
        ]
      : variant === 1
        ? [
            [0, 0.05, 0, 0.05],
            [0.035, 0.04, -0.01, 0.034],
            [-0.03, 0.038, 0.025, 0.036],
            [0.01, 0.055, 0.02, 0.028],
          ]
        : [
            [0, 0.035, 0, 0.038],
            [0.025, 0.03, 0.015, 0.028],
          ];
  clusters.forEach(([x, y, z, r], i) => {
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(r, 7, 6),
      toonMat(greens[i % greens.length]!),
    );
    leaf.position.set(x, y, z);
    leaf.scale.set(1.1, 0.85, 1.05);
    leaf.castShadow = true;
    g.add(leaf);
  });
  if (opts?.scale !== undefined) g.scale.setScalar(opts.scale);
  return g;
}

/** Small pasture stone cluster (not ore mountain rocks). */
export function makePastureRock(opts?: AssetCreateOptions): THREE.Object3D {
  const variant = Math.abs(Math.floor(opts?.variant ?? 0)) % 4;
  const g = new THREE.Group();
  const tones = [0x9aa0a8, 0xb0a898, 0x8a9098, 0xa8a49c];
  const layouts: [number, number, number, number][][] = [
    [
      [0, 0.02, 0, 0.028],
      [0.03, 0.015, 0.01, 0.02],
    ],
    [
      [0, 0.022, 0, 0.032],
      [-0.025, 0.014, 0.015, 0.018],
      [0.02, 0.012, -0.02, 0.016],
    ],
    [[0, 0.018, 0, 0.024]],
    [
      [0, 0.025, 0, 0.03],
      [0.028, 0.016, -0.012, 0.02],
      [-0.02, 0.014, -0.018, 0.017],
      [0.01, 0.012, 0.025, 0.015],
    ],
  ];
  for (const [x, y, z, r] of layouts[variant]!) {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(r, 0),
      toonMat(tones[(variant + Math.round(x * 40)) % tones.length]!),
    );
    rock.position.set(x, y, z);
    rock.rotation.set(0.3 * variant, 0.5 + variant, 0.2);
    rock.castShadow = true;
    g.add(rock);
  }
  if (opts?.scale !== undefined) g.scale.setScalar(opts.scale);
  return g;
}

/** Conical pine for pasture corners (darker stacked cones). */
export function makePine(opts?: AssetCreateOptions): THREE.Object3D {
  const scale = opts?.scale ?? 1;
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.028, 0.12, 5),
    toonMat(STYLE.woodTrim),
  );
  trunk.position.y = 0.06;
  trunk.castShadow = true;
  const bot = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 6), toonMat(0x2d6b3a));
  bot.position.y = 0.18;
  bot.castShadow = true;
  const mid = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.17, 6), toonMat(0x3a7f42));
  mid.position.y = 0.3;
  mid.castShadow = true;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.14, 6), toonMat(0x245530));
  tip.position.y = 0.4;
  tip.castShadow = true;
  g.add(trunk, bot, mid, tip);
  g.scale.setScalar(scale);
  return g;
}

/** Tiny white/yellow flower tuft prop. */
export function makeFlowerTuft(opts?: AssetCreateOptions): THREE.Object3D {
  const variant = Math.abs(Math.floor(opts?.variant ?? 0)) % 2;
  const g = new THREE.Group();
  const petalMat = toonMat(variant === 0 ? 0xf4f0e8 : 0xe8d070);
  const centerMat = toonMat(variant === 0 ? 0xe8d070 : 0xf4f0e8);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.005, 0.04, 4), toonMat(0x4a8f42));
    stem.position.set(Math.cos(a) * 0.018, 0.02, Math.sin(a) * 0.018);
    const blossom = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5), petalMat);
    blossom.position.set(Math.cos(a) * 0.018, 0.042, Math.sin(a) * 0.018);
    blossom.scale.set(1.2, 0.7, 1.2);
    const center = new THREE.Mesh(new THREE.SphereGeometry(0.005, 5, 4), centerMat);
    center.position.copy(blossom.position);
    center.position.y += 0.004;
    g.add(stem, blossom, center);
  }
  if (opts?.scale !== undefined) g.scale.setScalar(opts.scale);
  return g;
}

export function makeTree(opts?: AssetCreateOptions): THREE.Object3D {
  const scale = opts?.scale ?? 1;
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.16, 5), toonMat(STYLE.woodTrim));
  trunk.position.y = 0.08;
  trunk.castShadow = true;
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 6), toonMat(0x3d9a4a));
  canopy.position.y = 0.36;
  canopy.castShadow = true;
  const canopy2 = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.28, 6), toonMat(0x52b85c));
  canopy2.position.y = 0.52;
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

/** Faceted boulder pile — chunky rocks, not skinny cones. */
export function makeMountain(opts?: AssetCreateOptions): THREE.Object3D {
  const variant = (Math.abs(Math.floor(opts?.variant ?? 0)) % 3) as 0 | 1 | 2;
  const g = new THREE.Group();
  const light = 0xc8ced8;
  const mid = 0x9aa3b0;
  const dark = 0x6a7382;

  const addBoulder = (
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    yaw: number,
    color: number,
  ): void => {
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), toonMat(color));
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.rotation.set(0.22 + yaw * 0.08, yaw, 0.14);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
  };

  switch (variant) {
    case 0:
      addBoulder(0.02, 0.32, -0.04, 1.22, 0.78, 1.05, 0.2, light);
      addBoulder(-0.34, 0.24, 0.12, 0.92, 0.58, 0.86, 0.9, dark);
      addBoulder(0.38, 0.26, -0.16, 0.78, 0.52, 0.82, -0.5, mid);
      addBoulder(0.1, 0.16, 0.36, 0.62, 0.4, 0.58, 0.4, mid);
      addBoulder(-0.16, 0.2, -0.34, 0.7, 0.44, 0.64, 1.2, dark);
      break;
    case 1:
      addBoulder(-0.08, 0.28, 0.06, 1.05, 0.7, 0.95, 0.6, mid);
      addBoulder(0.3, 0.22, -0.18, 0.88, 0.55, 0.8, -0.3, light);
      addBoulder(-0.36, 0.18, -0.14, 0.72, 0.46, 0.7, 1.4, dark);
      addBoulder(0.06, 0.14, 0.32, 0.55, 0.36, 0.5, 0.15, mid);
      break;
    case 2:
      addBoulder(0.12, 0.24, -0.08, 0.95, 0.62, 0.88, -0.8, light);
      addBoulder(-0.28, 0.2, 0.16, 0.82, 0.5, 0.76, 0.5, dark);
      addBoulder(0.34, 0.16, 0.22, 0.58, 0.38, 0.54, 1.1, mid);
      addBoulder(-0.04, 0.14, -0.3, 0.64, 0.4, 0.6, 0.2, mid);
      break;
    default: {
      const _exhaustive: never = variant;
      return _exhaustive;
    }
  }

  if (opts?.scale !== undefined) g.scale.setScalar(opts.scale);
  return g;
}

/** Tiny wheat-field barn. */
export function makeBarn(_opts?: AssetCreateOptions): THREE.Object3D {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.2), toonMat(0xc45a3a));
  body.position.y = 0.08;
  body.castShadow = true;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.14, 4), toonMat(STYLE.roof));
  roof.position.y = 0.22;
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.35, 1, 0.85);
  roof.castShadow = true;
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.02), toonMat(STYLE.woodTrim));
  door.position.set(0, 0.06, 0.11);
  g.add(body, roof, door);
  return g;
}

/** Tiny field windmill. */
export function makeWindmill(_opts?: AssetCreateOptions): THREE.Object3D {
  const g = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.32, 6), toonMat(0xe8dcc0));
  tower.position.y = 0.16;
  tower.castShadow = true;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.08, 6), toonMat(STYLE.roof));
  cap.position.y = 0.36;
  cap.castShadow = true;
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 5), toonMat(STYLE.woodTrim));
  hub.position.set(0, 0.3, 0.06);
  const bladeGeo = new THREE.BoxGeometry(0.22, 0.03, 0.012);
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(bladeGeo, toonMat(0xf4efe4));
    blade.position.set(0, 0.3, 0.07);
    blade.rotation.z = (i * Math.PI) / 2;
    blade.translateX(0.1);
    blade.castShadow = true;
    g.add(blade);
  }
  g.add(tower, cap, hub);
  return g;
}

/** Fallen forest log. */
export function makeFallenLog(opts?: AssetCreateOptions): THREE.Object3D {
  const log = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.32, 6), toonMat(STYLE.woodTrim));
  log.rotation.z = Math.PI / 2;
  log.rotation.y = 0.3;
  log.position.y = 0.04;
  log.castShadow = true;
  if (opts?.scale !== undefined) log.scale.setScalar(opts.scale);
  return log;
}

/** Desert oasis — shallow pool + palms. */
export function makeOasis(_opts?: AssetCreateOptions): THREE.Object3D {
  const g = new THREE.Group();
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(0.16, 10),
    new THREE.MeshBasicMaterial({ color: 0x3ec8d8, transparent: true, opacity: 0.85 }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.012;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 6, 12), toonMat(0xe8d4a8));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.014;
  const palm = makeTree({ scale: 0.45 });
  palm.position.set(0.14, 0, 0.04);
  g.add(pool, rim, palm);
  return g;
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
  const tileRadius = HEX_SIZE;
  const geom = new THREE.ExtrudeGeometry(hexShape(tileRadius), {
    depth: TILE_HEIGHT,
    bevelEnabled: false,
  });
  geom.rotateX(-Math.PI / 2);
  geom.computeVertexNormals();

  // Pasture uses meadow map — remap Extrude lid UVs into 0–1 (three@r172 lids = group 0).
  if (terrain === 'sheep') {
    const pos = geom.attributes.position;
    const uv = geom.attributes.uv;
    if (pos && uv) {
      const span = tileRadius * 2;
      for (const group of geom.groups) {
        if (group.materialIndex !== 0) continue;
        for (let i = group.start; i < group.start + group.count; i++) {
          uv.setXY(i, pos.getX(i) / span + 0.5, pos.getZ(i) / span + 0.5);
        }
      }
      uv.needsUpdate = true;
    }
  }

  const mat: THREE.Material | THREE.Material[] =
    terrain === 'sheep'
      ? [getMeadowFloorMaterial().clone(), toonMat(STYLIZED_TERRAIN_SIDE.sheep)]
      : toonMat(STYLIZED_TERRAIN[terrain]);
  const mesh = new THREE.Mesh(geom, mat);
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

