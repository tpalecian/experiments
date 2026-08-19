import * as THREE from 'three';
import { hexShape } from './assets';

export interface HexVisual {
  mesh: THREE.Mesh;
  restingY: number;
  baseEmissive: number;
  numberToken: THREE.Mesh | null;
  numberRestY: number;
  baseColors?: THREE.Color[];
}

/**
 * ExtrudeGeometry lid UVs are raw shape XY (≈[-r,r]), so textures never sample.
 * Remap materialIndex 0 (top/bottom lids in three@r172) into 0–1 from world XZ after rotateX.
 */
export function remapExtrudeLidUVs(geom: THREE.BufferGeometry, radius: number): void {
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

/** Flat hexagonal ring using the same pointy-top orientation as hex tiles. */
export function hexRimGeometry(inner: number, outer: number): THREE.BufferGeometry {
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

/** MeshToonMaterials on a hex (single or Extrude side+lid pair). */
export function hexToonMats(mesh: THREE.Mesh): THREE.MeshToonMaterial[] {
  const m = mesh.material;
  if (Array.isArray(m)) {
    return m.filter((x): x is THREE.MeshToonMaterial => x instanceof THREE.MeshToonMaterial);
  }
  return m instanceof THREE.MeshToonMaterial ? [m] : [];
}
