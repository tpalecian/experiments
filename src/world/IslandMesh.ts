/**
 * Seamless island height mesh from IslandField samples.
 */
import * as THREE from 'three';
import { HEX_SIZE } from '../engine/board';
import { getQualityLevel } from '../core/Quality';
import { painterlyMat } from '../style/style';
import type { AtmosphereSnapshot } from './Atmosphere';
import { IslandField } from './islandField';

function gridStep(): number {
  const level = getQualityLevel();
  switch (level) {
    case 'low':
      return 0.22 * HEX_SIZE;
    case 'medium':
      return 0.15 * HEX_SIZE;
    case 'high':
      return 0.11 * HEX_SIZE;
    default: {
      const _exhaustive: never = level;
      return _exhaustive;
    }
  }
}

export class IslandMesh {
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.MeshLambertMaterial;
  private readonly baseColor = new THREE.Color(0xffffff);

  constructor() {
    this.material = painterlyMat(0xffffff, { vertexColors: true });
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.name = 'island-terrain';
    this.group.add(this.mesh);
  }

  addTo(parent: THREE.Group): void {
    parent.add(this.group);
  }

  build(field: IslandField): void {
    const old = this.mesh.geometry;
    this.mesh.geometry = buildIslandGeometry(field);
    old.dispose();
  }

  applyBoardTint(atm: AtmosphereSnapshot): void {
    this.material.color.copy(this.baseColor).lerp(atm.beachTint, atm.boardTintMix);
  }

  clear(): void {
    const old = this.mesh.geometry;
    this.mesh.geometry = new THREE.BufferGeometry();
    old.dispose();
  }
}

function buildIslandGeometry(field: IslandField): THREE.BufferGeometry {
  const step = gridStep();
  const radius = field.radius;
  const span = radius * 2;
  const segs = Math.max(24, Math.ceil(span / step));
  const origin = -radius;

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const indexAt: number[] = new Array((segs + 1) * (segs + 1)).fill(-1);

  const sampleAt = (ix: number, iz: number) => {
    const x = origin + ix * step;
    const z = origin + iz * step;
    return field.sample(x, z);
  };

  for (let iz = 0; iz <= segs; iz++) {
    for (let ix = 0; ix <= segs; ix++) {
      const s = sampleAt(ix, iz);
      if (s.shoreDist > 0.1 * HEX_SIZE) continue;
      const x = origin + ix * step;
      const z = origin + iz * step;
      const idx = positions.length / 3;
      indexAt[iz * (segs + 1) + ix] = idx;
      positions.push(x, s.height, z);
      const ao =
        s.beachMask > 0.4 ? 0.97 : 0.78 + Math.min(0.22, Math.max(0, s.height) * 0.12);
      colors.push(s.color.r * ao, s.color.g * ao, s.color.b * ao);
    }
  }

  const tryTri = (a: number, b: number, c: number) => {
    if (a < 0 || b < 0 || c < 0) return;
    indices.push(a, b, c);
  };

  for (let iz = 0; iz < segs; iz++) {
    for (let ix = 0; ix < segs; ix++) {
      const a = indexAt[iz * (segs + 1) + ix]!;
      const b = indexAt[iz * (segs + 1) + ix + 1]!;
      const c = indexAt[(iz + 1) * (segs + 1) + ix + 1]!;
      const d = indexAt[(iz + 1) * (segs + 1) + ix]!;
      tryTri(a, d, b);
      tryTri(b, d, c);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  darkenCrevices(geom);
  geom.computeBoundingSphere();
  return geom;
}

/** Cheap ambient occlusion: darken vertices whose normal points sideways (rocks/peaks). */
function darkenCrevices(geom: THREE.BufferGeometry): void {
  const pos = geom.attributes.position;
  const col = geom.attributes.color;
  const nrm = geom.attributes.normal;
  if (!pos || !col || !nrm) return;
  for (let i = 0; i < pos.count; i++) {
    const ny = nrm.getY(i);
    const cavity = 0.62 + 0.38 * Math.max(0, ny);
    col.setXYZ(i, col.getX(i) * cavity, col.getY(i) * cavity, col.getZ(i) * cavity);
  }
  col.needsUpdate = true;
}
