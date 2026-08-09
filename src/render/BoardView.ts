import * as THREE from 'three';
import { HEX_SIZE, axialToWorld } from '../game/board';
import type { BoardState, PlayerId, Terrain } from '../game/types';
import {
  TILE_HEIGHT,
  hexShape,
  makeBush,
  makeCactus,
  makeCity,
  makeFlowerTuft,
  makeLabelSprite,
  makeMesa,
  makePastureRock,
  makePine,
  makeRoad,
  makeRobber,
  makeRock,
  makeSettlement,
  makeSheep,
  makeStoneWall,
  makeTree,
  makeWheatStalk,
  numberTexture,
} from './assets';
import {
  STYLE,
  STYLIZED_PLAYER,
  STYLIZED_TERRAIN,
  STYLIZED_TERRAIN_SIDE,
  getMeadowFloorMaterial,
  getToonGradient,
  toonMat,
} from './style';
import type { AtmosphereSnapshot } from './atmosphere';
import type { StyleConfig } from './styleConfig';
import { DEFAULT_STYLE_CONFIG } from './styleConfig';
import { TweenPlayer, ease } from './tween';
import { WaterSurface } from './water';

/**
 * ExtrudeGeometry lid UVs are raw shape XY (≈[-r,r]), so textures never sample.
 * Remap materialIndex 0 (top/bottom lids in three@r172) into 0–1 from world XZ after rotateX.
 * materialIndex 1 is the vertical sides.
 */
