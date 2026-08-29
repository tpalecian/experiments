import * as THREE from 'three';
import { HEX_SIZE, axialToWorld } from '../engine/board';
import type { BoardState } from '../engine/types';
import { hexShape, makeLabelSprite, numberTexture } from './assets';
import { STYLE, toonMat } from '../style/style';
import type { AtmosphereSnapshot } from './Atmosphere';
import type { IslandField } from './islandField';
import type { MotionFeel } from './motion';

interface HexVisual {
  pick: THREE.Mesh;
  glow: THREE.Mesh;
  restingY: number;
  numberToken: THREE.Mesh | null;
  numberRestY: number;
  worldX: number;
  worldZ: number;
}

/** Hidden hex pick discs, glow, tokens, and harbors on the island. */
export class Board {
  readonly group = new THREE.Group();
  readonly harborGroup = new THREE.Group();
  readonly hexVisuals = new Map<string, HexVisual>();
  private harborSprites: THREE.Sprite[] = [];
  private legalHexes = new Set<string>();
  private hoverHexId: string | null = null;
  private productionPulse = new Map<string, number>();
  private pickables: THREE.Object3D[] = [];
  private accents: THREE.Mesh[] = [];
  private elapsed = 0;

  constructor() {
    this.group.add(this.harborGroup);
  }

  addTo(parent: THREE.Group): void {
    parent.add(this.group);
  }

  getPickables(): THREE.Object3D[] {
    return this.pickables;
  }

  getHexWorld(id: string, out = new THREE.Vector3()): THREE.Vector3 | null {
    const vis = this.hexVisuals.get(id);
    if (!vis) return null;
    return out.set(vis.worldX, vis.restingY, vis.worldZ);
  }

  setHoverHex(id: string | null): void {
    if (this.hoverHexId === id) return;
    this.hoverHexId = id;
  }

  pulseProduction(total: number, durationSec: number): void {
    if (total < 2 || total === 7) return;
    for (const [id, vis] of this.hexVisuals) {
      const hexNum = vis.pick.userData.number as number | null | undefined;
      if (hexNum === total) this.productionPulse.set(id, durationSec);
    }
  }

  setLegalHexes(ids: string[]): void {
    this.legalHexes = new Set(ids);
  }

  applyBoardTint(atm: AtmosphereSnapshot): void {
    const mix = atm.boardTintMix;
    const tint = atm.beachTint;
    for (const mesh of this.accents) {
      const mat = mesh.material;
      if (!(mat instanceof THREE.MeshToonMaterial) && !(mat instanceof THREE.MeshBasicMaterial)) continue;
      const stored = mesh.userData.baseColor as THREE.Color | undefined;
      const base = stored ?? mat.color.clone();
      mesh.userData.baseColor = base;
      mat.color.copy(base).lerp(tint, mix);
    }
  }

