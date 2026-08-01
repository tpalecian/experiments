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
  sky += uSunColor * pow(sunDot, 40.0) * 0.45;
  gl_FragColor = vec4(sky, 1.0);
}
`;

/** Unlit foam: always soft white + lavender, independent of scene lights. */
const foamVertexShader = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vWorldPos;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPos = world.xyz;
  // Use object-space normal transformed — baked flat face normals stay flat
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const foamFragmentShader = /* glsl */ `
uniform vec3 uLit;
uniform vec3 uShade;
uniform vec3 uSunDir;

varying vec3 vNormalW;

void main() {
  vec3 n = normalize(vNormalW);
  // Soft two-tone from a fixed “studio” light + upward bias (foam tops stay bright)
  float litAmt = clamp(dot(n, normalize(uSunDir)) * 0.5 + n.y * 0.55 + 0.35, 0.0, 1.0);
  // Posterize slightly so facets read
  litAmt = floor(litAmt * 3.0 + 0.5) / 3.0;
  vec3 col = mix(uShade, uLit, litAmt);
  gl_FragColor = vec4(col, 1.0);
}
`;

function seededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

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

/**
 * Wide, flat foam bank — overlapping puffs like cotton / bath foam.
 */
function makeFoamCloud(rand: () => number, geom: THREE.BufferGeometry, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();

  // Horizontal foam loaf layout (x wide, y short)
  const spots: [number, number, number, number][] = [
    [0.0, 0.0, 0.0, 1.25],
    [-1.3, 0.05, 0.15, 1.15],
    [1.3, 0.05, -0.1, 1.15],
    [-2.3, -0.05, 0.0, 0.95],
    [2.3, -0.05, 0.05, 0.95],
    [-0.6, 0.75, 0.1, 1.0],
    [0.7, 0.8, -0.05, 1.05],
    [0.05, 1.2, 0.0, 0.9],
    [-1.5, 0.55, -0.7, 0.85],
    [1.4, 0.5, 0.75, 0.85],
    [-0.2, 0.15, 0.95, 0.9],
    [0.25, 0.1, -1.0, 0.9],
    [-2.0, 0.35, 0.55, 0.75],
    [2.05, 0.3, -0.5, 0.75],
  ];

  for (const [x, y, z, s] of spots) {
    if (rand() < 0.05) continue;
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(
      x + (rand() - 0.5) * 0.2,
      y + (rand() - 0.5) * 0.1,
      z + (rand() - 0.5) * 0.2,
    );
    // Slight squash → foam pillow, not rock spike
    const sc = s * (0.95 + rand() * 0.12);
    mesh.scale.set(sc * 1.05, sc * 0.82, sc * 1.05);
    mesh.rotation.set(rand() * 0.5, rand() * Math.PI, rand() * 0.5);
    g.add(mesh);
  }

  return g;
}

export class SkyDome {
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private foamMat: THREE.ShaderMaterial;
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
        uSunDir: { value: new THREE.Vector3(0.55, 0.85, 0.2).normalize() },
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });

    this.foamMat = new THREE.ShaderMaterial({
      vertexShader: foamVertexShader,
      fragmentShader: foamFragmentShader,
      uniforms: {
        uLit: { value: new THREE.Color(0xfffcff) },
        uShade: { value: new THREE.Color(0xc8bdd8) },
        uSunDir: { value: new THREE.Vector3(0.55, 0.85, 0.2).normalize() },
      },
      fog: false,
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
    const rand = seededRand(120);
    const count = 8;

    for (let i = 0; i < count; i++) {
      const cloud = makeFoamCloud(rand, this.puffGeom, this.foamMat);
      const scale = 3.8 + rand() * 2.4;
      cloud.scale.setScalar(scale);

      const angle = (i / count) * Math.PI * 2 + rand() * 0.2;
      // Ring around the island, high enough to read as sky foam (not hanging rocks)
      const orbitR = radius * (0.2 + rand() * 0.18);
      const height = radius * (0.22 + rand() * 0.16);
      cloud.position.set(Math.cos(angle) * orbitR, height, Math.sin(angle) * orbitR);

      this.clouds.add(cloud);
      this.cloudDrift.push({
        obj: cloud,
        speed: 0.004 + rand() * 0.006,
        radius: orbitR,
        height,
        phase: angle,
      });
    }
  }

  setSunDirection(dir: THREE.Vector3): void {
    const d = dir.clone().normalize();
    this.material.uniforms.uSunDir.value.copy(d);
    this.foamMat.uniforms.uSunDir.value.copy(d);
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
      c.obj.position.y = c.height + Math.sin(time * 0.15 + c.phase) * 0.25;
      c.obj.rotation.y = a * 0.06;
    }
  }

  dispose(): void {
    this.clearClouds();
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.foamMat.dispose();
    this.puffGeom.dispose();
  }
}
