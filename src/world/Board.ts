import * as THREE from 'three';
import { HEX_SIZE, axialToWorld } from '../engine/board';
import type { BoardState, Terrain } from '../engine/types';
import {
  TILE_HEIGHT,
  hexShape,
  makeLabelSprite,
  numberTexture,
} from './assets';
import {
  STYLE,
  STYLIZED_TERRAIN,
  STYLIZED_TERRAIN_SIDE,
  getMeadowFloorMaterial,
  toonMat,
} from '../style/style';
import type { AtmosphereSnapshot } from './Atmosphere';
import { hexRimGeometry, hexToonMats, remapExtrudeLidUVs, type HexVisual } from './geom';
import type { MotionFeel } from './motion';

/** Hex bodies, skirts, rims, tokens, and harbors. */
export class Board {
  readonly hexVisuals = new Map<string, HexVisual>();
  harborGroup = new THREE.Group();
  private harborSprites: THREE.Sprite[] = [];
  private legalHexes = new Set<string>();
  private hoverHexId: string | null = null;
  private productionPulse = new Map<string, number>();
  private elapsed = 0;

  addTo(parent: THREE.Group): void {
    parent.add(this.harborGroup);
  }

  setHoverHex(id: string | null): void {
    if (this.hoverHexId === id) return;
    this.hoverHexId = id;
  }

  pulseProduction(total: number, durationSec: number): void {
    if (total < 2 || total === 7) return;
    for (const [id, vis] of this.hexVisuals) {
      const hexNum = vis.mesh.userData.number as number | null | undefined;
      if (hexNum === total) this.productionPulse.set(id, durationSec);
    }
  }

  setLegalHexes(ids: string[]): void {
    this.legalHexes = new Set(ids);
    for (const [id, vis] of this.hexVisuals) {
      const on = this.legalHexes.has(id);
      for (const mat of hexToonMats(vis.mesh)) {
        mat.emissive.set(on ? 0x665522 : 0x000000);
      }
    }
  }

  applyBoardTint(atm: AtmosphereSnapshot): void {
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
  }

