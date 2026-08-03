import * as THREE from 'three';
import { HEX_SIZE, axialToWorld, coastalEdgeDirs } from '../game/board';
import type { BoardState, PlayerId, Terrain } from '../game/types';
import { GrassField } from './grass';
import {
  STYLE,
  STYLIZED_PLAYER,
  STYLIZED_TERRAIN,
  STYLIZED_TERRAIN_SIDE,
  getToonGradient,
  standardStylized,
  toonMat,
} from './style';
import type { AtmosphereSnapshot } from './atmosphere';
import type { StyleConfig } from './styleConfig';
import { SEA_LEVEL, WaterSurface } from './water';

const TILE_HEIGHT = 0.28;
/** How far coastal hex sides flare outward as they meet the sea. */
const COAST_FLARE = 0.34;
/** Bevel subdivisions on coastal sides — more segments = smoother ramp. */
const COAST_BEVEL_SEGMENTS = 6;
/** Outer lip sits a hair above the water to avoid z-fighting. */
const COAST_SEA_Y = SEA_LEVEL + 0.012;

/** Pointy-top hex in the XY plane (matches board hexCorner angles). */
function hexShape(size: number): THREE.Shape {
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

/**
 * Flat hexagonal ring using the same pointy-top orientation as hex tiles.
 * RingGeometry(…, 6) defaults to flat-top and will not match ExtrudeGeometry(hexShape).
 */
function hexRimGeometry(inner: number, outer: number): THREE.BufferGeometry {
  const shape = hexShape(outer);
  // Hole must wind opposite the outer path for ShapeGeometry to triangulate correctly.
  const hole = new THREE.Path();
  for (let i = 5; i >= 0; i--) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const x = inner * Math.cos(angle);
    const y = inner * Math.sin(angle);
    if (i === 5) hole.moveTo(x, y);
    else hole.lineTo(x, y);
  }
  hole.closePath();
  shape.holes.push(hole);
  const geom = new THREE.ShapeGeometry(shape);
  geom.rotateX(-Math.PI / 2);
  return geom;
}

function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/**
 * Hex tile solid (approach B): one mesh, no layered skirts on the coast.
 * Inland sides stay vertical. Water-facing sides use a multi-segment bevel
 * that flares out and eases down to sea level as one continuous ramp.
 */
