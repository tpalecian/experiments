import * as THREE from 'three';
import type { BoardState } from '../engine/types';
import { TILE_HEIGHT } from './assets';
import { STYLE, getToonGradient } from '../style/style';
import type { MotionFeel } from './motion';

/** Legal vertex / edge markers. */
export class Highlights {
  private vertexMarkers = new Map<string, THREE.Mesh>();
  private edgeMarkers = new Map<string, THREE.Mesh>();
  private legalVertices = new Set<string>();
  private legalEdges = new Set<string>();
  private elapsed = 0;

  build(board: BoardState, parent: THREE.Group, pickables: THREE.Object3D[]): void {
    this.vertexMarkers.clear();
    this.edgeMarkers.clear();
    this.legalVertices.clear();
    this.legalEdges.clear();

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
      parent.add(m);
      pickables.push(m);
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
      parent.add(m);
      pickables.push(m);
    }
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
  }

  clear(): void {
    this.vertexMarkers.clear();
    this.edgeMarkers.clear();
    this.legalVertices.clear();
    this.legalEdges.clear();
  }
}