function remapExtrudeLidUVs(geom: THREE.BufferGeometry, radius: number): void {
  const pos = geom.attributes.position;
  const uv = geom.attributes.uv;
  if (!pos || !uv) return;
  const span = radius * 2;
  for (const group of geom.groups) {
    if (group.materialIndex !== 0) continue;
    for (let i = group.start; i < group.start + group.count; i++) {
      uv.setXY(i, pos.getX(i) / span + 0.5, pos.getZ(i) / span + 0.5);
    }
  }
  uv.needsUpdate = true;
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

function seeded(n: number): () => number {
  let s = (n * 16807) % 2147483647;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

type BuildingKind = 'settlement' | 'city';

interface BuildingEntry {
  mesh: THREE.Object3D;
  kind: BuildingKind;
  owner: PlayerId;
  restingY: number;
  restingScale: number;
}

interface RoadEntry {
  mesh: THREE.Mesh;
  owner: PlayerId;
  restingScale: number;
}

interface HexVisual {
  mesh: THREE.Mesh;
  restingY: number;
  baseEmissive: number;
  numberToken: THREE.Mesh | null;
  numberRestY: number;
  baseColors?: THREE.Color[];
}

/** MeshToonMaterials on a hex (single or Extrude side+lid pair). */
function hexToonMats(mesh: THREE.Mesh): THREE.MeshToonMaterial[] {
  const m = mesh.material;
  if (Array.isArray(m)) {
    return m.filter((x): x is THREE.MeshToonMaterial => x instanceof THREE.MeshToonMaterial);
  }
  return m instanceof THREE.MeshToonMaterial ? [m] : [];
}

export class BoardView {
  readonly root = new THREE.Group();
  private hexMeshes = new Map<string, THREE.Mesh>();
  private hexVisuals = new Map<string, HexVisual>();
  private vertexMarkers = new Map<string, THREE.Mesh>();
  private edgeMarkers = new Map<string, THREE.Mesh>();
  private buildings = new Map<string, BuildingEntry>();
  private roads = new Map<string, RoadEntry>();
  private robber: THREE.Object3D;
  private harborGroup = new THREE.Group();
  private harborSprites: THREE.Sprite[] = [];
  private propsGroup = new THREE.Group();
  private pickables: THREE.Object3D[] = [];
  private water = new WaterSurface();
  private tweens = new TweenPlayer();

  private legalVertices = new Set<string>();
  private legalEdges = new Set<string>();
  private legalHexes = new Set<string>();
  private hoverHexId: string | null = null;
  private productionPulse = new Map<string, number>();
  private robberHopping = false;
  private robberTargetHex: string | null = null;
  private elapsed = 0;
  private motion = {
    hoverLift: DEFAULT_STYLE_CONFIG.hexHoverLift,
    highlightFade: DEFAULT_STYLE_CONFIG.motionHighlightFade,
    pieceSpawnSec: DEFAULT_STYLE_CONFIG.motionPieceSpawnSec,
    roadSpawnSec: DEFAULT_STYLE_CONFIG.motionRoadSpawnSec,
    upgradeSec: DEFAULT_STYLE_CONFIG.motionUpgradeSec,
    robberHopSec: DEFAULT_STYLE_CONFIG.motionRobberHopSec,
    productionPulseSec: DEFAULT_STYLE_CONFIG.productionPulseSec,
    productionPulseStrength: DEFAULT_STYLE_CONFIG.productionPulseStrength,
    harborBobAmp: DEFAULT_STYLE_CONFIG.harborBobAmp,
  };

  constructor() {
    this.robber = makeRobber();
    this.root.add(this.water.mesh);
    this.root.add(this.harborGroup);
    this.root.add(this.propsGroup);
    this.root.add(this.robber);
  }

  getPickables(): THREE.Object3D[] {
    return this.pickables;
  }

  getRobberPosition(out = new THREE.Vector3()): THREE.Vector3 {
    return out.copy(this.robber.position);
  }

  setHoverHex(id: string | null): void {
    if (this.hoverHexId === id) return;
    this.hoverHexId = id;
  }

  /** Soft pulse on number tokens / hexes that match the dice total. */
  pulseProduction(total: number): void {
    if (total < 2 || total === 7) return;
    for (const [id, vis] of this.hexVisuals) {
      const hexNum = vis.mesh.userData.number as number | null | undefined;
      if (hexNum === total) {
        this.productionPulse.set(id, this.motion.productionPulseSec);
      }
    }
  }

  update(time: number, dt = 1 / 60): void {
    this.elapsed = time;
    this.tweens.update(dt);
    this.water.update(time);
    this.updateHighlightFade(dt);
    this.updateHoverAndPulse(dt);
    this.updateHarborBob(time);
  }

  setSunDirection(dir: THREE.Vector3): void {
    this.water.setSunDirection(dir);
  }

  applyStyleConfig(config: StyleConfig): void {
    this.water.applyConfig(config);
    this.motion = {
      hoverLift: config.hexHoverLift,
      highlightFade: config.motionHighlightFade,
      pieceSpawnSec: config.motionPieceSpawnSec,
      roadSpawnSec: config.motionRoadSpawnSec,
      upgradeSec: config.motionUpgradeSec,
      robberHopSec: config.motionRobberHopSec,
      productionPulseSec: config.productionPulseSec,
      productionPulseStrength: config.productionPulseStrength,
      harborBobAmp: config.harborBobAmp,
    };
  }

  /** Bruno-like mirrored reflection pass — call before the main render. */
  renderWaterReflection(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ): void {
    // Harbor sprites/piers read as flat yellow rectangles in the mirror — skip them.
    const harborsWereVisible = this.harborGroup.visible;
    this.harborGroup.visible = false;
    this.water.renderReflection(renderer, scene, camera);
    this.harborGroup.visible = harborsWereVisible;
  }

  applyAtmosphere(atm: AtmosphereSnapshot): void {
    this.water.applyAtmosphere(atm);
    this.applyBoardTint(atm);
  }

  private applyBoardTint(atm: AtmosphereSnapshot): void {
    const mix = atm.boardTintMix;
    const tint = atm.beachTint;
    for (const vis of this.hexVisuals.values()) {
      const mats = hexToonMats(vis.mesh);
      if (!vis.baseColors) vis.baseColors = mats.map((mat) => mat.color.clone());
      mats.forEach((mat, i) => {
        const base = vis.baseColors![i] ?? mat.color.clone();
        vis.baseColors![i] = base;
        mat.color.copy(base).lerp(tint, mix);
      });
    }
    for (const child of this.propsGroup.children) {
      child.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;
        const mat = obj.material;
        if (!(mat instanceof THREE.MeshToonMaterial) && !(mat instanceof THREE.MeshBasicMaterial)) return;
        const stored = obj.userData.baseColor as THREE.Color | undefined;
        const base = stored ?? mat.color.clone();
        obj.userData.baseColor = base;
        mat.color.copy(base).lerp(tint, mix * 0.65);
      });
    }
  }

  build(board: BoardState): void {
    this.clearDynamic();
    this.pickables = [];
    this.tweens.clear();

    this.water.resize(board.rings);
    const landCenters: { x: number; z: number }[] = [];
    for (const hex of board.hexes.values()) {
      landCenters.push(axialToWorld(hex.q, hex.r));
    }
    this.water.setLandHexes(landCenters, HEX_SIZE);
    this.root.add(this.water.mesh);

    // Full HEX_SIZE so neighbors meet edge-to-edge (matches axialToWorld / hexCorner spacing).
    const tileRadius = HEX_SIZE;
    const geom = new THREE.ExtrudeGeometry(hexShape(tileRadius), {
      depth: TILE_HEIGHT,
      bevelEnabled: false,
    });
    geom.rotateX(-Math.PI / 2);
    // Soften normals for chunkier toon look on sides
    geom.computeVertexNormals();
    // Pasture map needs 0–1 lid UVs (Extrude defaults to raw shape coords).
    remapExtrudeLidUVs(geom, tileRadius);
    const rimGeom = hexRimGeometry(tileRadius * 0.9, tileRadius * 0.985);
    const meadowTopProto = getMeadowFloorMaterial();

    for (const hex of board.hexes.values()) {
      const { x, z } = axialToWorld(hex.q, hex.r);
      const terrain = hex.terrain as Terrain;

      // Sheep: Extrude groups are [lids=0, sides=1] in three@r172 — meadow on top.
      // Clone lid mat so emissive/hover stays per-hex (map texture still shared).
      const mat: THREE.Material | THREE.Material[] =
        terrain === 'sheep'
          ? [meadowTopProto.clone(), toonMat(STYLIZED_TERRAIN_SIDE.sheep)]
          : toonMat(STYLIZED_TERRAIN[terrain]);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(x, 0, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { kind: 'hex', id: hex.id, terrain, number: hex.number };
      this.hexMeshes.set(hex.id, mesh);
      this.root.add(mesh);
      this.pickables.push(mesh);

      let numberToken: THREE.Mesh | null = null;
      let numberRestY = TILE_HEIGHT + 0.04;

      // Foundation under each hex — deep dirt pedestal so coasts never float over open water.
      const skirt = new THREE.Mesh(
        new THREE.CylinderGeometry(HEX_SIZE * 0.94, HEX_SIZE * 1.08, 0.22, 6),
        toonMat(STYLE.dirt),
      );
      skirt.position.set(x, -0.1, z);
      skirt.receiveShadow = true;
      this.propsGroup.add(skirt);

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

      if (hex.number !== null) {
        numberRestY = TILE_HEIGHT + 0.04;
        numberToken = new THREE.Mesh(
          new THREE.CircleGeometry(0.3, 6),
          new THREE.MeshBasicMaterial({ map: numberTexture(hex.number), transparent: true }),
        );
        numberToken.rotation.x = -Math.PI / 2;
        numberToken.position.set(x, numberRestY, z);
        numberToken.userData = { kind: 'hex', id: hex.id };
        this.root.add(numberToken);
        this.pickables.push(numberToken);
      }

      this.hexVisuals.set(hex.id, {
        mesh,
        restingY: 0,
        baseEmissive: 0,
        numberToken,
        numberRestY,
      });
    }

    for (const v of board.vertices.values()) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 10, 8),
        new THREE.MeshToonMaterial({
          color: STYLE.highlight,
          gradientMap: getToonGradient(),
          transparent: true,
          opacity: 0,
        }),
      );
      m.position.set(v.x, TILE_HEIGHT + 0.1, v.z);
      m.userData = { kind: 'vertex', id: v.id };
      this.vertexMarkers.set(v.id, m);
      this.root.add(m);
      this.pickables.push(m);
    }

    for (const e of board.edges.values()) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.1, 0.18),
        new THREE.MeshToonMaterial({
          color: STYLE.highlight,
          gradientMap: getToonGradient(),
          transparent: true,
          opacity: 0,
        }),
      );
      m.position.set(e.midX, TILE_HEIGHT + 0.08, e.midZ);
      m.rotation.y = -e.angle;
      m.userData = { kind: 'edge', id: e.id };
      this.edgeMarkers.set(e.id, m);
      this.root.add(m);
      this.pickables.push(m);
    }

    this.drawHarbors(board);
    this.syncPieces(board, false);
    this.syncHighlights([], [], []);
  }

  private addTerrainProps(terrain: Terrain, x: number, z: number, id: string): void {
    const rand = seeded(id.split('').reduce((a, c) => a + c.charCodeAt(0), 1));
    const y = TILE_HEIGHT;

    switch (terrain) {
      case 'wood': {
        for (let i = 0; i < 3; i++) {
          const tree = makeTree({ scale: 0.7 + rand() * 0.4 });
          const a = rand() * Math.PI * 2;
          const d = 0.25 + rand() * 0.4;
          tree.position.set(x + Math.cos(a) * d, y, z + Math.sin(a) * d);
          tree.rotation.y = rand() * Math.PI;
          this.propsGroup.add(tree);
        }
        break;
      }
      case 'wheat': {
        for (let i = 0; i < 5; i++) {
          const stalk = makeWheatStalk();
          const a = rand() * Math.PI * 2;
          const d = 0.2 + rand() * 0.45;
          stalk.position.set(x + Math.cos(a) * d, y, z + Math.sin(a) * d);
          this.propsGroup.add(stalk);
        }
        break;
      }
      case 'ore': {
        for (let i = 0; i < 3; i++) {
          const rockScale = 0.85 + rand() * 0.7;
          const rock = makeRock({ scale: rockScale });
          const a = rand() * Math.PI * 2;
          const d = 0.2 + rand() * 0.4;
          rock.position.set(x + Math.cos(a) * d, y + rock.position.y, z + Math.sin(a) * d);
          rock.rotation.set(rand(), rand(), rand());
          this.propsGroup.add(rock);
        }
        break;
      }
      case 'brick': {
        const mesa = makeMesa();
        mesa.position.set(x + (rand() - 0.5) * 0.3, y + mesa.position.y, z + (rand() - 0.5) * 0.3);
        this.propsGroup.add(mesa);
        break;
      }
      case 'desert': {
        const cactus = makeCactus();
        cactus.position.set(x + 0.25, y, z - 0.15);
        this.propsGroup.add(cactus);
        break;
      }
      case 'sheep': {
        // Sheep grassland concept: flock + stone enclosure + meadow clutter
        const sheepCount = 4 + Math.floor(rand() * 3);
        for (let i = 0; i < sheepCount; i++) {
          const sheep = makeSheep({ variant: Math.floor(rand() * 4) });
          const a = rand() * Math.PI * 2;
          const d = 0.22 + rand() * 0.4;
          sheep.position.set(x + Math.cos(a) * d, y, z + Math.sin(a) * d);
          sheep.rotation.y = rand() * Math.PI * 2;
          sheep.scale.setScalar(0.9 + rand() * 0.28);
          this.propsGroup.add(sheep);
        }

        // Low stone walls along hex edges (inset so roads/settlements stay clear)
        for (let e = 0; e < 6; e++) {
          if (rand() > 0.62) continue;
          const a = (e * Math.PI) / 3;
          const d = HEX_SIZE * 0.72;
          const wall = makeStoneWall({
            variant: rand() > 0.7 ? 1 : rand() > 0.5 ? 2 : 0,
            scale: 0.95 + rand() * 0.15,
          });
          wall.position.set(x + Math.cos(a) * d, y, z + Math.sin(a) * d);
          wall.rotation.y = a + Math.PI * 0.5;
          this.propsGroup.add(wall);
        }

        const bushCount = 2 + Math.floor(rand() * 3);
        for (let i = 0; i < bushCount; i++) {
          const bush = makeBush({ variant: Math.floor(rand() * 3), scale: 0.85 + rand() * 0.35 });
          const a = rand() * Math.PI * 2;
          const d = 0.35 + rand() * 0.38;
          bush.position.set(x + Math.cos(a) * d, y, z + Math.sin(a) * d);
          bush.rotation.y = rand() * Math.PI;
          this.propsGroup.add(bush);
        }

        const rockCount = 1 + Math.floor(rand() * 3);
        for (let i = 0; i < rockCount; i++) {
          const rock = makePastureRock({
            variant: Math.floor(rand() * 4),
            scale: 0.85 + rand() * 0.4,
          });
          const a = rand() * Math.PI * 2;
          const d = 0.3 + rand() * 0.4;
          rock.position.set(x + Math.cos(a) * d, y, z + Math.sin(a) * d);
          rock.rotation.y = rand() * Math.PI;
          this.propsGroup.add(rock);
        }

        if (rand() > 0.35) {
          const flowers = 1 + Math.floor(rand() * 2);
          for (let i = 0; i < flowers; i++) {
            const tuft = makeFlowerTuft({ variant: Math.floor(rand() * 2) });
            const a = rand() * Math.PI * 2;
            const d = 0.25 + rand() * 0.4;
            tuft.position.set(x + Math.cos(a) * d, y, z + Math.sin(a) * d);
            this.propsGroup.add(tuft);
          }
        }

        if (rand() > 0.4) {
          const pine = makePine({ scale: 0.55 + rand() * 0.25 });
          const a = rand() * Math.PI * 2;
          const d = 0.42 + rand() * 0.28;
          pine.position.set(x + Math.cos(a) * d, y, z + Math.sin(a) * d);
          pine.rotation.y = rand() * Math.PI;
          this.propsGroup.add(pine);
        }
        break;
      }
      default: {
        const _exhaustive: never = terrain;
        void _exhaustive;
        break;
      }
    }
  }

  private drawHarbors(board: BoardState): void {
    this.harborGroup.clear();
    this.harborSprites = [];
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
      pier.position.set(px, 0.02, pz);
      pier.rotation.y = -Math.atan2(outward.y, outward.x);
      pier.castShadow = true;
      this.harborGroup.add(pier);

      const label = h.type === 'generic' ? '3:1' : `2:1 ${h.type[0].toUpperCase()}`;
      const sprite = makeLabelSprite(label, h.type === 'generic' ? '#ffe8c0' : '#fff0a8');
      const bobBaseY = TILE_HEIGHT + 0.4;
      sprite.position.set(px, bobBaseY, pz);
      sprite.userData.bobPhase = Math.atan2(pz, px);
      sprite.userData.bobBaseY = bobBaseY;
      this.harborSprites.push(sprite);
      this.harborGroup.add(sprite);
    }
  }

  syncPieces(board: BoardState, animate = true): void {
    this.syncRoads(board, animate);
    this.syncBuildings(board, animate);
    this.syncRobber(board, animate);
  }

  private syncRoads(board: BoardState, animate: boolean): void {
    const keep = new Set<string>();
    for (const road of board.roads.values()) {
      keep.add(road.edgeId);
      const existing = this.roads.get(road.edgeId);
      if (existing && existing.owner === road.owner) continue;

      if (existing) {
        this.root.remove(existing.mesh);
        this.roads.delete(road.edgeId);
      }

      const e = board.edges.get(road.edgeId)!;
      const mesh = makeRoad({ color: STYLIZED_PLAYER[road.owner] });
      mesh.position.set(e.midX, TILE_HEIGHT + 0.09, e.midZ);
      mesh.rotation.y = -e.angle;
      const restingScale = 1;
      mesh.scale.set(0.15, 0.15, 0.15);
      this.roads.set(road.edgeId, { mesh, owner: road.owner, restingScale });
      this.root.add(mesh);

      if (animate) {
        this.tweens.play(
          this.motion.roadSpawnSec,
          (u) => {
            const s = 0.15 + (restingScale - 0.15) * u;
            mesh.scale.set(s, s * (0.6 + 0.4 * u), s);
            mesh.position.y = TILE_HEIGHT + 0.09 + (1 - u) * 0.18;
          },
          {
            ease: ease.easeOutBack,
            onComplete: () => {
              mesh.scale.setScalar(restingScale);
              mesh.position.y = TILE_HEIGHT + 0.09;
            },
          },
        );
      } else {
        mesh.scale.setScalar(restingScale);
      }
    }

    for (const [id, entry] of this.roads) {
      if (keep.has(id)) continue;
      this.root.remove(entry.mesh);
      this.roads.delete(id);
    }
  }

  private syncBuildings(board: BoardState, animate: boolean): void {
    const keep = new Set<string>();
    for (const b of board.buildings.values()) {
      keep.add(b.vertexId);
      const v = board.vertices.get(b.vertexId)!;
      const color = STYLIZED_PLAYER[b.owner as PlayerId];
      const existing = this.buildings.get(b.vertexId);

      if (existing && existing.kind === b.kind && existing.owner === b.owner) continue;

      // Upgrade settlement → city with a short morph.
      if (existing && existing.kind === 'settlement' && b.kind === 'city' && existing.owner === b.owner) {
        const old = existing.mesh;
        const city = makeCity({ color });
        const restingScale = 1.1;
        city.position.set(v.x, TILE_HEIGHT, v.z);
        city.scale.setScalar(0.01);
        this.root.add(city);
        this.buildings.set(b.vertexId, {
          mesh: city,
          kind: 'city',
          owner: b.owner,
          restingY: TILE_HEIGHT,
          restingScale,
        });

        if (animate) {
          this.tweens.play(
            this.motion.upgradeSec,
            (u) => {
              old.scale.setScalar(existing.restingScale * (1 - u * 0.85));
              old.position.y = TILE_HEIGHT + u * 0.35;
              city.scale.setScalar(restingScale * ease.easeOutBack(u));
              city.position.y = TILE_HEIGHT + (1 - u) * 0.45;
            },
            {
              ease: ease.linear,
              onComplete: () => {
                this.root.remove(old);
                city.scale.setScalar(restingScale);
                city.position.y = TILE_HEIGHT;
              },
            },
          );
        } else {
          this.root.remove(old);
          city.scale.setScalar(restingScale);
        }
        continue;
      }

      if (existing) {
        this.root.remove(existing.mesh);
        this.buildings.delete(b.vertexId);
      }

      const piece = b.kind === 'city' ? makeCity({ color }) : makeSettlement({ color });
      // makeSettlement/City already bake scale — animate from near-zero up to that.
      const baked = piece.scale.x;
      piece.scale.setScalar(0.01);
      piece.position.set(v.x, TILE_HEIGHT + (animate ? 0.55 : 0), v.z);
      this.buildings.set(b.vertexId, {
        mesh: piece,
        kind: b.kind,
        owner: b.owner,
        restingY: TILE_HEIGHT,
        restingScale: baked,
      });
      this.root.add(piece);

      if (animate) {
        this.tweens.play(
          this.motion.pieceSpawnSec,
          (u) => {
            piece.scale.setScalar(baked * u);
            piece.position.y = TILE_HEIGHT + (1 - u) * 0.55 - Math.sin(u * Math.PI) * 0.08 * (1 - u);
          },
          {
            ease: ease.easeOutBack,
            onComplete: () => {
              piece.scale.setScalar(baked);
              piece.position.y = TILE_HEIGHT;
            },
          },
        );
      } else {
        piece.scale.setScalar(baked);
        piece.position.y = TILE_HEIGHT;
      }
    }

    for (const [id, entry] of this.buildings) {
      if (keep.has(id)) continue;
      this.root.remove(entry.mesh);
      this.buildings.delete(id);
    }
  }

  private syncRobber(board: BoardState, animate: boolean): void {
    const robberHex = board.hexes.get(board.robberHexId);
    if (!robberHex) return;
    const { x, z } = axialToWorld(robberHex.q, robberHex.r);
    const tx = x + 0.35;
    const tz = z + 0.2;
    const ty = TILE_HEIGHT;

    if (this.robberTargetHex === board.robberHexId && (this.robberHopping || !animate)) {
      if (!animate && !this.robberHopping) {
        this.robber.position.set(tx, ty, tz);
      }
      return;
    }

    const dx = tx - this.robber.position.x;
    const dz = tz - this.robber.position.z;
    const dist = Math.hypot(dx, dz);
    this.robberTargetHex = board.robberHexId;

    if (!animate || dist < 0.05) {
      this.robber.position.set(tx, ty, tz);
      this.robber.scale.set(1, 1, 1);
      this.robberHopping = false;
      return;
    }

    const from = this.robber.position.clone();
    this.robberHopping = true;
    this.tweens.play(
      this.motion.robberHopSec,
      (u) => {
        const s = ease.easeInOutCubic(u);
        this.robber.position.x = from.x + (tx - from.x) * s;
        this.robber.position.z = from.z + (tz - from.z) * s;
        const arc = Math.sin(u * Math.PI) * Math.min(0.85, 0.35 + dist * 0.12);
        this.robber.position.y = ty + arc;
        this.robber.rotation.y = Math.atan2(tx - from.x, tz - from.z) * 0.15 * Math.sin(u * Math.PI);
      },
      {
        ease: ease.linear,
        onComplete: () => {
          this.robber.position.set(tx, ty, tz);
          this.robber.rotation.y = 0;
          this.robberHopping = false;
          this.tweens.play(
            0.14,
            (u) => {
              const squash = 1 - Math.sin(u * Math.PI) * 0.12;
              this.robber.scale.set(1 / squash, squash, 1 / squash);
            },
            {
              ease: ease.easeOutQuad,
              onComplete: () => this.robber.scale.set(1, 1, 1),
            },
          );
        },
      },
    );
  }

  syncHighlights(vertices: string[], edges: string[], hexes: string[]): void {
    this.legalVertices = new Set(vertices);
    this.legalEdges = new Set(edges);
    this.legalHexes = new Set(hexes);

    for (const [id, m] of this.vertexMarkers) {
      const on = this.legalVertices.has(id);
      const mat = m.material as THREE.MeshToonMaterial;
      mat.color.set(on ? STYLE.highlight : 0xffffff);
      if (on) m.visible = true;
    }
    for (const [id, m] of this.edgeMarkers) {
      const on = this.legalEdges.has(id);
      const mat = m.material as THREE.MeshToonMaterial;
      mat.color.set(on ? STYLE.highlight : 0xffffff);
      if (on) m.visible = true;
    }
    for (const [id, vis] of this.hexVisuals) {
      const on = this.legalHexes.has(id);
      for (const mat of hexToonMats(vis.mesh)) {
        mat.emissive.set(on ? 0x665522 : 0x000000);
      }
    }
  }

  private updateHighlightFade(dt: number): void {
    const pulse = 0.82 + Math.sin(this.elapsed * 3.2) * 0.1;
    const step = 1 - Math.exp(-this.motion.highlightFade * dt);

    for (const [id, m] of this.vertexMarkers) {
      const mat = m.material as THREE.MeshToonMaterial;
      const target = this.legalVertices.has(id) ? 0.88 * pulse : 0;
      mat.opacity += (target - mat.opacity) * step;
      m.visible = mat.opacity > 0.02;
      if (this.legalVertices.has(id)) {
        m.position.y = TILE_HEIGHT + 0.1 + Math.sin(this.elapsed * 4 + id.length) * 0.02;
      } else {
        m.position.y = TILE_HEIGHT + 0.1;
      }
    }

    for (const [id, m] of this.edgeMarkers) {
      const mat = m.material as THREE.MeshToonMaterial;
      const target = this.legalEdges.has(id) ? 0.88 * pulse : 0;
      mat.opacity += (target - mat.opacity) * step;
      m.visible = mat.opacity > 0.02;
    }

    for (const [id, vis] of this.hexVisuals) {
      const target = this.legalHexes.has(id) ? 0.42 * pulse : 0;
      for (const mat of hexToonMats(vis.mesh)) {
        mat.emissiveIntensity += (target - mat.emissiveIntensity) * step;
      }
    }
  }

  private updateHoverAndPulse(dt: number): void {
    const step = 1 - Math.exp(-10 * dt);

    for (const [id, vis] of this.hexVisuals) {
      // Keep hex Y locked — vertical hover lift made the island look floating/bobbing,
      // especially while orbiting on touch. Hover is emissive-only.
      vis.mesh.position.y = vis.restingY;

      const hovered = this.hoverHexId === id;
      const mats = hexToonMats(vis.mesh);
      if (hovered && !this.legalHexes.has(id)) {
        const lift = Math.min(0.22, this.motion.hoverLift * 4);
        for (const mat of mats) {
          mat.emissive.set(0x445566);
          mat.emissiveIntensity = Math.max(mat.emissiveIntensity, lift);
        }
      }

      let pulse = this.productionPulse.get(id) ?? 0;
      if (pulse > 0) {
        pulse = Math.max(0, pulse - dt);
        this.productionPulse.set(id, pulse);
        const wave = Math.sin((this.motion.productionPulseSec - pulse) * Math.PI * 3) * Math.min(1, pulse * 2);
        const boost = Math.max(0, wave) * this.motion.productionPulseStrength;
        if (!this.legalHexes.has(id)) {
          for (const mat of mats) {
            mat.emissive.set(0x886622);
            mat.emissiveIntensity = Math.max(mat.emissiveIntensity, boost);
          }
        }
        if (vis.numberToken) {
          const bob = Math.max(0, wave) * 0.08;
          const scale = 1 + Math.max(0, wave) * (0.12 + this.motion.productionPulseStrength * 0.2);
          vis.numberToken.position.y = vis.numberRestY + bob;
          vis.numberToken.scale.setScalar(scale);
        }
      } else if (vis.numberToken) {
        vis.numberToken.position.y += (vis.numberRestY - vis.numberToken.position.y) * step;
        const s = vis.numberToken.scale.x;
        const ns = s + (1 - s) * step;
        vis.numberToken.scale.setScalar(ns);
      }
    }
  }

  private updateHarborBob(time: number): void {
    for (const sprite of this.harborSprites) {
      const base = (sprite.userData.bobBaseY as number) ?? TILE_HEIGHT + 0.4;
      const phase = (sprite.userData.bobPhase as number) ?? 0;
      sprite.position.y = base + Math.sin(time * 1.4 + phase) * this.motion.harborBobAmp;
    }
  }

  private clearDynamic(): void {
    this.tweens.clear();
    while (this.root.children.length) this.root.remove(this.root.children[0]);
    this.hexMeshes.clear();
    this.hexVisuals.clear();
    this.vertexMarkers.clear();
    this.edgeMarkers.clear();
    this.buildings.clear();
    this.roads.clear();
    this.harborSprites = [];
    this.productionPulse.clear();
    this.legalVertices.clear();
    this.legalEdges.clear();
    this.legalHexes.clear();
    this.hoverHexId = null;
    this.robberHopping = false;
    this.robberTargetHex = null;
    this.harborGroup = new THREE.Group();
    this.propsGroup = new THREE.Group();
    this.robber = makeRobber();
    this.root.add(this.water.mesh);
    this.root.add(this.harborGroup);
    this.root.add(this.propsGroup);
    this.root.add(this.robber);
  }
}