  build(board: BoardState, field: IslandField): void {
    this.clear();

    const pickGeom = new THREE.ShapeGeometry(hexShape(HEX_SIZE * 0.92));
    pickGeom.rotateX(-Math.PI / 2);
    const glowGeom = new THREE.CircleGeometry(HEX_SIZE * 0.78, 28);
    glowGeom.rotateX(-Math.PI / 2);

    const pickMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const glowMatProto = new THREE.MeshBasicMaterial({
      color: 0xfff0a0,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    for (const hex of board.hexes.values()) {
      const { x, z } = axialToWorld(hex.q, hex.r);
      const y = field.heightAt(x, z);

      const pick = new THREE.Mesh(pickGeom, pickMat);
      pick.position.set(x, y + 0.04, z);
      pick.userData = { kind: 'hex', id: hex.id, terrain: hex.terrain, number: hex.number };
      this.group.add(pick);
      this.pickables.push(pick);

      const glow = new THREE.Mesh(glowGeom, glowMatProto.clone());
      glow.position.set(x, y + 0.05, z);
      glow.renderOrder = 2;
      this.group.add(glow);

      let numberToken: THREE.Mesh | null = null;
      let numberRestY = y + 0.07;
      if (hex.number !== null) {
        numberToken = new THREE.Mesh(
          new THREE.CircleGeometry(0.22 * HEX_SIZE, 24),
          new THREE.MeshBasicMaterial({ map: numberTexture(hex.number), transparent: true }),
        );
        numberToken.rotation.x = -Math.PI / 2;
        numberToken.position.set(x, numberRestY, z);
        numberToken.userData = { kind: 'hex', id: hex.id };
        this.group.add(numberToken);
        this.pickables.push(numberToken);
      }

      this.hexVisuals.set(hex.id, {
        pick,
        glow,
        restingY: y,
        numberToken,
        numberRestY,
        worldX: x,
        worldZ: z,
      });
    }

    this.drawHarbors(board, field);
  }

  clear(): void {
    this.hexVisuals.clear();
    this.productionPulse.clear();
    this.legalHexes.clear();
    this.hoverHexId = null;
    this.pickables = [];
    this.accents = [];
    for (const child of [...this.group.children]) {
      if (child !== this.harborGroup) this.group.remove(child);
    }
    this.harborGroup.clear();
    this.harborSprites = [];
  }

  private drawHarbors(board: BoardState, field: IslandField): void {
    this.harborGroup.clear();
    this.harborSprites = [];
    for (const h of board.harbors) {
      const edge = board.edges.get(h.edgeId);
      if (!edge) continue;
      const outward = new THREE.Vector2(edge.midX, edge.midZ).normalize();
      const px = edge.midX + outward.x * 0.85 * HEX_SIZE;
      const pz = edge.midZ + outward.y * 0.85 * HEX_SIZE;
      const py = Math.max(0.03, field.heightAt(px, pz));

      const pier = new THREE.Mesh(
        new THREE.BoxGeometry(0.38 * HEX_SIZE, 0.05, 0.16 * HEX_SIZE),
        toonMat(STYLE.woodTrim),
      );
      pier.position.set(px, py, pz);
      pier.rotation.y = -Math.atan2(outward.y, outward.x);
      pier.castShadow = true;
      this.harborGroup.add(pier);
      this.accents.push(pier);

      const label = h.type === 'generic' ? '3:1' : `2:1 ${h.type[0].toUpperCase()}`;
      const sprite = makeLabelSprite(label, h.type === 'generic' ? '#ffe8c0' : '#fff0a8');
      const bobBaseY = py + 0.42;
      sprite.position.set(px, bobBaseY, pz);
      sprite.userData.bobPhase = Math.atan2(pz, px);
      sprite.userData.bobBaseY = bobBaseY;
      this.harborSprites.push(sprite);
      this.harborGroup.add(sprite);
    }
  }

  update(elapsed: number, dt: number, motion: MotionFeel): void {
    this.elapsed = elapsed;
    this.updateGlow(dt, motion);
    this.updateHarborBob(elapsed, motion);
  }

  private updateGlow(dt: number, motion: MotionFeel): void {
    const pulse = 0.82 + Math.sin(this.elapsed * 3.2) * 0.1;
    const step = 1 - Math.exp(-motion.highlightFade * dt);
    const tokenStep = 1 - Math.exp(-10 * dt);

    for (const [id, vis] of this.hexVisuals) {
      const legal = this.legalHexes.has(id);
      const hovered = this.hoverHexId === id;
      let target = 0;
      const mat = vis.glow.material as THREE.MeshBasicMaterial;
      if (legal) {
        target = 0.38 * pulse;
        mat.color.set(0xffe08a);
      } else if (hovered) {
        target = Math.min(0.32, motion.hoverLift * 8);
        mat.color.set(0xa8d4ff);
      }

      let pulseLeft = this.productionPulse.get(id) ?? 0;
      if (pulseLeft > 0) {
        pulseLeft = Math.max(0, pulseLeft - dt);
        this.productionPulse.set(id, pulseLeft);
        const wave = Math.sin((motion.productionPulseSec - pulseLeft) * Math.PI * 3) * Math.min(1, pulseLeft * 2);
        const boost = Math.max(0, wave) * motion.productionPulseStrength;
        target = Math.max(target, boost * 0.55);
        if (!legal) mat.color.set(0xffcc66);
        if (vis.numberToken) {
          const bob = Math.max(0, wave) * 0.08;
          const scale = 1 + Math.max(0, wave) * (0.12 + motion.productionPulseStrength * 0.2);
          vis.numberToken.position.y = vis.numberRestY + bob;
          vis.numberToken.scale.setScalar(scale);
        }
      } else if (vis.numberToken) {
        vis.numberToken.position.y += (vis.numberRestY - vis.numberToken.position.y) * tokenStep;
        const s = vis.numberToken.scale.x;
        vis.numberToken.scale.setScalar(s + (1 - s) * tokenStep);
      }

      mat.opacity += (target - mat.opacity) * step;
      vis.glow.visible = mat.opacity > 0.02;
    }
  }

  private updateHarborBob(time: number, motion: MotionFeel): void {
    for (const sprite of this.harborSprites) {
      const base = (sprite.userData.bobBaseY as number) ?? 0.5;
      const phase = (sprite.userData.bobPhase as number) ?? 0;
      sprite.position.y = base + Math.sin(time * 1.4 + phase) * motion.harborBobAmp;
    }
  }
}