function hexTileGeometry(size: number, coastalEdges: boolean[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  let v = 0;
  const push = (x: number, y: number, z: number): number => {
    positions.push(x, y, z);
    return v++;
  };

  const cornerAngle = (i: number) => (Math.PI / 180) * (60 * i - 30);
  const edgeOutAngle = (i: number) => (Math.PI / 180) * (60 * i);
  const isCoastal = coastalEdges.some(Boolean);
  const segments = isCoastal ? COAST_BEVEL_SEGMENTS : 1;

  const cornerFlareDir = (i: number): { nx: number; nz: number } | null => {
    const prevCoast = coastalEdges[(i + 5) % 6];
    const nextCoast = coastalEdges[i];
    if (!prevCoast && !nextCoast) return null;
    let nx = 0;
    let nz = 0;
    if (nextCoast) {
      const ea = edgeOutAngle(i);
      nx += Math.cos(ea);
      nz += Math.sin(ea);
    }
    if (prevCoast) {
      const ea = edgeOutAngle((i + 5) % 6);
      nx += Math.cos(ea);
      nz += Math.sin(ea);
    }
    const nlen = Math.hypot(nx, nz) || 1;
    return { nx: nx / nlen, nz: nz / nlen };
  };

  // Ring 0 = flat top; ring `segments` = bottom (sea lip or inland floor).
  const rings: number[][] = [];
  for (let s = 0; s <= segments; s++) {
    const t = s / segments;
    const ease = smoothstep(t);
    const ring: number[] = [];
    for (let i = 0; i < 6; i++) {
      const a = cornerAngle(i);
      const cx = Math.cos(a);
      const cz = Math.sin(a);
      const flare = cornerFlareDir(i);
      if (flare) {
        const y = TILE_HEIGHT + (COAST_SEA_Y - TILE_HEIGHT) * ease;
        ring.push(
          push(
            size * cx + flare.nx * COAST_FLARE * ease,
            y,
            size * cz + flare.nz * COAST_FLARE * ease,
          ),
        );
      } else {
        // Vertical inland wall — keep neighbor seams flush.
        ring.push(push(size * cx, TILE_HEIGHT * (1 - t), size * cz));
      }
    }
    rings.push(ring);
  }

  const topCenter = push(0, TILE_HEIGHT, 0);
  for (let i = 0; i < 6; i++) {
    indices.push(topCenter, rings[0][i], rings[0][(i + 1) % 6]);
  }

  for (let s = 0; s < segments; s++) {
    for (let i = 0; i < 6; i++) {
      const j = (i + 1) % 6;
      const a = rings[s][i];
      const b = rings[s][j];
      const c = rings[s + 1][j];
      const d = rings[s + 1][i];
      indices.push(a, d, c);
      indices.push(a, c, b);
    }
  }

  const botY = isCoastal ? COAST_SEA_Y : 0;
  const botCenter = push(0, botY, 0);
  const botRing = rings[segments];
  for (let i = 0; i < 6; i++) {
    indices.push(botCenter, botRing[(i + 1) % 6], botRing[i]);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

function numberTexture(n: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 128, 128);
  // Wooden token look
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

function seeded(n: number): () => number {
  let s = (n * 16807) % 2147483647;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export class BoardView {
  readonly root = new THREE.Group();
  private hexMeshes = new Map<string, THREE.Mesh>();
  private vertexMarkers = new Map<string, THREE.Mesh>();
  private edgeMarkers = new Map<string, THREE.Mesh>();
  private buildingMeshes = new Map<string, THREE.Object3D>();
  private roadMeshes = new Map<string, THREE.Mesh>();
  private robber: THREE.Object3D;
  private harborGroup = new THREE.Group();
  private propsGroup = new THREE.Group();
  private pickables: THREE.Object3D[] = [];
  private grass = new GrassField();
  private water = new WaterSurface();
  private readonly groundRay = new THREE.Raycaster();
  private readonly groundOrigin = new THREE.Vector3();
  private readonly groundDir = new THREE.Vector3(0, -1, 0);

  constructor() {
    this.robber = this.makeRobber();
    this.root.add(this.water.mesh);
    this.root.add(this.harborGroup);
    this.root.add(this.propsGroup);
    this.root.add(this.robber);
    this.root.add(this.grass.group);
  }

  getPickables(): THREE.Object3D[] {
    return this.pickables;
  }

  update(time: number): void {
    this.grass.update(time);
    this.water.update(time);
  }

  setSunDirection(dir: THREE.Vector3): void {
    this.water.setSunDirection(dir);
  }

  applyStyleConfig(config: StyleConfig): void {
    this.water.applyConfig(config);
  }

  applyAtmosphere(atm: AtmosphereSnapshot): void {
    this.water.applyAtmosphere(atm);
  }

  /** Sample land surface Y at a world XZ by raycasting down onto hex meshes. */
  sampleGroundY(x: number, z: number, fallback = TILE_HEIGHT): number {
    this.groundOrigin.set(x, TILE_HEIGHT + 5, z);
    this.groundRay.set(this.groundOrigin, this.groundDir);
    const hits = this.groundRay.intersectObjects([...this.hexMeshes.values()], false);
    if (hits.length > 0) return hits[0].point.y;
    return fallback;
  }

  build(board: BoardState): void {
    this.clearDynamic();
    this.pickables = [];

    this.water.resize(board.rings);
    const landCenters: { x: number; z: number }[] = [];
    for (const hex of board.hexes.values()) {
      landCenters.push(axialToWorld(hex.q, hex.r));
    }
    this.water.setLandHexes(landCenters, HEX_SIZE, COAST_FLARE);
    this.root.add(this.water.mesh);

    const hexIds = new Set(board.hexes.keys());

    // Full HEX_SIZE so neighbors meet edge-to-edge (matches axialToWorld / hexCorner spacing).
    const tileRadius = HEX_SIZE;
    const inlandCoast = [false, false, false, false, false, false];
    const inlandGeom = hexTileGeometry(tileRadius, inlandCoast);
    const rimGeom = hexRimGeometry(tileRadius * 0.9, tileRadius * 0.985);

    const grassPatches: { x: number; z: number; y: number }[] = [];

    for (const hex of board.hexes.values()) {
      const { x, z } = axialToWorld(hex.q, hex.r);
      const terrain = hex.terrain as Terrain;
      const isPasture = terrain === 'sheep';
      const coastDirs = coastalEdgeDirs(hex, hexIds);
      const coastalEdges = inlandCoast.map((_, i) => coastDirs.includes(i));
      const geom =
        coastDirs.length > 0 ? hexTileGeometry(tileRadius, coastalEdges) : inlandGeom;

      // Smooth (non-toon) shading so the coastal bevel doesn't get striped by the 4-step toon ramp.
      const mat = standardStylized(STYLIZED_TERRAIN[terrain], { flat: false, roughness: 0.78 });
      mat.side = THREE.DoubleSide;
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(x, 0, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { kind: 'hex', id: hex.id, terrain };
      this.hexMeshes.set(hex.id, mesh);
      this.root.add(mesh);
      this.pickables.push(mesh);

      // Dirt skirt only under fully inland tiles — coastal bevels are the shoreline.
      if (coastDirs.length === 0) {
        const skirt = new THREE.Mesh(
          new THREE.CylinderGeometry(HEX_SIZE * 0.88, HEX_SIZE * 0.9, 0.06, 6),
          toonMat(STYLE.dirt),
        );
        skirt.position.set(x, -0.01, z);
        skirt.receiveShadow = true;
        this.propsGroup.add(skirt);
      }

      // Slightly darker rim on top edge (same pointy-top hex as the tile mesh)
      const rim = new THREE.Mesh(
        rimGeom,
        new THREE.MeshBasicMaterial({
          color: STYLIZED_TERRAIN_SIDE[terrain],
          side: THREE.DoubleSide,
        }),
      );
      rim.position.set(x, TILE_HEIGHT + 0.002, z);
      this.propsGroup.add(rim);

      this.addTerrainProps(terrain, x, z, hex.id);

      if (isPasture) {
        grassPatches.push({ x, z, y: TILE_HEIGHT + 0.005 });
      }

      if (hex.number !== null) {
        const disc = new THREE.Mesh(
          new THREE.CircleGeometry(0.3, 6),
          new THREE.MeshBasicMaterial({ map: numberTexture(hex.number), transparent: true }),
        );
        disc.rotation.x = -Math.PI / 2;
        disc.position.set(x, TILE_HEIGHT + (isPasture ? 0.14 : 0.04), z);
        disc.userData = { kind: 'hex', id: hex.id };
        this.root.add(disc);
        this.pickables.push(disc);
      }
    }

    // Matrices must be current before ground sampling for markers / pieces.
    this.root.updateMatrixWorld(true);

    const bladesPerHex = board.rings <= 2 ? 420 : board.rings === 3 ? 300 : 200;
    this.grass.build(grassPatches, bladesPerHex);

    for (const v of board.vertices.values()) {
      const gy = this.sampleGroundY(v.x, v.z);
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 10, 8),
        new THREE.MeshToonMaterial({
          color: STYLE.highlight,
          gradientMap: getToonGradient(),
          transparent: true,
          opacity: 0,
        }),
      );
      m.position.set(v.x, gy + 0.1, v.z);
      m.userData = { kind: 'vertex', id: v.id };
      this.vertexMarkers.set(v.id, m);
      this.root.add(m);
      this.pickables.push(m);
    }

    for (const e of board.edges.values()) {
      const gy = this.sampleGroundY(e.midX, e.midZ);
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.1, 0.18),
        new THREE.MeshToonMaterial({
          color: STYLE.highlight,
          gradientMap: getToonGradient(),
          transparent: true,
          opacity: 0,
        }),
      );
      m.position.set(e.midX, gy + 0.08, e.midZ);
      m.rotation.y = -e.angle;
      m.userData = { kind: 'edge', id: e.id };
      this.edgeMarkers.set(e.id, m);
      this.root.add(m);
      this.pickables.push(m);
    }

    this.drawHarbors(board);
    this.syncPieces(board);
    this.syncHighlights([], [], []);
  }

  private addTerrainProps(terrain: Terrain, x: number, z: number, id: string): void {
    const rand = seeded(id.split('').reduce((a, c) => a + c.charCodeAt(0), 1));
    const y = TILE_HEIGHT;

    if (terrain === 'wood') {
      for (let i = 0; i < 3; i++) {
        const tree = this.makeTree(0.7 + rand() * 0.4);
        const a = rand() * Math.PI * 2;
        const d = 0.25 + rand() * 0.4;
        tree.position.set(x + Math.cos(a) * d, y, z + Math.sin(a) * d);
        tree.rotation.y = rand() * Math.PI;
        this.propsGroup.add(tree);
      }
    } else if (terrain === 'wheat') {
      for (let i = 0; i < 5; i++) {
        const stalk = new THREE.Mesh(
          new THREE.ConeGeometry(0.05, 0.28, 4),
          toonMat(0xf5d56a),
        );
        const a = rand() * Math.PI * 2;
        const d = 0.2 + rand() * 0.45;
        stalk.position.set(x + Math.cos(a) * d, y + 0.14, z + Math.sin(a) * d);
        stalk.castShadow = true;
        this.propsGroup.add(stalk);
      }
    } else if (terrain === 'ore') {
      for (let i = 0; i < 3; i++) {
        const rock = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.12 + rand() * 0.1, 0),
          toonMat(0x9aa3b5),
        );
        const a = rand() * Math.PI * 2;
        const d = 0.2 + rand() * 0.4;
        rock.position.set(x + Math.cos(a) * d, y + 0.1, z + Math.sin(a) * d);
        rock.rotation.set(rand(), rand(), rand());
        rock.castShadow = true;
        this.propsGroup.add(rock);
      }
    } else if (terrain === 'brick') {
      const mesa = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.35, 0.22, 5),
        toonMat(0xc4683a),
      );
      mesa.position.set(x + (rand() - 0.5) * 0.3, y + 0.11, z + (rand() - 0.5) * 0.3);
      mesa.castShadow = true;
      this.propsGroup.add(mesa);
    } else if (terrain === 'desert') {
      const cactus = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.28, 5), toonMat(0x4aa05a));
      trunk.position.y = 0.14;
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.14, 5), toonMat(0x4aa05a));
      arm.position.set(0.08, 0.18, 0);
      arm.rotation.z = -0.8;
      cactus.add(trunk, arm);
      cactus.position.set(x + 0.25, y, z - 0.15);
      cactus.castShadow = true;
      this.propsGroup.add(cactus);
    }
  }

  private makeTree(scale: number): THREE.Object3D {
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

  private drawHarbors(board: BoardState): void {
    this.harborGroup.clear();
    for (const h of board.harbors) {
      const edge = board.edges.get(h.edgeId);
      if (!edge) continue;
      const outward = new THREE.Vector2(edge.midX, edge.midZ).normalize();
      const px = edge.midX + outward.x * 0.7;
      const pz = edge.midZ + outward.y * 0.7;

      // Little pier / dock
      const pier = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.06, 0.18),
        toonMat(STYLE.woodTrim),
      );
      pier.position.set(px, SEA_LEVEL + 0.05, pz);
      pier.rotation.y = -Math.atan2(outward.y, outward.x);
      pier.castShadow = true;
      this.harborGroup.add(pier);

      const label = h.type === 'generic' ? '3:1' : `2:1 ${h.type[0].toUpperCase()}`;
      const sprite = this.makeLabelSprite(label, h.type === 'generic' ? '#ffe8c0' : '#fff0a8');
      sprite.position.set(px, TILE_HEIGHT + 0.4, pz);
      this.harborGroup.add(sprite);
    }
  }

  private makeLabelSprite(text: string, bg: string): THREE.Sprite {
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
    return s;
  }

  private makeRobber(): THREE.Object3D {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.42, 6), toonMat(0x2a2430));
    body.position.y = 0.24;
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), toonMat(0x3a3444));
    head.position.y = 0.52;
    head.castShadow = true;
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffee88 }));
    eyeL.position.set(-0.05, 0.54, 0.12);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.05;
    g.add(body, head, eyeL, eyeR);
    return g;
  }

  syncPieces(board: BoardState): void {
    for (const mesh of this.buildingMeshes.values()) this.root.remove(mesh);
    this.buildingMeshes.clear();
    for (const mesh of this.roadMeshes.values()) this.root.remove(mesh);
    this.roadMeshes.clear();

    this.root.updateMatrixWorld(true);

    for (const road of board.roads.values()) {
      const e = board.edges.get(road.edgeId)!;
      const gy = this.sampleGroundY(e.midX, e.midZ);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.92, 0.12, 0.2),
        toonMat(STYLIZED_PLAYER[road.owner]),
      );
      mesh.position.set(e.midX, gy + 0.09, e.midZ);
      mesh.rotation.y = -e.angle;
      mesh.castShadow = true;
      this.roadMeshes.set(road.edgeId, mesh);
      this.root.add(mesh);
    }

    for (const b of board.buildings.values()) {
      const v = board.vertices.get(b.vertexId)!;
      const color = STYLIZED_PLAYER[b.owner as PlayerId];
      const piece = b.kind === 'city' ? this.makeCity(color) : this.makeSettlement(color);
      const gy = this.sampleGroundY(v.x, v.z);
      piece.position.set(v.x, gy, v.z);
      this.buildingMeshes.set(b.vertexId, piece);
      this.root.add(piece);
    }

    const robberHex = board.hexes.get(board.robberHexId);
    if (robberHex) {
      const { x, z } = axialToWorld(robberHex.q, robberHex.r);
      const gy = this.sampleGroundY(x + 0.35, z + 0.2);
      this.robber.position.set(x + 0.35, gy, z + 0.2);
    }
  }

  private makeSettlement(color: number): THREE.Object3D {
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

  private makeCity(color: number): THREE.Object3D {
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

  syncHighlights(vertices: string[], edges: string[], hexes: string[]): void {
    for (const [id, m] of this.vertexMarkers) {
      const mat = m.material as THREE.MeshToonMaterial;
      const on = vertices.includes(id);
      mat.opacity = on ? 0.9 : 0;
      mat.color.set(on ? STYLE.highlight : 0xffffff);
      m.visible = on;
    }
    for (const [id, m] of this.edgeMarkers) {
      const mat = m.material as THREE.MeshToonMaterial;
      const on = edges.includes(id);
      mat.opacity = on ? 0.9 : 0;
      mat.color.set(on ? STYLE.highlight : 0xffffff);
      m.visible = on;
    }
    for (const [id, m] of this.hexMeshes) {
      const mat = m.material as THREE.MeshToonMaterial;
      const on = hexes.includes(id);
      mat.emissive.set(on ? 0x665522 : 0x000000);
      mat.emissiveIntensity = on ? 0.45 : 0;
    }
  }

  private clearDynamic(): void {
    this.grass.dispose();
    while (this.root.children.length) this.root.remove(this.root.children[0]);
    this.hexMeshes.clear();
    this.vertexMarkers.clear();
    this.edgeMarkers.clear();
    this.buildingMeshes.clear();
    this.roadMeshes.clear();
    this.harborGroup = new THREE.Group();
    this.propsGroup = new THREE.Group();
    this.robber = this.makeRobber();
    this.root.add(this.water.mesh);
    this.root.add(this.harborGroup);
    this.root.add(this.propsGroup);
    this.root.add(this.robber);
    this.root.add(this.grass.group);
  }
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
