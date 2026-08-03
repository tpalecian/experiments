import * as THREE from 'three';
import { HEX_SIZE, islandHexApothem } from '../game/board';
import type { AtmosphereSnapshot } from './atmosphere';
import type { StyleConfig } from './styleConfig';
import { DEFAULT_STYLE_CONFIG } from './styleConfig';

/** Max land hexes supported by the water shoreline SDF (huge map = 61). */
export const WATER_MAX_HEXES = 64;

/** Still-water plane height — coastal beaches meet the sea here. */
export const SEA_LEVEL = -0.08;

/**
 * Stylized tropical low-poly water — calm, painterly, aerial-friendly.
 * Shoreline is the SDF union of every land hex so foam/depth hug tile edges.
 * Layers: depth gradient → shoreline → sine swells → wave bands →
 * soft Fresnel → satin specular → caustics → beach foam → horizon alpha fade.
 * Geometry is a large disc that soft-dissolves into the sky so no hard sea rim.
 */
const waterVertexShader = /* glsl */ `
uniform float uTime;
uniform float uWaveHeight;
uniform float uWaveSpeed;
uniform vec2 uHexCenters[${WATER_MAX_HEXES}];
uniform int uHexCount;
uniform float uHexApothem;

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

float shoreDistance(vec2 p) {
  float d = 1e5;
  for (int i = 0; i < ${WATER_MAX_HEXES}; i++) {
    float alive = step(float(i), float(uHexCount) - 0.5);
    float hd = sdHexagon(p - uHexCenters[i], uHexApothem);
    d = min(d, mix(1e5, hd, alive));
  }
  return d;
}

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

  // Calm the swell at the beach so the shoreline stays level with the sand.
  float shoreDist = shoreDistance(world.xz);
  float calm = smoothstep(0.05, 1.35, shoreDist);
  float amp = uWaveHeight * calm;

  world.y += w * amp;
  vWave = w * calm;

  vec3 n = normalize(vec3(-d.x * amp, 1.0, -d.y * amp));
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

varying vec3 vWorldPos;
varying vec3 vNormalW;
varying vec3 vViewDir;
varying float vWave;

// Pointy-top hex SDF (r = apothem / center-to-flat). Positive outside.
float sdHexagon(vec2 p, float r) {
  p = abs(p.yx);
  vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}

// Distance to the island coast = SDF union of every land tile.
float shoreDistance(vec2 p) {
  float d = 1e5;
  for (int i = 0; i < ${WATER_MAX_HEXES}; i++) {
    float alive = step(float(i), float(uHexCount) - 0.5);
    float hd = sdHexagon(p - uHexCenters[i], uHexApothem);
    d = min(d, mix(1e5, hd, alive));
  }
  return d;
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
  float shore = max(uShoreWidth, 0.001);
  float deepSpan = max(uDeepFade, 0.001);

  // Under land tiles — keep water out so hex edges stay crisp
  if (shoreDist < -0.02) discard;

  // 1. Depth gradient measured from actual tile coasts
  float d0 = 0.0;
  float d1 = shore * 0.22;
  float d2 = shore * 0.55;
  float d3 = shore * 1.05;
  float d4 = shore + deepSpan;

  float tBeach = 1.0 - smoothstep(d0, d1, shoreDist);
  float tShallow = smoothstep(d0, d1, shoreDist) * (1.0 - smoothstep(d1, d2, shoreDist));
  float tLagoon = smoothstep(d1, d2, shoreDist) * (1.0 - smoothstep(d2, d3, shoreDist));
  float tOcean = smoothstep(d2, d3, shoreDist) * (1.0 - smoothstep(d3, d4, shoreDist));
  float tDeep = smoothstep(d3, d4, shoreDist);

  float wSum = tBeach + tShallow + tLagoon + tOcean + tDeep + 1e-5;
  vec3 col =
    (uBeachEdge * tBeach +
     uShallow * tShallow +
     uLagoon * tLagoon +
     uOcean * tOcean +
     uDeepOcean * tDeep) / wSum;

  // 2. Soft near-shore turquoise (no separate geometric halo)
  float shoreGlow = 1.0 - smoothstep(0.0, shore * 0.45, shoreDist);
  shoreGlow = pow(max(shoreGlow, 0.0), 1.6);
  col = mix(col, uShallow, shoreGlow * 0.16);

  // 3. Large sine-wave color motion — runs all the way to the hex edges
  float wt = uTime * uWaveSpeed;
  float wave =
    sin(vWorldPos.x * 0.30 + wt * 0.15) +
    sin(vWorldPos.z * 0.20 + wt * 0.10) +
    sin((vWorldPos.x + vWorldPos.z) * 0.15 + wt * 0.08);
  wave *= 1.0 / 3.0;
  col += vec3(0.05) * wave;
  col = mix(col, uLagoon, max(wave, 0.0) * 0.07);
  col += vec3(0.025) * vWave;

  // 4. Soft wave bands traveling toward shore — including right at the tiles
  float radial = shoreDist * uBandScale - uTime * uBandSpeed;
  float drift = dot(vWorldPos.xz, vec2(0.72, 0.35)) * uBandScale * 0.55 - uTime * uBandSpeed * 0.65;
  float bands =
    softBand(radial) * 0.55 +
    softBand(radial * 0.5 + 1.4) * 0.25 +
    softBand(drift) * 0.20;
  col += vec3(uBandIntensity) * bands;

  vec3 N = normalize(vNormalW);
  vec3 V = normalize(vViewDir);
  vec3 L = normalize(uSunDir);

  // Horizon dissolve weight — computed early so lighting can't draw a bright rim.
  float seaR = max(uSeaRadius, 1.0);
  float soft = max(uEdgeSoft, seaR * 0.55);
  float radialDist = length(vWorldPos.xz);
  float edgeFade = smoothstep(seaR - soft, seaR, radialDist);

  float camDist = length(cameraPosition - vWorldPos);
  float distFade = smoothstep(14.0, 48.0, camDist);

  vec3 fromCam = normalize(vWorldPos - cameraPosition);
  float horizonFade = smoothstep(-0.28, -0.01, fromCam.y);
  horizonFade *= smoothstep(10.0, 36.0, camDist);

  float ndotvEarly = max(dot(N, V), 0.0);
  float graze = pow(1.0 - ndotvEarly, 1.6) * distFade;

  float haze = max(edgeFade, max(distFade * 0.92, max(horizonFade, graze)));
  haze = clamp(haze, 0.0, 1.0);
  haze = haze * haze * (3.0 - 2.0 * haze);
  float keep = 1.0 - haze;

  // 5. Subtle Fresnel — tinted by sky atmosphere (killed toward the rim)
  float fres = pow(1.0 - max(dot(N, V), 0.0), uFresnelPower);
  fres *= uFresnelStrength * keep;
  col = mix(col, uSkyFresnel, fres * 0.35);

  // 6. Satin specular — no grazing hotspot line at the horizon
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), uSpecularPower);
  spec = smoothstep(0.0, 1.0, spec);
  spec *= 0.85 + 0.15 * wave;
  col += uSunColor * spec * uSpecularIntensity * keep;

  // 7. Soft caustics in shallow water
  float shallowMask = 1.0 - smoothstep(0.0, shore * 0.95, shoreDist);
  shallowMask = pow(max(shallowMask, 0.0), 0.85);
  float cau = softCaustic(vWorldPos.xz * uCausticScale, uTime * uCausticSpeed);
  col += mix(uBeachEdge, uShallow, 0.4) * cau * uCausticIntensity * shallowMask * keep;

  // 8. Thin foam exactly where water meets each land hex edge
  float foam = smoothstep(-uFoamWidth * 0.2, uFoamWidth * 0.15, shoreDist);
  foam *= 1.0 - smoothstep(uFoamWidth * 0.2, uFoamWidth, shoreDist);
  float foamPulse = 0.78 + 0.22 * sin(uTime * 0.7 + shoreDist * 2.0 + wave * 2.5);
  foam = pow(max(foam, 0.0), 1.15) * foamPulse * uShoreFoam;
  col = mix(col, uFoamColor, clamp(foam, 0.0, 0.85) * keep);

  // 9. Dissolve into the live sky horizon (incl. bloom) so morning/evening/night match.
  // Avoid mixing deep-ocean cyan here — that fringe is what reads as a TOD-dependent line.
  vec3 fadeCol = uHorizon * (1.0 + uHorizonHaze * 0.55);
  col = mix(col, fadeCol, haze);
  if (keep < 0.04) discard;

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
        // Pointy-top tile apothem (center → flat) matches BoardView HEX_SIZE tiles
        uHexApothem: { value: HEX_SIZE * Math.sqrt(3) * 0.5 },
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
    this.mesh.position.y = SEA_LEVEL;
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
    // Base palette — atmosphere re-tints these every frame.
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

  /**
   * Apply game-level atmosphere: brightness, tint, specular, fresnel, caustics, sun color.
   * Preserves style-crafted base palette while adapting water to time of day.
   */
  applyAtmosphere(atm: AtmosphereSnapshot): void {
    const u = this.material.uniforms;
    const bright = atm.waterBrightness;
    const mix = atm.waterTintMix;
    const tint = atm.waterTint;

    const applyTint = (uniform: { value: THREE.Color }, baseHex: string) => {
      uniform.value.set(baseHex).multiplyScalar(bright).lerp(tint, mix);
    };

    applyTint(u.uDeepOcean, this.config.waterDeepOcean);
    applyTint(u.uOcean, this.config.waterOcean);
    applyTint(u.uLagoon, this.config.waterLagoon);
    applyTint(u.uShallow, this.config.waterShallow);
    applyTint(u.uBeachEdge, this.config.waterBeachEdge);

    u.uSunColor.value.copy(atm.waterSunColor);
    u.uSkyFresnel.value.copy(atm.skyFresnelColor);
    // Dissolve into the same horizon the sky shader blooms — no leftover ocean fringe.
    u.uHorizon.value.copy(atm.skyHorizon);
    u.uHorizonHaze.value = atm.horizonHaze;
    u.uSpecularIntensity.value = atm.waterSpecularIntensity;
    u.uFresnelStrength.value = atm.waterFresnelStrength;
    u.uCausticIntensity.value = atm.waterCausticIntensity;
  }

  setSunDirection(dir: THREE.Vector3): void {
    this.sunDir.copy(dir).normalize();
    this.material.uniforms.uSunDir.value.copy(this.sunDir);
  }

  /**
   * Feed land hex world centers so the shoreline SDF hugs every tile edge.
   * `tileRadius` is center-to-vertex (same as BoardView HEX_SIZE).
   * `shorePad` expands the SDF past the hex (e.g. beach shelf width) so foam
   * meets the outer beach lip rather than the tile wall.
   */
  setLandHexes(
    centers: { x: number; z: number }[],
    tileRadius = HEX_SIZE,
    shorePad = 0,
  ): void {
    const count = Math.min(centers.length, WATER_MAX_HEXES);
    for (let i = 0; i < WATER_MAX_HEXES; i++) {
      if (i < count) this.hexCenters[i].set(centers[i].x, centers[i].z);
      else this.hexCenters[i].set(0, 0);
    }
    this.material.uniforms.uHexCount.value = count;
    this.material.uniforms.uHexApothem.value =
      tileRadius * Math.sqrt(3) * 0.5 + shorePad;
    this.material.uniforms.uHexCenters.value = this.hexCenters;
  }

  resize(rings: number): void {
    this.rings = rings;
    const segs = Math.max(16, Math.round(this.config.waterSegments));
    this.rebuildGeometry(rings, segs);
  }

  private rebuildGeometry(rings: number, segments: number): void {
    const apothem = islandHexApothem(rings, HEX_SIZE);
    // Large disc; soft rim is wide so grazing views still dissolve in screen space.
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
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
