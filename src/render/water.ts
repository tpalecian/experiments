import * as THREE from 'three';
import { HEX_SIZE, islandHexApothem } from '../game/board';
import type { AtmosphereSnapshot } from './atmosphere';
import type { StyleConfig } from './styleConfig';
import { DEFAULT_STYLE_CONFIG } from './styleConfig';
import type { WorldData } from '../world/types';
import { createSdfDataTexture } from './IslandTerrainView';
import type { EnvironmentState } from '../atmosphere/environment';

/** Max land hexes supported by the fallback hex shoreline SDF (huge map = 61). */
export const WATER_MAX_HEXES = 64;

/**
 * Stylized tropical low-poly water — calm, painterly, aerial-friendly.
 * Shoreline prefers the island SDF texture (distanceToCoast); hex union is fallback.
 */
const waterVertexShader = /* glsl */ `
uniform float uTime;
uniform float uWaveHeight;
uniform float uWaveSpeed;

varying vec3 vWorldPos;
varying vec3 vNormalW;
varying vec3 vViewDir;
varying float vWave;

float swell(vec2 p, float t) {
  float w =
    sin(p.x * 0.30 + t * 0.15) +
    sin(p.y * 0.20 + t * 0.10) +
    sin((p.x + p.y) * 0.15 + t * 0.08);
  return w * (1.0 / 3.0);
}

vec2 swellDeriv(vec2 p, float t) {
  float dx =
    0.30 * cos(p.x * 0.30 + t * 0.15) +
    0.15 * cos((p.x + p.y) * 0.15 + t * 0.08);
  float dy =
    0.20 * cos(p.y * 0.20 + t * 0.10) +
    0.15 * cos((p.x + p.y) * 0.15 + t * 0.08);
  return vec2(dx, dy) * (1.0 / 3.0);
}

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  float t = uTime * uWaveSpeed;
  float w = swell(world.xz, t);
  vec2 d = swellDeriv(world.xz, t);

  world.y += w * uWaveHeight;
  vWave = w;

  vec3 n = normalize(vec3(-d.x * uWaveHeight, 1.0, -d.y * uWaveHeight));
  vNormalW = normalize(mat3(modelMatrix) * n);
  vWorldPos = world.xyz;
  vViewDir = normalize(cameraPosition - world.xyz);

  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const waterFragmentShader = /* glsl */ `
uniform float uTime;
uniform float uWaveSpeed;
uniform vec3 uDeepOcean;
uniform vec3 uOcean;
uniform vec3 uLagoon;
uniform vec3 uShallow;
uniform vec3 uBeachEdge;
uniform vec3 uFoamColor;
uniform float uShoreWidth;
uniform float uDeepFade;
uniform float uSeaRadius;
uniform float uEdgeSoft;
uniform vec3 uHorizon;
uniform float uHorizonHaze;
uniform float uBandIntensity;
uniform float uBandScale;
uniform float uBandSpeed;
uniform float uFresnelStrength;
uniform float uFresnelPower;
uniform float uSpecularIntensity;
uniform float uSpecularPower;
uniform float uShoreFoam;
uniform float uFoamWidth;
uniform float uCausticIntensity;
uniform float uCausticScale;
uniform float uCausticSpeed;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyFresnel;
uniform vec2 uHexCenters[${WATER_MAX_HEXES}];
uniform int uHexCount;
uniform float uHexApothem;
uniform sampler2D uSdfMap;
uniform vec4 uSdfBounds; // minX, minZ, maxX, maxZ
uniform float uUseIslandSdf;

varying vec3 vWorldPos;
varying vec3 vNormalW;
varying vec3 vViewDir;
varying float vWave;

float sdHexagon(vec2 p, float r) {
  p = abs(p.yx);
  vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}

float shoreDistanceHex(vec2 p) {
  float d = 1e5;
  for (int i = 0; i < ${WATER_MAX_HEXES}; i++) {
    float alive = step(float(i), float(uHexCount) - 0.5);
    float hd = sdHexagon(p - uHexCenters[i], uHexApothem);
    d = min(d, mix(1e5, hd, alive));
  }
  return d;
}

