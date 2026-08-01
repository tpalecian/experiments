import * as THREE from 'three';
import { STYLE } from './style';

const skyVertexShader = /* glsl */ `
varying vec3 vDir;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vDir = normalize(world.xyz - cameraPosition);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const skyFragmentShader = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunColor;
uniform vec3 uSunDir;

varying vec3 vDir;

void main() {
  vec3 dir = normalize(vDir);
  float h = dir.y * 0.5 + 0.5;
  vec3 sky = mix(uHorizon, uZenith, smoothstep(0.0, 0.72, h));
  float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
  sky += uSunColor * pow(sunDot, 40.0) * 0.55;
  sky += uSunColor * pow(sunDot, 5.0) * 0.08;
  gl_FragColor = vec4(sky, 1.0);
}
`;

function seededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** Chunky icosahedron with baked per-face normals (true flat foam facets). */
function createFoamPuffGeometry(): THREE.BufferGeometry {
  const base = new THREE.IcosahedronGeometry(1, 0).toNonIndexed();
  const pos = base.attributes.position;
  const normals = new Float32Array(pos.count * 3);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const cb = new THREE.Vector3();
  const ab = new THREE.Vector3();

  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    cb.subVectors(c, b);
    ab.subVectors(a, b);
    cb.cross(ab).normalize();
    for (let j = 0; j < 3; j++) {
      normals[(i + j) * 3] = cb.x;
      normals[(i + j) * 3 + 1] = cb.y;
      normals[(i + j) * 3 + 2] = cb.z;
    }
  }
  base.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return base;
}

function makeFoamCloud(
  rand: () => number,
  geom: THREE.BufferGeometry,
  lit: THREE.Material,
  shade: THREE.Material,
): THREE.Group {
  const g = new THREE.Group();

  const spots: [number, number, number, number][] = [
    [0, 0, 0, 1.4],
    [-1.5, 0.15, 0.25, 1.2],
    [1.5, 0.1, -0.2, 1.25],
    [-0.65, 0.95, 0.15, 1.1],
    [0.75, 1.0, -0.1, 1.15],
    [0.05, 1.55, 0.05, 1.0],
    [-1.15, 0.4, -0.95, 1.0],
    [1.05, 0.35, 1.0, 0.95],
    [-0.15, 0.25, 1.2, 0.9],
    [0.2, 0.2, -1.25, 0.92],
    [-1.9, 0.0, 0.4, 0.85],
    [1.95, 0.05, -0.3, 0.88],
    [-0.4, 1.2, -0.7, 0.8],
    [0.5, 1.15, 0.75, 0.82],
  ];

  for (const [x, y, z, s] of spots) {
    if (rand() < 0.06) continue;
    const mat = y < 0.4 && rand() > 0.4 ? shade : lit;
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(
      x + (rand() - 0.5) * 0.2,
      y + (rand() - 0.5) * 0.12,
      z + (rand() - 0.5) * 0.2,
    );
    mesh.scale.setScalar(s * (0.94 + rand() * 0.16));
    mesh.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    g.add(mesh);
  }

  return g;
}

export class SkyDome {
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private litMat: THREE.MeshStandardMaterial;
  private shadeMat: THREE.MeshStandardMaterial;
  private puffGeom: THREE.BufferGeometry;
  private clouds = new THREE.Group();
  private cloudDrift: {
    obj: THREE.Object3D;
    speed: number;
    radius: number;
    height: number;
    phase: number;
  }[] = [];
  private skyRadius = 120;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      vertexShader: skyVertexShader,
      fragmentShader: skyFragmentShader,
      uniforms: {
        uZenith: { value: new THREE.Color(0x4aa8e0) },
        uHorizon: { value: new THREE.Color(0xd8eef8) },
        uSunColor: { value: new THREE.Color(STYLE.sunDisc) },
        uSunDir: { value: new THREE.Vector3(0.55, 0.8, 0.25).normalize() },
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });

    // Fog off — otherwise facets wash out into soft blobs
    this.litMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.88,
      metalness: 0,
      flatShading: true,
      fog: false,
      emissive: 0xffffff,
      emissiveIntensity: 0.08,
    });
    this.shadeMat = new THREE.MeshStandardMaterial({
      color: 0xb0a0c4,
      roughness: 0.95,
      metalness: 0,
      flatShading: true,
      fog: false,
      emissive: 0x9a88b0,
      emissiveIntensity: 0.04,
    });

    this.puffGeom = createFoamPuffGeometry();

    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(this.skyRadius, 32, 24), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -2;

    this.group.add(this.mesh);
    this.group.add(this.clouds);
    this.spawnClouds(this.skyRadius);
  }

  private clearClouds(): void {
    while (this.clouds.children.length) {
      this.clouds.remove(this.clouds.children[0]);
    }
    this.cloudDrift = [];
  }

  private spawnClouds(radius: number): void {
    this.clearClouds();
    const rand = seededRand(103);
    const count = 8;

    for (let i = 0; i < count; i++) {
      const cloud = makeFoamCloud(rand, this.puffGeom, this.litMat, this.shadeMat);
      const scale = 3.6 + rand() * 2.8;
      cloud.scale.setScalar(scale);

      const angle = (i / count) * Math.PI * 2 + rand() * 0.2;
      const orbitR = radius * (0.16 + rand() * 0.14);
      const height = radius * (0.11 + rand() * 0.12);
      cloud.position.set(Math.cos(angle) * orbitR, height, Math.sin(angle) * orbitR);

      this.clouds.add(cloud);
      this.cloudDrift.push({
        obj: cloud,
        speed: 0.004 + rand() * 0.007,
        radius: orbitR,
        height,
        phase: angle,
      });
    }
  }

  setSunDirection(dir: THREE.Vector3): void {
    this.material.uniforms.uSunDir.value.copy(dir).normalize();
  }

  resize(landRadius: number): void {
    const r = Math.max(90, landRadius * 11);
    this.skyRadius = r;
    const old = this.mesh.geometry;
    this.mesh.geometry = new THREE.SphereGeometry(r, 32, 24);
    old.dispose();
    this.spawnClouds(r);
  }

  update(time: number): void {
    for (const c of this.cloudDrift) {
      const a = c.phase + time * c.speed;
      c.obj.position.x = Math.cos(a) * c.radius;
      c.obj.position.z = Math.sin(a) * c.radius;
      c.obj.position.y = c.height + Math.sin(time * 0.18 + c.phase) * 0.3;
      c.obj.rotation.y = a * 0.08;
    }
  }

  dispose(): void {
    this.clearClouds();
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.litMat.dispose();
    this.shadeMat.dispose();
    this.puffGeom.dispose();
  }
}
