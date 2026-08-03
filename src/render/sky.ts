import * as THREE from 'three';
import type { AtmosphereSnapshot } from './atmosphere';
import type { StyleConfig } from './styleConfig';
import { DEFAULT_STYLE_CONFIG } from './styleConfig';

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
uniform vec3 uMid;
uniform vec3 uHorizon;
uniform vec3 uSunColor;
uniform vec3 uSunDir;
uniform float uSunDiscIntensity;
uniform float uSunGlowIntensity;
uniform float uSunDiscPower;
uniform float uHorizonHaze;
uniform float uHorizonHazeWidth;
uniform float uStarsIntensity;

varying vec3 vDir;

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

void main() {
  vec3 dir = normalize(vDir);
  float h = dir.y * 0.5 + 0.5;

  // Three-stop sky: horizon → mid → zenith (reference low-poly twilight look)
  float midT = smoothstep(0.0, 0.42, h);
  float zenT = smoothstep(0.35, 0.92, h);
  vec3 sky = mix(uHorizon, uMid, midT);
  sky = mix(sky, uZenith, zenT);

  // Soft horizon bloom so sea and sky meet (wide, low-contrast — avoid a TOD stripe)
  float hazeW = max(uHorizonHazeWidth, 0.04);
  float haze = 1.0 - smoothstep(0.0, hazeW, abs(dir.y));
  haze = pow(max(haze, 0.0), 1.15) * uHorizonHaze;
  sky = mix(sky, sky + uHorizon * 0.45, haze);

  // Below the horizon: keep the same horizon tone so transparent water has nowhere to "cut"
  float below = 1.0 - smoothstep(-0.08, 0.04, dir.y);
  sky = mix(sky, uHorizon, below * 0.85);

  // Celestial disc + wide glow (sun by day, moon by night)
  vec3 L = normalize(uSunDir);
  float sunDot = max(dot(dir, L), 0.0);
  float disc = pow(sunDot, max(uSunDiscPower, 4.0));
  float glow = pow(sunDot, max(uSunDiscPower * 0.12, 2.0));
  sky += uSunColor * disc * uSunDiscIntensity;
  sky += uSunColor * glow * uSunGlowIntensity;

  // Warm Mie-ish scatter toward the sun near the horizon
  float scatter = glow * (1.0 - smoothstep(0.05, 0.55, dir.y)) * 0.35;
  sky += uSunColor * scatter * uSunGlowIntensity;

  // Procedural stars — only when night weight is up
  if (uStarsIntensity > 0.001) {
    vec3 cell = floor(dir * 120.0);
    float n = hash13(cell);
    float star = step(0.992, n) * smoothstep(0.992, 1.0, n);
    float twinkle = 0.65 + 0.35 * hash13(cell + 17.0);
    float nightMask = smoothstep(0.15, 0.55, dir.y);
    sky += vec3(0.92, 0.95, 1.0) * star * twinkle * uStarsIntensity * nightMask;
  }

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

function createFoamPuffGeometry(config: StyleConfig): THREE.BufferGeometry {
  const seg = Math.max(4, Math.round(config.cloudPuffSegments));
  if (config.cloudPuffShape === 'icosahedron') {
    // detail 0 = sharp low-poly facets (reference look); detail 1 only at high slider
    const detail = seg >= 10 ? 1 : 0;
    return new THREE.IcosahedronGeometry(1, detail);
  }
  // Low segment spheres stay chunky / faceted rather than smooth foam
  return new THREE.SphereGeometry(1, Math.min(seg, 7), Math.max(4, Math.round(Math.min(seg, 7) * 0.65)));
}

/**
 * Compact low-poly cloud: a few overlapping faceted blobs,
 * matching the small scattered clusters in low-poly landscape art.
 */
function makeLowPolyCloud(
  rand: () => number,
  geom: THREE.BufferGeometry,
  lit: THREE.Material,
  shade: THREE.Material,
): THREE.Group {
  const g = new THREE.Group();
  // Tight 3–6 puff layouts — small isolated clusters, not foam banks
  const layouts: [number, number, number, number][][] = [
    [
      [0.0, 0.0, 0.0, 1.0],
      [-0.85, 0.05, 0.15, 0.78],
      [0.75, 0.08, -0.1, 0.72],
      [0.1, 0.55, 0.05, 0.62],
    ],
    [
      [0.0, 0.0, 0.0, 0.95],
      [-0.7, -0.05, 0.2, 0.7],
      [0.65, 0.1, -0.15, 0.68],
      [-0.15, 0.5, -0.05, 0.55],
      [0.4, 0.35, 0.35, 0.5],
    ],
    [
      [0.0, 0.05, 0.0, 0.88],
      [-0.95, 0.0, -0.1, 0.75],
      [0.9, -0.05, 0.15, 0.7],
    ],
    [
      [0.0, 0.0, 0.0, 1.05],
      [-0.6, 0.15, 0.35, 0.65],
      [0.55, 0.1, -0.3, 0.6],
      [-0.25, 0.45, -0.2, 0.58],
      [0.3, 0.5, 0.25, 0.52],
      [0.05, -0.15, 0.55, 0.48],
    ],
  ];

  const spots = layouts[Math.floor(rand() * layouts.length)];

  for (const [x, y, z, s] of spots) {
    if (rand() < 0.08) continue;
    const mat = y < 0.2 && rand() > 0.4 ? shade : lit;
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(
      x + (rand() - 0.5) * 0.18,
      y + (rand() - 0.5) * 0.1,
      z + (rand() - 0.5) * 0.18,
    );
    const sc = s * (0.9 + rand() * 0.2);
    // Slightly squashed horizontal blobs; light yaw only so lit/shade tops hold
    mesh.scale.set(sc * (1.05 + rand() * 0.15), sc * (0.72 + rand() * 0.18), sc * (1.0 + rand() * 0.15));
    mesh.rotation.set((rand() - 0.5) * 0.35, rand() * Math.PI * 2, (rand() - 0.5) * 0.35);
    mesh.frustumCulled = false;
    g.add(mesh);
  }

  g.frustumCulled = false;
  return g;
}

export class SkyDome {
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private litMat: THREE.MeshBasicMaterial;
  private shadeMat: THREE.MeshBasicMaterial;
  private puffGeom: THREE.BufferGeometry;
  private clouds = new THREE.Group();
  private celestial: THREE.Mesh;
  private cloudDrift: {
    obj: THREE.Object3D;
    speed: number;
    radius: number;
    height: number;
    phase: number;
  }[] = [];
  private skyRadius = 120;
  private landRadius = 8;
  private config: StyleConfig = { ...DEFAULT_STYLE_CONFIG };
  private readonly sunDir = new THREE.Vector3(0.55, 0.85, 0.2).normalize();

  constructor(config?: StyleConfig) {
    if (config) this.config = { ...config };

    this.material = new THREE.ShaderMaterial({
      vertexShader: skyVertexShader,
      fragmentShader: skyFragmentShader,
      uniforms: {
        uZenith: { value: new THREE.Color(this.config.skyZenith) },
        uMid: { value: new THREE.Color('#7ec8ea') },
        uHorizon: { value: new THREE.Color(this.config.skyHorizon) },
        uSunColor: { value: new THREE.Color('#fff3c0') },
        uSunDir: { value: this.sunDir.clone() },
        uSunDiscIntensity: { value: 0.55 },
        uSunGlowIntensity: { value: 0.35 },
        uSunDiscPower: { value: 40 },
        uHorizonHaze: { value: 0.22 },
        uHorizonHazeWidth: { value: 0.18 },
        uStarsIntensity: { value: 0 },
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });

    // Unlit so atmosphere palette colors stay exact across the day cycle.
    this.litMat = new THREE.MeshBasicMaterial({
      color: this.config.cloudLit,
      fog: false,
      toneMapped: false,
    });
    this.shadeMat = new THREE.MeshBasicMaterial({
      color: this.config.cloudShade,
      fog: false,
      toneMapped: false,
    });
    this.puffGeom = createFoamPuffGeometry(this.config);

    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(this.skyRadius, 32, 24), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -2;

    const celGeom = new THREE.SphereGeometry(1, 16, 12);
    const celMat = new THREE.MeshBasicMaterial({
      color: '#fff3c0',
      fog: false,
      depthWrite: false,
    });
    this.celestial = new THREE.Mesh(celGeom, celMat);
    this.celestial.frustumCulled = false;
    this.celestial.renderOrder = -1;
    this.celestial.scale.setScalar(2.8);

    this.group.add(this.mesh);
    this.group.add(this.clouds);
    this.group.add(this.celestial);
    this.clouds.frustumCulled = false;
    this.spawnClouds();
  }

  applyConfig(config: StyleConfig): void {
    const shapeChanged =
      config.cloudPuffShape !== this.config.cloudPuffShape ||
      config.cloudPuffSegments !== this.config.cloudPuffSegments;
    const countChanged = config.cloudCount !== this.config.cloudCount;
    const layoutChanged =
      countChanged ||
      config.cloudScale !== this.config.cloudScale ||
      config.cloudOrbitMin !== this.config.cloudOrbitMin ||
      config.cloudOrbitMax !== this.config.cloudOrbitMax ||
      config.cloudHeightMin !== this.config.cloudHeightMin ||
      config.cloudHeightMax !== this.config.cloudHeightMax ||
      config.cloudDriftSpeed !== this.config.cloudDriftSpeed;
    this.config = { ...config };

    // Craft colors apply when atmosphere is not driving; atmosphere overwrites each frame.
    this.material.uniforms.uZenith.value.set(config.skyZenith);
    this.material.uniforms.uHorizon.value.set(config.skyHorizon);
    this.litMat.color.set(config.cloudLit);
    this.shadeMat.color.set(config.cloudShade);

    if (shapeChanged) {
      this.puffGeom.dispose();
      this.puffGeom = createFoamPuffGeometry(config);
      this.spawnClouds();
    } else if (layoutChanged) {
      this.spawnClouds();
    }
  }

  /** Drive sky + clouds + celestial from the game atmosphere snapshot. */
  applyAtmosphere(atm: AtmosphereSnapshot): void {
    const u = this.material.uniforms;
    u.uZenith.value.copy(atm.skyZenith);
    u.uMid.value.copy(atm.skyMid);
    u.uHorizon.value.copy(atm.skyHorizon);
    u.uSunColor.value.copy(atm.sunDiscColor);
    u.uSunDiscIntensity.value = atm.sunDiscIntensity;
    u.uSunGlowIntensity.value = atm.sunGlowIntensity;
    u.uSunDiscPower.value = atm.sunDiscPower;
    u.uHorizonHaze.value = atm.horizonHaze;
    u.uHorizonHazeWidth.value = atm.horizonHazeWidth;
    u.uStarsIntensity.value = atm.starsIntensity;

    this.litMat.color.copy(atm.cloudLit);
    this.shadeMat.color.copy(atm.cloudShade);

    const celMat = this.celestial.material as THREE.MeshBasicMaterial;
    celMat.color.copy(atm.sunDiscColor);
    // Moon reads larger; sun a bit smaller
    const size = 2.2 + atm.starsIntensity * 1.6;
    this.celestial.scale.setScalar(size);
    this.celestial.visible = atm.sunAltitude > -0.05;
  }

  private clearClouds(): void {
    while (this.clouds.children.length) {
      this.clouds.remove(this.clouds.children[0]);
    }
    this.cloudDrift = [];
  }

  private spawnClouds(): void {
    this.clearClouds();
    const rand = seededRand(120);
    const count = Math.max(1, Math.round(this.config.cloudCount));
    const scaleBase = this.config.cloudScale;
    const orbitScale = Math.max(1, this.landRadius / 8);
    const orbitMin = this.config.cloudOrbitMin * orbitScale;
    const orbitMax = Math.max(orbitMin, this.config.cloudOrbitMax * orbitScale);
    const heightMin = this.config.cloudHeightMin;
    const heightMax = Math.max(heightMin, this.config.cloudHeightMax);
    const drift = this.config.cloudDriftSpeed;

    for (let i = 0; i < count; i++) {
      const cloud = makeLowPolyCloud(rand, this.puffGeom, this.litMat, this.shadeMat);
      const scale = scaleBase * (0.75 + rand() * 0.5);
      cloud.scale.setScalar(scale);

      // Scatter across a wide sky band (not clumped into a few large banks)
      const angle = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.55;
      const orbitR = orbitMin + rand() * (orbitMax - orbitMin);
      const height = heightMin + rand() * (heightMax - heightMin);
      cloud.position.set(Math.cos(angle) * orbitR, height, Math.sin(angle) * orbitR);
      cloud.rotation.y = rand() * Math.PI * 2;

      this.clouds.add(cloud);
      this.cloudDrift.push({
        obj: cloud,
        speed: drift * (0.7 + rand() * 0.6),
        radius: orbitR,
        height,
        phase: angle,
      });
    }
  }

  setSunDirection(dir: THREE.Vector3): void {
    this.sunDir.copy(dir).normalize();
    this.material.uniforms.uSunDir.value.copy(this.sunDir);
    const dist = this.skyRadius * 0.82;
    this.celestial.position.copy(this.sunDir).multiplyScalar(dist);
  }

  resize(landRadius: number): void {
    this.landRadius = landRadius;
    const r = Math.max(90, landRadius * 11);
    this.skyRadius = r;
    const old = this.mesh.geometry;
    this.mesh.geometry = new THREE.SphereGeometry(r, 32, 24);
    old.dispose();
    this.spawnClouds();
    this.setSunDirection(this.sunDir);
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
    this.litMat.dispose();
    this.shadeMat.dispose();
    this.puffGeom.dispose();
    this.celestial.geometry.dispose();
    (this.celestial.material as THREE.Material).dispose();
  }
}