// Island SDF: positive inland, negative ocean. Water needs positive outside land.
float shoreDistanceIsland(vec2 p) {
  vec2 uv = (p - uSdfBounds.xy) / max(uSdfBounds.zw - uSdfBounds.xy, vec2(1e-4));
  float dCoast = texture2D(uSdfMap, clamp(uv, 0.0, 1.0)).r;
  // Convert: outside land (for water colour) = -distanceToCoast
  return -dCoast;
}

float shoreDistance(vec2 p) {
  if (uUseIslandSdf > 0.5) return shoreDistanceIsland(p);
  return shoreDistanceHex(p);
}

float softBand(float x) {
  float s = 0.5 + 0.5 * sin(x);
  return smoothstep(0.25, 0.8, s);
}

float softCaustic(vec2 p, float t) {
  float a = sin(p.x * 1.7 + t * 0.6) * sin(p.y * 1.3 - t * 0.45);
  float b = sin((p.x + p.y) * 1.1 - t * 0.35) * sin((p.x - p.y) * 0.9 + t * 0.5);
  float c = sin(p.x * 0.55 - t * 0.2) * sin(p.y * 0.65 + t * 0.18);
  float m = a * 0.45 + b * 0.35 + c * 0.20;
  return smoothstep(-0.15, 0.55, m);
}

