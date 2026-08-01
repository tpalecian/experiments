import * as THREE from 'three';
import { HEX_SIZE, axialToWorld, boardRadiusWorld } from '../game/board';
import type { BoardState, PlayerId, Terrain } from '../game/types';
import { PLAYER_COLORS, TERRAIN_COLORS } from '../game/types';
import { GrassField } from './grass';
import { WaterSurface } from './water';

const TILE_HEIGHT = 0.22;

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

function numberTexture(n: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 128, 128);
  ctx.beginPath();
  ctx.arc(64, 64, 56, 0, Math.PI * 2);
  ctx.fillStyle = '#f3e6c8';
  ctx.fill();
  ctx.strokeStyle = '#3a2f1e';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = n === 6 || n === 8 ? '#b91c1c' : '#1c1917';
  ctx.font = 'bold 64px Fraunces, Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(n), 64, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
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
  private pickables: THREE.Object3D[] = [];
  private grass = new GrassField();
  private water = new WaterSurface();

  constructor() {
    this.robber = this.makeRobber();
    this.root.add(this.water.mesh);
    this.root.add(this.harborGroup);
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

  build(board: BoardState): void {
    this.clearDynamic();
    this.pickables = [];

    const landR = boardRadiusWorld(board.rings);
    this.water.resize(landR);
    this.root.add(this.water.mesh);

    const geom = new THREE.ExtrudeGeometry(hexShape(HEX_SIZE * 0.95), {
      depth: TILE_HEIGHT,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 1,
    });
    geom.rotateX(-Math.PI / 2);

    const grassPatches: { x: number; z: number; y: number }[] = [];

    for (const hex of board.hexes.values()) {
      const { x, z } = axialToWorld(hex.q, hex.r);
      const isPasture = hex.terrain === 'sheep';
      const mat = new THREE.MeshStandardMaterial({
        color: isPasture ? 0x3d6b2e : TERRAIN_COLORS[hex.terrain as Terrain],
        roughness: 0.85,
        metalness: 0.02,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(x, 0, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { kind: 'hex', id: hex.id };
      this.hexMeshes.set(hex.id, mesh);
      this.root.add(mesh);
      this.pickables.push(mesh);

      if (isPasture) {
        grassPatches.push({ x, z, y: TILE_HEIGHT + 0.005 });
      }

      if (hex.number !== null) {
        const disc = new THREE.Mesh(
          new THREE.CircleGeometry(0.28, 32),
          new THREE.MeshBasicMaterial({ map: numberTexture(hex.number), transparent: true }),
        );
        disc.rotation.x = -Math.PI / 2;
        disc.position.set(x, TILE_HEIGHT + (isPasture ? 0.12 : 0.03), z);
        disc.userData = { kind: 'hex', id: hex.id };
        this.root.add(disc);
        this.pickables.push(disc);
      }
    }

    // Density scales down a bit on huge maps so wind stays smooth
    const bladesPerHex = board.rings <= 2 ? 520 : board.rings === 3 ? 380 : 260;
    this.grass.build(grassPatches, bladesPerHex);

    for (const v of board.vertices.values()) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 16, 12),
        new THREE.MeshStandardMaterial({
          color: 0xf5f0e6,
          transparent: true,
          opacity: 0,
          roughness: 0.4,
        }),
      );
      m.position.set(v.x, TILE_HEIGHT + 0.08, v.z);
      m.userData = { kind: 'vertex', id: v.id };
      this.vertexMarkers.set(v.id, m);
      this.root.add(m);
      this.pickables.push(m);
    }

    for (const e of board.edges.values()) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 0.08, 0.14),
        new THREE.MeshStandardMaterial({
          color: 0xf5f0e6,
          transparent: true,
          opacity: 0,
          roughness: 0.5,
        }),
      );
      m.position.set(e.midX, TILE_HEIGHT + 0.06, e.midZ);
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

  private drawHarbors(board: BoardState): void {
    this.harborGroup.clear();
    for (const h of board.harbors) {
      const edge = board.edges.get(h.edgeId);
      if (!edge) continue;
      const outward = new THREE.Vector2(edge.midX, edge.midZ).normalize();
      const px = edge.midX + outward.x * 0.55;
      const pz = edge.midZ + outward.y * 0.55;
      const label = h.type === 'generic' ? '3:1' : `2:1 ${h.type[0].toUpperCase()}`;
      const sprite = this.makeLabelSprite(label, h.type === 'generic' ? '#e8dcc8' : '#ffe8a3');
      sprite.position.set(px, TILE_HEIGHT + 0.35, pz);
      this.harborGroup.add(sprite);
    }
  }

  private makeLabelSprite(text: string, bg: string): THREE.Sprite {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 96;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = bg;
    ctx.strokeStyle = '#2a2118';
    ctx.lineWidth = 6;
    roundRect(ctx, 8, 8, 240, 80, 16);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1c1917';
    ctx.font = 'bold 36px DM Sans, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 52);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const s = new THREE.Sprite(mat);
    s.scale.set(1.1, 0.4, 1);
    return s;
  }

  private makeRobber(): THREE.Object3D {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.22, 0.55, 10),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 }),
    );
    body.position.y = 0.3;
    body.castShadow = true;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 }),
    );
    head.position.y = 0.65;
    head.castShadow = true;
    g.add(body, head);
    return g;
  }

  syncPieces(board: BoardState): void {
    for (const mesh of this.buildingMeshes.values()) this.root.remove(mesh);
    this.buildingMeshes.clear();
    for (const mesh of this.roadMeshes.values()) this.root.remove(mesh);
    this.roadMeshes.clear();

    for (const road of board.roads.values()) {
      const e = board.edges.get(road.edgeId)!;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.1, 0.16),
        new THREE.MeshStandardMaterial({ color: PLAYER_COLORS[road.owner], roughness: 0.55 }),
      );
      mesh.position.set(e.midX, TILE_HEIGHT + 0.08, e.midZ);
      mesh.rotation.y = -e.angle;
      mesh.castShadow = true;
      this.roadMeshes.set(road.edgeId, mesh);
      this.root.add(mesh);
    }

    for (const b of board.buildings.values()) {
      const v = board.vertices.get(b.vertexId)!;
      const color = PLAYER_COLORS[b.owner as PlayerId];
      const piece =
        b.kind === 'city' ? this.makeCity(color) : this.makeSettlement(color);
      piece.position.set(v.x, TILE_HEIGHT, v.z);
      this.buildingMeshes.set(b.vertexId, piece);
      this.root.add(piece);
    }

    const robberHex = board.hexes.get(board.robberHexId);
    if (robberHex) {
      const { x, z } = axialToWorld(robberHex.q, robberHex.r);
      this.robber.position.set(x + 0.35, TILE_HEIGHT, z + 0.2);
    }
  }

  private makeSettlement(color: number): THREE.Object3D {
    const g = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.22, 0.28),
      new THREE.MeshStandardMaterial({ color, roughness: 0.5 }),
    );
    base.position.y = 0.14;
    base.castShadow = true;
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.2, 4),
      new THREE.MeshStandardMaterial({ color: 0x2a2118, roughness: 0.7 }),
    );
    roof.position.y = 0.35;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    g.add(base, roof);
    return g;
  }

  private makeCity(color: number): THREE.Object3D {
    const g = new THREE.Group();
    const a = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.38, 0.32),
      new THREE.MeshStandardMaterial({ color, roughness: 0.5 }),
    );
    a.position.y = 0.22;
    a.castShadow = true;
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.5, 0.22),
      new THREE.MeshStandardMaterial({ color, roughness: 0.5 }),
    );
    b.position.set(0.18, 0.28, 0.05);
    b.castShadow = true;
    g.add(a, b);
    return g;
  }

  syncHighlights(vertices: string[], edges: string[], hexes: string[]): void {
    for (const [id, m] of this.vertexMarkers) {
      const mat = m.material as THREE.MeshStandardMaterial;
      const on = vertices.includes(id);
      mat.opacity = on ? 0.85 : 0;
      mat.color.set(on ? 0xffe566 : 0xf5f0e6);
      m.visible = on;
    }
    for (const [id, m] of this.edgeMarkers) {
      const mat = m.material as THREE.MeshStandardMaterial;
      const on = edges.includes(id);
      mat.opacity = on ? 0.85 : 0;
      mat.color.set(on ? 0xffe566 : 0xf5f0e6);
      m.visible = on;
    }
    for (const [id, m] of this.hexMeshes) {
      const mat = m.material as THREE.MeshStandardMaterial;
      const on = hexes.includes(id);
      mat.emissive.set(on ? 0x443300 : 0x000000);
      mat.emissiveIntensity = on ? 0.35 : 0;
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
    this.robber = this.makeRobber();
    this.root.add(this.water.mesh);
    this.root.add(this.harborGroup);
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
