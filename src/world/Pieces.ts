import * as THREE from 'three';
import { axialToWorld } from '../engine/board';
import type { BoardState, PlayerId } from '../engine/types';
import { TILE_HEIGHT, makeCity, makeRoad, makeRobber, makeSettlement } from './assets';
import { STYLIZED_PLAYER } from '../style/style';
import { TweenPlayer, ease } from '../core/tween';
import type { MotionFeel } from './motion';

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

/** Roads, settlements, cities, robber. */
export class Pieces {
  readonly group = new THREE.Group();
  robber: THREE.Object3D;
  private readonly tweens = new TweenPlayer();
  private buildings = new Map<string, BuildingEntry>();
  private roads = new Map<string, RoadEntry>();
  private robberHopping = false;
  private robberTargetHex: string | null = null;
  private readonly robberRest = new THREE.Vector3();

  constructor() {
    this.robber = makeRobber();
    this.group.add(this.robber);
  }

  addTo(parent: THREE.Group): void {
    parent.add(this.group);
  }

  getRobberPosition(out = new THREE.Vector3()): THREE.Vector3 {
    return out.copy(this.robberRest);
  }

  update(dt: number): void {
    this.tweens.update(dt);
  }

  sync(board: BoardState, motion: MotionFeel, animate: boolean): void {
    this.syncRoads(board, motion, animate);
    this.syncBuildings(board, motion, animate);
    this.syncRobber(board, motion, animate);
  }

  private syncRoads(board: BoardState, motion: MotionFeel, animate: boolean): void {
    const keep = new Set<string>();
    for (const road of board.roads.values()) {
      keep.add(road.edgeId);
      const existing = this.roads.get(road.edgeId);
      if (existing && existing.owner === road.owner) continue;

      if (existing) {
        this.group.remove(existing.mesh);
        this.roads.delete(road.edgeId);
      }

      const e = board.edges.get(road.edgeId)!;
      const mesh = makeRoad({ color: STYLIZED_PLAYER[road.owner] });
      mesh.position.set(e.midX, TILE_HEIGHT + 0.09, e.midZ);
      mesh.rotation.y = -e.angle;
      const restingScale = 1;
      mesh.scale.set(0.15, 0.15, 0.15);
      this.roads.set(road.edgeId, { mesh, owner: road.owner, restingScale });
      this.group.add(mesh);

      if (animate) {
        this.tweens.play(
          motion.roadSpawnSec,
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
      this.group.remove(entry.mesh);
      this.roads.delete(id);
    }
  }

  private syncBuildings(board: BoardState, motion: MotionFeel, animate: boolean): void {
    const keep = new Set<string>();
    for (const b of board.buildings.values()) {
      keep.add(b.vertexId);
      const v = board.vertices.get(b.vertexId)!;
      const color = STYLIZED_PLAYER[b.owner as PlayerId];
      const existing = this.buildings.get(b.vertexId);

      if (existing && existing.kind === b.kind && existing.owner === b.owner) continue;

      if (existing && existing.kind === 'settlement' && b.kind === 'city' && existing.owner === b.owner) {
        const old = existing.mesh;
        const city = makeCity({ color });
        const restingScale = 1.1;
        city.position.set(v.x, TILE_HEIGHT, v.z);
        city.scale.setScalar(0.01);
        this.group.add(city);
        this.buildings.set(b.vertexId, {
          mesh: city,
          kind: 'city',
          owner: b.owner,
          restingY: TILE_HEIGHT,
          restingScale,
        });

        if (animate) {
          this.tweens.play(
            motion.upgradeSec,
            (u) => {
              old.scale.setScalar(existing.restingScale * (1 - u * 0.85));
              old.position.y = TILE_HEIGHT + u * 0.35;
              city.scale.setScalar(restingScale * ease.easeOutBack(u));
              city.position.y = TILE_HEIGHT + (1 - u) * 0.45;
            },
            {
              ease: ease.linear,
              onComplete: () => {
                this.group.remove(old);
                city.scale.setScalar(restingScale);
                city.position.y = TILE_HEIGHT;
              },
            },
          );
        } else {
          this.group.remove(old);
          city.scale.setScalar(restingScale);
        }
        continue;
      }

      if (existing) {
        this.group.remove(existing.mesh);
        this.buildings.delete(b.vertexId);
      }

      const piece = b.kind === 'city' ? makeCity({ color }) : makeSettlement({ color });
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
      this.group.add(piece);

      if (animate) {
        this.tweens.play(
          motion.pieceSpawnSec,
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
      this.group.remove(entry.mesh);
      this.buildings.delete(id);
    }
  }

  private syncRobber(board: BoardState, motion: MotionFeel, animate: boolean): void {
    const robberHex = board.hexes.get(board.robberHexId);
    if (!robberHex) return;
    const { x, z } = axialToWorld(robberHex.q, robberHex.r);
    const tx = x + 0.35;
    const tz = z + 0.2;
    const ty = TILE_HEIGHT;
    this.robberRest.set(tx, ty, tz);

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
      motion.robberHopSec,
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

  reset(): void {
    this.tweens.clear();
    for (const child of [...this.group.children]) {
      if (child !== this.robber) this.group.remove(child);
    }
    this.buildings.clear();
    this.roads.clear();
    this.robberHopping = false;
    this.robberTargetHex = null;
    this.robberRest.set(0, 0, 0);
  }
}