void main() {
  float shoreDist = shoreDistance(vWorldPos.xz);

  // Under land — keep water out
  if (shoreDist < -0.04) discard;

  // Fixed tropical bands in world units (readable like the reference aerial)
  float b0 = 0.0;
  float b1 = 1.1;   // beach edge / foam
  float b2 = 3.2;   // bright turquoise shallow
  float b3 = 6.5;   // lagoon
  float b4 = 12.0;  // ocean
  float b5 = 22.0;  // deep

  float tBeach = 1.0 - smoothstep(b0, b1, shoreDist);
  float tShallow = smoothstep(b0, b1, shoreDist) * (1.0 - smoothstep(b1, b2, shoreDist));
  float tLagoon = smoothstep(b1, b2, shoreDist) * (1.0 - smoothstep(b2, b3, shoreDist));
  float tOcean = smoothstep(b2, b3, shoreDist) * (1.0 - smoothstep(b3, b4, shoreDist));
  float tDeep = smoothstep(b3, b5, shoreDist);

  float wSum = tBeach + tShallow + tLagoon + tOcean + tDeep + 1e-5;
  vec3 col =
    (uBeachEdge * tBeach +
     uShallow * tShallow +
     uLagoon * tLagoon +
     uOcean * tOcean +
     uDeepOcean * tDeep) / wSum;

  // Punch turquoise near every coast
  float nearGlow = 1.0 - smoothstep(0.0, 4.0, shoreDist);
  nearGlow = pow(max(nearGlow, 0.0), 1.25);
  col = mix(col, uShallow, nearGlow * 0.35);
  col = mix(col, uLagoon, nearGlow * 0.12);

  float wt = uTime * uWaveSpeed;
  float wave =
    sin(vWorldPos.x * 0.30 + wt * 0.15) +
    sin(vWorldPos.z * 0.20 + wt * 0.10) +
    sin((vWorldPos.x + vWorldPos.z) * 0.15 + wt * 0.08);
  wave *= 1.0 / 3.0;
  col += vec3(0.04) * wave;
  col = mix(col, uLagoon, max(wave, 0.0) * 0.08);
  col += vec3(0.02) * vWave;

  float radial = shoreDist * uBandScale - uTime * uBandSpeed * 0.2;
  float drift = dot(vWorldPos.xz, vec2(0.72, 0.35)) * uBandScale * 0.55 - uTime * uBandSpeed * 0.65;
  float bands =
    softBand(radial) * 0.55 +
    softBand(radial * 0.5 + 1.4) * 0.25 +
    softBand(drift) * 0.20;
  col += vec3(uBandIntensity) * bands * (0.55 + 0.45 * nearGlow);

  vec3 N = normalize(vNormalW);
  vec3 V = normalize(vViewDir);
  vec3 L = normalize(uSunDir);

  float seaR = max(uSeaRadius, 1.0);
  float soft = max(uEdgeSoft, seaR * 0.55);
  float radialDist = length(vWorldPos.xz);
  float edgeFade = smoothstep(seaR - soft, seaR, radialDist);

  float camDist = length(cameraPosition - vWorldPos);
  float distFade = smoothstep(28.0, 90.0, camDist);

  vec3 fromCam = normalize(vWorldPos - cameraPosition);
  float horizonFade = smoothstep(-0.28, -0.01, fromCam.y);
  horizonFade *= smoothstep(18.0, 70.0, camDist);

  float ndotvEarly = max(dot(N, V), 0.0);
  float graze = pow(1.0 - ndotvEarly, 1.6) * distFade;

  float haze = max(edgeFade, max(distFade * 0.85, max(horizonFade, graze)));
  haze = clamp(haze, 0.0, 1.0);
  haze = haze * haze * (3.0 - 2.0 * haze);
  float keep = 1.0 - haze;

  float fres = pow(1.0 - max(dot(N, V), 0.0), uFresnelPower);
  fres *= uFresnelStrength * keep;
  col = mix(col, uSkyFresnel, fres * 0.28);

  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), uSpecularPower);
  spec = smoothstep(0.0, 1.0, spec);
  spec *= 0.85 + 0.15 * wave;
  col += uSunColor * spec * uSpecularIntensity * keep;

  float shallowMask = 1.0 - smoothstep(0.0, 5.0, shoreDist);
  shallowMask = pow(max(shallowMask, 0.0), 0.75);
  float cau = softCaustic(vWorldPos.xz * uCausticScale, uTime * uCausticSpeed);
  col += mix(uBeachEdge, uShallow, 0.35) * cau * uCausticIntensity * shallowMask * keep;

  // White shore foam ring
  float foam = smoothstep(-0.15, 0.35, shoreDist);
  foam *= 1.0 - smoothstep(0.45, max(uFoamWidth * 1.8, 1.6), shoreDist);
  float foamPulse = 0.75 + 0.25 * sin(uTime * 0.85 + shoreDist * 3.0 + wave * 3.0);
  foam = pow(max(foam, 0.0), 1.05) * foamPulse * max(uShoreFoam, 0.65);
  col = mix(col, uFoamColor, clamp(foam, 0.0, 0.92) * keep);

  vec3 fadeCol = uHorizon * (1.0 + uHorizonHaze * 0.45);
  col = mix(col, fadeCol, haze * 0.85);
  if (keep < 0.03) discard;

  gl_FragColor = vec4(col, keep);
}
`;

function emptyHexCenters(): THREE.Vector2[] {
  return Array.from({ length: WATER_MAX_HEXES }, () => new THREE.Vector2(0, 0));
}

export class WaterSurface {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private config: StyleConfig = { ...DEFAULT_STYLE_CONFIG };
  private rings = 2;
  private readonly sunDir = new THREE.Vector3(0.4, 0.85, 0.3).normalize();
  private readonly hexCenters = emptyHexCenters();
  private sdfTexture: THREE.DataTexture | null = null;

  constructor(config?: StyleConfig) {
    if (config) this.config = { ...config };
    this.material = new THREE.ShaderMaterial({
      vertexShader: waterVertexShader,
      fragmentShader: waterFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uWaveHeight: { value: this.config.waterWaveHeight },
        uWaveSpeed: { value: this.config.waterWaveSpeed },
        uDeepOcean: { value: new THREE.Color(this.config.waterDeepOcean) },
        uOcean: { value: new THREE.Color(this.config.waterOcean) },
        uLagoon: { value: new THREE.Color(this.config.waterLagoon) },
        uShallow: { value: new THREE.Color(this.config.waterShallow) },
        uBeachEdge: { value: new THREE.Color(this.config.waterBeachEdge) },
        uFoamColor: { value: new THREE.Color(this.config.waterFoam) },
        uShoreWidth: { value: this.config.waterShoreWidth },
        uDeepFade: { value: this.config.waterDeepFade },
        uSeaRadius: { value: 180 * 0.94 },
        uEdgeSoft: { value: this.config.waterEdgeSoft },
        uHorizon: { value: new THREE.Color(this.config.skyHorizon) },
        uHorizonHaze: { value: 0.22 },
        uBandIntensity: { value: this.config.waterBandIntensity },
        uBandScale: { value: this.config.waterBandScale },
        uBandSpeed: { value: this.config.waterBandSpeed },
        uFresnelStrength: { value: this.config.waterFresnelStrength },
        uFresnelPower: { value: this.config.waterFresnelPower },
        uSpecularIntensity: { value: this.config.waterSpecularIntensity },
        uSpecularPower: { value: this.config.waterSpecularPower },
        uShoreFoam: { value: this.config.waterShoreFoam },
        uFoamWidth: { value: this.config.waterFoamWidth },
        uCausticIntensity: { value: this.config.waterCausticIntensity },
        uCausticScale: { value: this.config.waterCausticScale },
        uCausticSpeed: { value: this.config.waterCausticSpeed },
        uSunDir: { value: this.sunDir.clone() },
        uSunColor: { value: new THREE.Color('#fff6e8') },
        uSkyFresnel: { value: new THREE.Color(this.config.waterLagoon) },
        uHexCenters: { value: this.hexCenters },
        uHexCount: { value: 0 },
        uHexApothem: { value: HEX_SIZE * Math.sqrt(3) * 0.5 },
        uSdfMap: { value: null },
        uSdfBounds: { value: new THREE.Vector4(-20, -20, 20, 20) },
        uUseIslandSdf: { value: 0 },
      },
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide,
    });

    const segs = Math.max(16, Math.round(this.config.waterSegments));
    const radius = 180;
    const geom = new THREE.CircleGeometry(radius, Math.max(64, segs * 2));
    geom.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geom, this.material);
    this.mesh.position.y = -0.08;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
    this.mesh.receiveShadow = false;
  }

  applyConfig(config: StyleConfig): void {
    const prevSegs = Math.max(16, Math.round(this.config.waterSegments));
    this.config = { ...config };
    const u = this.material.uniforms;
    u.uWaveHeight.value = config.waterWaveHeight;
    u.uWaveSpeed.value = config.waterWaveSpeed;
    u.uDeepOcean.value.set(config.waterDeepOcean);
    u.uOcean.value.set(config.waterOcean);
    u.uLagoon.value.set(config.waterLagoon);
    u.uShallow.value.set(config.waterShallow);
    u.uBeachEdge.value.set(config.waterBeachEdge);
    u.uFoamColor.value.set(config.waterFoam);
    u.uShoreWidth.value = config.waterShoreWidth;
    u.uDeepFade.value = config.waterDeepFade;
    u.uEdgeSoft.value = config.waterEdgeSoft;
    u.uHorizon.value.set(config.skyHorizon);
    u.uBandIntensity.value = config.waterBandIntensity;
    u.uBandScale.value = config.waterBandScale;
    u.uBandSpeed.value = config.waterBandSpeed;
    u.uFresnelStrength.value = config.waterFresnelStrength;
    u.uFresnelPower.value = config.waterFresnelPower;
    u.uSpecularIntensity.value = config.waterSpecularIntensity;
    u.uSpecularPower.value = config.waterSpecularPower;
    u.uShoreFoam.value = config.waterShoreFoam;
    u.uFoamWidth.value = config.waterFoamWidth;
    u.uCausticIntensity.value = config.waterCausticIntensity;
    u.uCausticScale.value = config.waterCausticScale;
    u.uCausticSpeed.value = config.waterCausticSpeed;
    u.uSkyFresnel.value.set(config.waterLagoon);

    const nextSegs = Math.max(16, Math.round(config.waterSegments));
    if (nextSegs !== prevSegs) this.rebuildGeometry(this.rings, nextSegs);
  }

  applyAtmosphere(_atm: AtmosphereSnapshot): void {
    // Prefer applyEnvironment — kept for API compatibility during migration.
  }

  /** Live Environment State drives water look — never regenerates SDF/mesh. */
  applyEnvironment(env: EnvironmentState): void {
    const u = this.material.uniforms;
    u.uDeepOcean.value.copy(env.waterDeepColor);
    u.uOcean.value.copy(env.waterOceanColor);
    u.uLagoon.value.copy(env.waterLagoonColor);
    u.uShallow.value.copy(env.waterShallowColor);
    u.uBeachEdge.value.copy(env.waterShelfColor);
    u.uFoamColor.value.copy(env.waterFoamColor);
    u.uSunColor.value.copy(env.waterSunColor);
    u.uSkyFresnel.value.copy(env.skyFresnelColor);
    u.uHorizon.value.copy(env.skyHorizonColor);
    u.uHorizonHaze.value = env.horizonHaze;
    u.uBandIntensity.value = env.waveBandIntensity;
    u.uFresnelStrength.value = env.fresnelStrength;
    u.uSpecularIntensity.value = env.specularIntensity;
    u.uCausticIntensity.value = env.causticIntensity;
    u.uShoreFoam.value = env.foamBrightness;
    this.setSunDirection(env.sunDirection);
  }

  setSunDirection(dir: THREE.Vector3): void {
    this.sunDir.copy(dir).normalize();
    this.material.uniforms.uSunDir.value.copy(this.sunDir);
  }

  setLandHexes(centers: { x: number; z: number }[], tileRadius = HEX_SIZE): void {
    const count = Math.min(centers.length, WATER_MAX_HEXES);
    for (let i = 0; i < WATER_MAX_HEXES; i++) {
      if (i < count) this.hexCenters[i]!.set(centers[i]!.x, centers[i]!.z);
      else this.hexCenters[i]!.set(0, 0);
    }
    this.material.uniforms.uHexCount.value = count;
    this.material.uniforms.uHexApothem.value = tileRadius * Math.sqrt(3) * 0.5;
    this.material.uniforms.uHexCenters.value = this.hexCenters;
  }

  /** Bind organic island SDF — preferred shoreline source. */
  setIslandSdf(world: WorldData): void {
    if (this.sdfTexture) this.sdfTexture.dispose();
    this.sdfTexture = createSdfDataTexture(world);
    const b = world.grid.bounds;
    this.material.uniforms.uSdfMap.value = this.sdfTexture;
    this.material.uniforms.uSdfBounds.value.set(b.minX, b.minZ, b.maxX, b.maxZ);
    this.material.uniforms.uUseIslandSdf.value = 1;
    this.material.uniforms.uHexCount.value = 0;
    // Fit sea disc to the generated world, not the raw hex apothem
    const extent = Math.max(
      Math.abs(b.minX),
      Math.abs(b.maxX),
      Math.abs(b.minZ),
      Math.abs(b.maxZ),
    );
    const radius = Math.max(80, extent * 3.2);
    const segs = Math.max(16, Math.round(this.config.waterSegments));
    const old = this.mesh.geometry;
    const geom = new THREE.CircleGeometry(radius, Math.max(96, segs * 2));
    geom.rotateX(-Math.PI / 2);
    this.mesh.geometry = geom;
    old.dispose();
    this.material.uniforms.uSeaRadius.value = radius * 0.94;
  }

  clearIslandSdf(): void {
    this.material.uniforms.uUseIslandSdf.value = 0;
    if (this.sdfTexture) {
      this.sdfTexture.dispose();
      this.sdfTexture = null;
    }
  }

  resize(rings: number): void {
    this.rings = rings;
    const segs = Math.max(16, Math.round(this.config.waterSegments));
    this.rebuildGeometry(rings, segs);
  }

  private rebuildGeometry(rings: number, segments: number): void {
    const apothem = islandHexApothem(rings, HEX_SIZE);
    const radius = Math.max(180, apothem * 24);
    const old = this.mesh.geometry;
    const geom = new THREE.CircleGeometry(radius, Math.max(64, segments * 2));
    geom.rotateX(-Math.PI / 2);
    this.mesh.geometry = geom;
    old.dispose();
    this.material.uniforms.uSeaRadius.value = radius * 0.94;
  }

  update(time: number): void {
    this.material.uniforms.uTime.value = time;
  }

  dispose(): void {
    this.clearIslandSdf();
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
