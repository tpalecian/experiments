/**
 * Player piece factories (settlement, city, road, robber).
 */
import * as THREE from 'three';
import { STYLE, toonMat } from '../../style/style';
import { resolvePlayerColor, type AssetCreateOptions } from './types';

export function makeSettlement(opts?: AssetCreateOptions): THREE.Object3D {
  const color = resolvePlayerColor(opts);
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

export function makeCity(opts?: AssetCreateOptions): THREE.Object3D {
  const color = resolvePlayerColor(opts);
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

export function makeRoad(opts?: AssetCreateOptions): THREE.Mesh {
  const color = resolvePlayerColor(opts);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.12, 0.2), toonMat(color));
  mesh.castShadow = true;
  mesh.position.y = 0.06;
  return mesh;
}

export function makeRobber(_opts?: AssetCreateOptions): THREE.Object3D {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.42, 6), toonMat(0x2a2430));
  body.position.y = 0.24;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), toonMat(0x3a3444));
  head.position.y = 0.52;
  head.castShadow = true;
  const eyeL = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 6, 4),
    new THREE.MeshBasicMaterial({ color: 0xffee88 }),
  );
  eyeL.position.set(-0.05, 0.54, 0.12);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.05;
  g.add(body, head, eyeL, eyeR);
  return g;
}

/** Fluffy cloud-wool sheep with dark face/legs (sheep-grassland concept). */
