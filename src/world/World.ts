import * as THREE from 'three';
import { HEX_SIZE, axialToWorld } from '../engine/board';
import type { BoardState } from '../engine/types';
import type { AtmosphereSnapshot } from './Atmosphere';
import type { StyleConfig } from '../style/styleConfig';
import { WaterSurface } from './WaterSurface';
import { Board } from './Board';
import { Highlights } from './Highlights';
import { Pieces } from './Pieces';
import { Props } from './Props';
import { motionFromStyle, type MotionFeel } from './motion';

/**
 * Live hex-board presentation — tiles, props, pieces, water, highlights.
 */
export class World {
  readonly root = new THREE.Group();
  private readonly board = new Board();
  private readonly highlights = new Highlights();
  private readonly pieces = new Pieces();
  private readonly props = new Props();
  private readonly water = new WaterSurface();
  private motion: MotionFeel = motionFromStyle();

  constructor() {
    this.root.add(this.water.mesh);
    this.board.addTo(this.root);
    this.props.addTo(this.root);
    this.highlights.addTo(this.root);
    this.pieces.addTo(this.root);
  }

  getPickables(): THREE.Object3D[] {
    return [...this.board.getPickables(), ...this.highlights.getPickables()];
  }

  setCoarsePointer(coarse: boolean): void {
    this.highlights.setCoarsePointer(coarse);
  }

  getRobberPosition(out = new THREE.Vector3()): THREE.Vector3 {
    return this.pieces.getRobberPosition(out);
  }

  getMotion(): MotionFeel {
    return this.motion;
  }

  setHoverHex(id: string | null): void {
    this.board.setHoverHex(id);
  }

  pulseProduction(total: number): void {
    this.board.pulseProduction(total, this.motion.productionPulseSec);
  }

  update(time: number, dt = 1 / 60): void {
    this.pieces.update(dt);
    this.water.update(time);
    this.highlights.update(time, dt, this.motion);
    this.board.update(time, dt, this.motion);
  }

  setSunDirection(dir: THREE.Vector3): void {
    this.water.setSunDirection(dir);
  }

  applyStyleConfig(config: StyleConfig): void {
    this.water.applyConfig(config);
    this.motion = motionFromStyle(config);
  }

  renderWaterReflection(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ): void {
    const harborsWereVisible = this.board.harborGroup.visible;
    this.board.harborGroup.visible = false;
    this.water.renderReflection(renderer, scene, camera);
    this.board.harborGroup.visible = harborsWereVisible;
  }

  applyAtmosphere(atm: AtmosphereSnapshot): void {
    this.water.applyAtmosphere(atm);
    this.board.applyBoardTint(atm);
    this.props.applyTint(atm);
  }

  build(board: BoardState): void {
    this.clearDynamic();
    this.props.reload();

    this.water.resize(board.rings);
    const landCenters: { x: number; z: number }[] = [];
    for (const hex of board.hexes.values()) {
      landCenters.push(axialToWorld(hex.q, hex.r));
    }
    this.water.setLandHexes(landCenters, HEX_SIZE);

    this.board.build(board);
    for (const hex of board.hexes.values()) {
      const { x, z } = axialToWorld(hex.q, hex.r);
      this.props.stamp(hex.terrain, x, z, hex.id);
    }
    this.highlights.build(board);
    this.pieces.sync(board, this.motion, false);
    this.syncHighlights([], [], []);
  }

  syncPieces(board: BoardState, animate = true): void {
    this.pieces.sync(board, this.motion, animate);
  }

  syncHighlights(vertices: string[], edges: string[], hexes: string[]): void {
    this.highlights.sync(vertices, edges);
    this.board.setLegalHexes(hexes);
  }

  private clearDynamic(): void {
    this.board.clear();
    this.highlights.clear();
    this.pieces.reset();
    this.props.reset();
  }
}