  build(board: BoardState, parent: THREE.Group, pickables: THREE.Object3D[], skirtsParent: THREE.Group): void {
    this.hexVisuals.clear();
    this.productionPulse.clear();
    this.legalHexes.clear();
    this.hoverHexId = null;

    const tileRadius = HEX_SIZE;
    const geom = new THREE.ExtrudeGeometry(hexShape(tileRadius), {
      depth: TILE_HEIGHT,
      bevelEnabled: false,
    });
    geom.rotateX(-Math.PI / 2);
    geom.computeVertexNormals();
    remapExtrudeLidUVs(geom, tileRadius);
    const rimGeom = hexRimGeometry(tileRadius * 0.9, tileRadius * 0.985);
    const meadowTopProto = getMeadowFloorMaterial();

    for (const hex of board.hexes.values()) {
      const { x, z } = axialToWorld(hex.q, hex.r);
      const terrain = hex.terrain as Terrain;

      const mat: THREE.Material | THREE.Material[] =
        terrain === 'sheep'
          ? [meadowTopProto.clone(), toonMat(STYLIZED_TERRAIN_SIDE.sheep)]
          : toonMat(STYLIZED_TERRAIN[terrain]);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(x, 0, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { kind: 'hex', id: hex.id, terrain, number: hex.number };
      parent.add(mesh);
      pickables.push(mesh);

      let numberToken: THREE.Mesh | null = null;
      let numberRestY = TILE_HEIGHT + 0.04;

      const skirt = new THREE.Mesh(
        new THREE.CylinderGeometry(HEX_SIZE * 0.94, HEX_SIZE * 1.08, 0.22, 6),
        toonMat(STYLE.dirt),
      );
      skirt.position.set(x, -0.1, z);
      skirt.receiveShadow = true;
      skirtsParent.add(skirt);

      const rim = new THREE.Mesh(
        rimGeom,
        new THREE.MeshBasicMaterial({
          color: STYLIZED_TERRAIN_SIDE[terrain],
          side: THREE.DoubleSide,
        }),
      );
      rim.position.set(x, TILE_HEIGHT + 0.002, z);
      skirtsParent.add(rim);

      if (hex.number !== null) {
        numberRestY = TILE_HEIGHT + 0.04;
        numberToken = new THREE.Mesh(
          new THREE.CircleGeometry(0.3, 6),
          new THREE.MeshBasicMaterial({ map: numberTexture(hex.number), transparent: true }),
        );
        numberToken.rotation.x = -Math.PI / 2;
        numberToken.position.set(x, numberRestY, z);
        numberToken.userData = { kind: 'hex', id: hex.id };
        parent.add(numberToken);
        pickables.push(numberToken);
      }

      this.hexVisuals.set(hex.id, {
        mesh,
        restingY: 0,
        baseEmissive: 0,
        numberToken,
        numberRestY,
      });
    }

    this.drawHarbors(board);
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

  update(elapsed: number, dt: number, motion: MotionFeel): void {
    this.elapsed = elapsed;
    this.updateLegalFade(dt, motion);
    this.updateHoverAndPulse(dt, motion);
    this.updateHarborBob(elapsed, motion);
  }

  private updateLegalFade(dt: number, motion: MotionFeel): void {
    const pulse = 0.82 + Math.sin(this.elapsed * 3.2) * 0.1;
    const step = 1 - Math.exp(-motion.highlightFade * dt);
    for (const [id, vis] of this.hexVisuals) {
      const target = this.legalHexes.has(id) ? 0.42 * pulse : 0;
      for (const mat of hexToonMats(vis.mesh)) {
        mat.emissiveIntensity += (target - mat.emissiveIntensity) * step;
      }
    }
  }

  private updateHoverAndPulse(dt: number, motion: MotionFeel): void {
    const step = 1 - Math.exp(-10 * dt);
    for (const [id, vis] of this.hexVisuals) {
      vis.mesh.position.y = vis.restingY;
      const hovered = this.hoverHexId === id;
      const mats = hexToonMats(vis.mesh);
      if (hovered && !this.legalHexes.has(id)) {
        const lift = Math.min(0.22, motion.hoverLift * 4);
        for (const mat of mats) {
          mat.emissive.set(0x445566);
          mat.emissiveIntensity = Math.max(mat.emissiveIntensity, lift);
        }
      }

      let pulse = this.productionPulse.get(id) ?? 0;
      if (pulse > 0) {
        pulse = Math.max(0, pulse - dt);
        this.productionPulse.set(id, pulse);
        const wave = Math.sin((motion.productionPulseSec - pulse) * Math.PI * 3) * Math.min(1, pulse * 2);
        const boost = Math.max(0, wave) * motion.productionPulseStrength;
        if (!this.legalHexes.has(id)) {
          for (const mat of mats) {
            mat.emissive.set(0x886622);
            mat.emissiveIntensity = Math.max(mat.emissiveIntensity, boost);
          }
        }
        if (vis.numberToken) {
          const bob = Math.max(0, wave) * 0.08;
          const scale = 1 + Math.max(0, wave) * (0.12 + motion.productionPulseStrength * 0.2);
          vis.numberToken.position.y = vis.numberRestY + bob;
          vis.numberToken.scale.setScalar(scale);
        }
      } else if (vis.numberToken) {
        vis.numberToken.position.y += (vis.numberRestY - vis.numberToken.position.y) * step;
        const s = vis.numberToken.scale.x;
        vis.numberToken.scale.setScalar(s + (1 - s) * step);
      }
    }
  }

  private updateHarborBob(time: number, motion: MotionFeel): void {
    for (const sprite of this.harborSprites) {
      const base = (sprite.userData.bobBaseY as number) ?? TILE_HEIGHT + 0.4;
      const phase = (sprite.userData.bobPhase as number) ?? 0;
      sprite.position.y = base + Math.sin(time * 1.4 + phase) * motion.harborBobAmp;
    }
  }

  resetHarborGroup(): void {
    this.harborSprites = [];
    this.harborGroup = new THREE.Group();
  }
}
