import * as THREE from 'three';
import { HEX_SIZE, axialToWorld, boardRadiusWorld } from '../game/board';
import type { BoardState, PlayerId, Terrain } from '../game/types';
import { boardToRegionGraph } from '../gameplay/regions';
import { PlacementCache } from '../gameplay/placement';
import { generateIsland } from '../terrain/pipeline';
import type { WorldData } from '../world/types';
import { worldSampleBilinear } from '../world/types';
import { createRockScatterGroup } from '../world/rocks';
import { createTreeGroupInstances } from '../world/vegetation';
import { GrassField } from './grass';
import {
  STYLE,
  STYLIZED_PLAYER,
  STYLIZED_TERRAIN,
  STYLIZED_TERRAIN_SIDE,
  getToonGradient,
  toonMat,
} from './style';
import type { AtmosphereSnapshot } from './atmosphere';
import type { StyleConfig } from './styleConfig';
import { DEFAULT_STYLE_CONFIG, styleToWorldPartial } from './styleConfig';
import { IslandTerrainView } from './IslandTerrainView';
import { WaterSurface } from './water';
import type { EnvironmentState } from '../atmosphere/environment';

const TILE_HEIGHT = 0.28;

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

function hexRimGeometry(inner: number, outer: number): THREE.BufferGeometry {
  const shape = hexShape(outer);
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

function numberTexture(n: number): THREE.CanvasTexture {
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

export class BoardView {
  readonly root = new THREE.Group();
  private hexMeshes = new Map<string, THREE.Mesh>();
  private hexGroup = new THREE.Group();
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
  private island = new IslandTerrainView();
  private world: WorldData | null = null;
  private placement: PlacementCache | null = null;
  private style: StyleConfig = { ...DEFAULT_STYLE_CONFIG };
  private lastBoard: BoardState | null = null;

  constructor() {
    this.robber = this.makeRobber();
    this.root.add(this.water.mesh);
    this.root.add(this.island.group);
    this.root.add(this.hexGroup);
    this.root.add(this.harborGroup);
    this.root.add(this.propsGroup);
    this.root.add(this.robber);
    this.root.add(this.grass.group);
  }

  getWorld(): WorldData | null {
    return this.world;
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
    this.style = { ...config };
    this.water.applyConfig(config);
    this.island.applyStyleConfig(config);
    this.hexGroup.visible = config.showHexOverlay;
    for (const mesh of this.hexMeshes.values()) {
      mesh.visible = config.showHexOverlay;
      const mat = mesh.material as THREE.MeshToonMaterial;
      mat.transparent = true;
      mat.opacity = config.showHexOverlay ? 0.55 : 0;
    }
  }

  /** Regenerate organic island from craft Generate knobs. */
  regenerateIsland(board?: BoardState): void {
    const b = board ?? this.lastBoard;
    if (!b) return;
    // Full rebuild so markers / harbors / numbers follow new terrain
    this.build(b);
  }

  applyAtmosphere(_atm: AtmosphereSnapshot): void {
    // Prefer applyEnvironment.
  }

  /** Island/water look from Environment State — never regenerates world data. */
  applyEnvironment(env: EnvironmentState): void {
    this.water.applyEnvironment(env);
    this.island.applyEnvironment(env);
  }

  build(board: BoardState): void {
    this.clearDynamic();
    this.pickables = [];
    this.lastBoard = board;

    this.water.resize(board.rings);
    this.buildIsland(board);

    const showHex = this.style.showHexOverlay;
    this.hexGroup.visible = showHex;

    const tileRadius = HEX_SIZE;
    const geom = new THREE.ExtrudeGeometry(hexShape(tileRadius), {
      depth: TILE_HEIGHT,
      bevelEnabled: false,
    });
    geom.rotateX(-Math.PI / 2);
    geom.computeVertexNormals();
    const rimGeom = hexRimGeometry(tileRadius * 0.9, tileRadius * 0.985);

    for (const hex of board.hexes.values()) {
      const { x, z } = axialToWorld(hex.q, hex.r);
      const terrain = hex.terrain as Terrain;
      const center = this.placement?.hex(x, z) ?? { x, y: this.heightAt(x, z), z, yaw: 0 };
      const groundY = center.y;

      const mat = toonMat(STYLIZED_TERRAIN[terrain]);
      mat.transparent = true;
      mat.opacity = showHex ? 0.55 : 0.0;
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(center.x, groundY, center.z);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.userData = { kind: 'hex', id: hex.id, terrain };
      mesh.visible = showHex;
      this.hexMeshes.set(hex.id, mesh);
      this.hexGroup.add(mesh);
      // Always pickable via invisible proxy at terrain height (graph id, world pose)
      const proxy = new THREE.Mesh(
        new THREE.CircleGeometry(HEX_SIZE * 0.85, 6),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      proxy.rotation.x = -Math.PI / 2;
      proxy.position.set(center.x, groundY + 0.04, center.z);
      proxy.userData = { kind: 'hex', id: hex.id, terrain };
      this.root.add(proxy);
      this.pickables.push(proxy);

      if (showHex) {
        const skirt = new THREE.Mesh(
          new THREE.CylinderGeometry(HEX_SIZE * 0.92, HEX_SIZE * 1.04, 0.08, 6),
          toonMat(STYLE.dirt),
        );
        skirt.position.set(center.x, groundY - 0.02, center.z);
        this.propsGroup.add(skirt);

        const rim = new THREE.Mesh(
          rimGeom,
          new THREE.MeshBasicMaterial({
            color: STYLIZED_TERRAIN_SIDE[terrain],
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.7,
          }),
        );
        rim.position.set(center.x, groundY + TILE_HEIGHT + 0.002, center.z);
        this.propsGroup.add(rim);
      }

      if (hex.number !== null) {
        const disc = new THREE.Mesh(
          new THREE.CircleGeometry(0.28, 6),
          new THREE.MeshBasicMaterial({ map: numberTexture(hex.number), transparent: true }),
        );
        disc.rotation.x = -Math.PI / 2;
        disc.position.set(center.x, groundY + 0.06, center.z);
        disc.userData = { kind: 'hex', id: hex.id };
        this.root.add(disc);
        this.pickables.push(disc);
      }
    }

    for (const v of board.vertices.values()) {
      const pose = this.placement?.vertex(v.id) ?? {
        x: v.x,
        y: this.heightAt(v.x, v.z),
        z: v.z,
        yaw: 0,
      };
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 10, 8),
        new THREE.MeshToonMaterial({
          color: STYLE.highlight,
          gradientMap: getToonGradient(),
          transparent: true,
          opacity: 0,
        }),
      );
      m.position.set(pose.x, pose.y + 0.12, pose.z);
      m.userData = { kind: 'vertex', id: v.id };
      this.vertexMarkers.set(v.id, m);
      this.root.add(m);
      this.pickables.push(m);
    }

    for (const e of board.edges.values()) {
      const samples = this.placement?.road(e.id);
      const mid = samples
        ? samples[Math.floor(samples.length / 2)]!
        : { x: e.midX, y: this.heightAt(e.midX, e.midZ), z: e.midZ };
      let yaw = -e.angle;
      if (samples && samples.length >= 2) {
        const a = samples[0]!;
        const b = samples[samples.length - 1]!;
        yaw = Math.atan2(b.x - a.x, b.z - a.z);
      }
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.1, 0.18),
        new THREE.MeshToonMaterial({
          color: STYLE.highlight,
          gradientMap: getToonGradient(),
          transparent: true,
          opacity: 0,
        }),
      );
      m.position.set(mid.x, mid.y + 0.08, mid.z);
      m.rotation.y = yaw;
      m.userData = { kind: 'edge', id: e.id };
      this.edgeMarkers.set(e.id, m);
      this.root.add(m);
      this.pickables.push(m);
    }

    this.drawHarbors(board);
    this.syncPieces(board);
    this.syncHighlights([], [], []);
  }

  private buildIsland(board: BoardState): void {
    const partial = styleToWorldPartial(this.style);
    const r = boardRadiusWorld(board.rings) * this.style.islandRadiusScale;
    const graph = boardToRegionGraph(board, this.style.islandSeed);
    this.world = generateIsland(
      {
        ...partial,
        island: { ...partial.island, radius: r, seed: this.style.islandSeed },
      },
      board,
      graph,
    );
    this.placement = new PlacementCache(this.world, board);
    this.island.build(this.world, this.style.showSdfOverlay);
    this.island.setScatter(
      createTreeGroupInstances(this.world.trees),
      createRockScatterGroup(this.world.rocks),
    );
    this.water.setIslandSdf(this.world);
  }

  private heightAt(x: number, z: number): number {
    if (!this.world) return TILE_HEIGHT;
    return Math.max(0, worldSampleBilinear(this.world.heightField, this.world.grid, x, z));
  }

  private drawHarbors(board: BoardState): void {
    this.harborGroup.clear();
    for (const h of board.harbors) {
      const pose = this.placement?.harbor(h);
      if (!pose) continue;

      // Wooden pier from shore footing toward ocean tip
      const dx = pose.pierTip.x - pose.x;
      const dz = pose.pierTip.z - pose.z;
      const len = Math.max(0.55, Math.hypot(dx, dz));
      const midX = (pose.x + pose.pierTip.x) * 0.5;
      const midZ = (pose.z + pose.pierTip.z) * 0.5;
      const midY = Math.max(0.05, (pose.y + pose.pierTip.y) * 0.5);

      const pier = new THREE.Mesh(
        new THREE.BoxGeometry(len, 0.07, 0.22),
        toonMat(STYLE.woodTrim),
      );
      pier.position.set(midX, midY, midZ);
      pier.rotation.y = Math.atan2(dx, dz);
      pier.castShadow = true;
      this.harborGroup.add(pier);

      // Pilings at shore + tip
      for (const p of [
        { x: pose.x, z: pose.z, y: pose.y },
        { x: pose.pierTip.x, z: pose.pierTip.z, y: pose.pierTip.y },
      ]) {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.035, 0.04, 0.28, 5),
          toonMat(0x5c3d2e),
        );
        post.position.set(p.x, p.y + 0.08, p.z);
        post.castShadow = true;
        this.harborGroup.add(post);
      }

      const label = h.type === 'generic' ? '3:1' : `2:1 ${h.type[0]!.toUpperCase()}`;
      const sprite = this.makeLabelSprite(label, h.type === 'generic' ? '#ffe8c0' : '#fff0a8');
      sprite.position.set(pose.x, pose.y + 0.55, pose.z);
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

    for (const road of board.roads.values()) {
      const samples = this.placement?.road(road.edgeId);
      if (!samples || samples.length < 2) continue;
      const e = board.edges.get(road.edgeId)!;
      const curvePts = samples.map((p) => new THREE.Vector3(p.x, p.y, p.z));
      const curve = new THREE.CatmullRomCurve3(curvePts);
      const tube = new THREE.TubeGeometry(curve, 12, 0.075, 5, false);
      const mesh = new THREE.Mesh(tube, toonMat(STYLIZED_PLAYER[road.owner]));
      mesh.castShadow = true;
      mesh.userData = { edgeId: road.edgeId, angle: e.angle };
      this.roadMeshes.set(road.edgeId, mesh);
      this.root.add(mesh);
    }

    for (const b of board.buildings.values()) {
      const pose = this.placement?.vertex(b.vertexId);
      const v = board.vertices.get(b.vertexId)!;
      const color = STYLIZED_PLAYER[b.owner as PlayerId];
      const piece = b.kind === 'city' ? this.makeCity(color) : this.makeSettlement(color);
      const x = pose?.x ?? v.x;
      const z = pose?.z ?? v.z;
      const y = pose?.y ?? this.heightAt(v.x, v.z);

      // Small dirt pad so buildings read as founded, not floating
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.32, 0.06, 6),
        toonMat(STYLE.dirt),
      );
      pad.position.set(x, y + 0.02, z);
      pad.receiveShadow = true;
      piece.position.set(x, y + 0.05, z);
      const group = new THREE.Group();
      group.add(pad, piece);
      this.buildingMeshes.set(b.vertexId, group);
      this.root.add(group);
    }

    const robberHex = board.hexes.get(board.robberHexId);
    if (robberHex) {
      const { x, z } = axialToWorld(robberHex.q, robberHex.r);
      const pose = this.placement?.hex(x + 0.25, z + 0.15) ?? {
        x: x + 0.25,
        y: this.heightAt(x + 0.35, z + 0.2),
        z: z + 0.15,
        yaw: 0,
      };
      this.robber.position.set(pose.x, pose.y, pose.z);
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
    this.island.dispose();
    this.water.clearIslandSdf();
    while (this.root.children.length) this.root.remove(this.root.children[0]!);
    this.hexMeshes.clear();
    this.vertexMarkers.clear();
    this.edgeMarkers.clear();
    this.buildingMeshes.clear();
    this.roadMeshes.clear();
    this.world = null;
    this.placement = null;
    this.hexGroup = new THREE.Group();
    this.harborGroup = new THREE.Group();
    this.propsGroup = new THREE.Group();
    this.robber = this.makeRobber();
    this.root.add(this.water.mesh);
    this.root.add(this.island.group);
    this.root.add(this.hexGroup);
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
