import * as THREE from 'three';
import type { BoardState } from '../engine/types';
import { TILE_HEIGHT } from './assets';
import { STYLE, getToonGradient } from '../style/style';
import type { MotionFeel } from './motion';
import type { GroundSampler } from './islandField';

const FLAT: GroundSampler = { heightAt: () => TILE_HEIGHT };

const VERTEX_VISUAL_R = 0.14;
const VERTEX_HIT_R = 0.28;
const EDGE_HIT = { x: 1.05, y: 0.28, z: 0.42 } as const;
const COARSE_HIT_SCALE = 1.25;

const hitMaterial = new THREE.MeshBasicMaterial({
  transparent: true,
  opacity: 0,
  depthWrite: false,
});

/** Legal vertex / edge markers. */
export class Highlights {
  readonly group = new THREE.Group();
  private vertexMarkers = new Map<string, THREE.Mesh>();
  private edgeMarkers = new Map<string, THREE.Mesh>();
  private vertexHits = new Map<string, THREE.Mesh>();
  private edgeHits = new Map<string, THREE.Mesh>();
  private legalVertices = new Set<string>();
  private legalEdges = new Set<string>();
  private coarsePointer = false;
  private elapsed = 0;
  private ground: GroundSampler = FLAT;

  addTo(parent: THREE.Group): void {
    parent.add(this.group);
  }

  /** Only currently legal sites — illegal markers must not swallow taps. */
  getPickables(): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const id of this.legalVertices) {
      const m = this.vertexMarkers.get(id);
      if (m) out.push(m);
    }
    for (const id of this.legalEdges) {
      const m = this.edgeMarkers.get(id);
      if (m) out.push(m);
    }
    return out;
  }

  setCoarsePointer(coarse: boolean): void {
    if (this.coarsePointer === coarse) return;
    this.coarsePointer = coarse;
    this.applyHitScale();
  }

  build(board: BoardState, ground?: GroundSampler): void {
    this.clear();
    this.ground = ground ?? FLAT;

    for (const v of board.vertices.values()) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(VERTEX_VISUAL_R, 10, 8),
        new THREE.MeshToonMaterial({
          color: STYLE.highlight,
          gradientMap: getToonGradient(),
          transparent: true,
          opacity: 0,
        }),
      );
      const y = this.ground.heightAt(v.x, v.z) + 0.1;
      m.position.set(v.x, y, v.z);
      m.userData = { kind: 'vertex', id: v.id, restY: y };
      const hit = new THREE.Mesh(new THREE.SphereGeometry(VERTEX_HIT_R, 8, 6), hitMaterial);
      hit.userData = { kind: 'vertex', id: v.id };
      m.add(hit);
      this.vertexHits.set(v.id, hit);
      this.vertexMarkers.set(v.id, m);
      this.group.add(m);
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
      const y = this.ground.heightAt(e.midX, e.midZ) + 0.08;
      m.position.set(e.midX, y, e.midZ);
      m.rotation.y = -e.angle;
      m.userData = { kind: 'edge', id: e.id };
      const hit = new THREE.Mesh(new THREE.BoxGeometry(EDGE_HIT.x, EDGE_HIT.y, EDGE_HIT.z), hitMaterial);
      hit.userData = { kind: 'edge', id: e.id };
      m.add(hit);
      this.edgeHits.set(e.id, hit);
      this.edgeMarkers.set(e.id, m);
      this.group.add(m);
    }

    this.applyHitScale();
  }

  sync(vertices: string[], edges: string[]): void {
    this.legalVertices = new Set(vertices);
    this.legalEdges = new Set(edges);
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
  }

  update(elapsed: number, dt: number, motion: MotionFeel): void {
    this.elapsed = elapsed;
    const pulse = 0.82 + Math.sin(this.elapsed * 3.2) * 0.1;
    const step = 1 - Math.exp(-motion.highlightFade * dt);

    for (const [id, m] of this.vertexMarkers) {
      const mat = m.material as THREE.MeshToonMaterial;
      const target = this.legalVertices.has(id) ? 0.88 * pulse : 0;
      mat.opacity += (target - mat.opacity) * step;
      m.visible = mat.opacity > 0.02;
      if (this.legalVertices.has(id)) {
        const rest = (m.userData.restY as number) ?? m.position.y;
        m.position.y = rest + Math.sin(this.elapsed * 4 + id.length) * 0.02;
      }
    }

    for (const [id, m] of this.edgeMarkers) {
      const mat = m.material as THREE.MeshToonMaterial;
      const target = this.legalEdges.has(id) ? 0.88 * pulse : 0;
      mat.opacity += (target - mat.opacity) * step;
      m.visible = mat.opacity > 0.02;
    }
  }

  clear(): void {
    this.group.clear();
    this.vertexMarkers.clear();
    this.edgeMarkers.clear();
    this.vertexHits.clear();
    this.edgeHits.clear();
    this.legalVertices.clear();
    this.legalEdges.clear();
  }

  private applyHitScale(): void {
    const s = this.coarsePointer ? COARSE_HIT_SCALE : 1;
    for (const hit of this.vertexHits.values()) hit.scale.setScalar(s);
    for (const hit of this.edgeHits.values()) hit.scale.setScalar(s);
  }
}
