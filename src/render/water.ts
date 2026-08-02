import * as THREE from 'three';
import { HEX_SIZE, islandHexApothem } from '../game/board';
import type { StyleConfig } from './styleConfig';
import { DEFAULT_STYLE_CONFIG } from './styleConfig';

/**
 * Stylized tropical low-poly water — calm, painterly, aerial-friendly.
 * Shoreline follows the pointy-top hex island (not a circle).
 * Layers: depth gradient → shoreline → sine swells → wave bands →
 * soft Fresnel → satin specular → caustics → beach foam.
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

  // Smooth normals — swell tilt only (no high-frequency maps)
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
uniform float uLandRadius;
uniform float uShoreWidth;
uniform float uDeepFade;
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

varying vec3 vWorldPos;
varying vec3 vNormalW;
varying vec3 vViewDir;
varying float vWave;

// Pointy-top hex SDF (r = apothem / center-to-flat). Positive outside.
float sdHexagon(vec2 p, float r) {
  // Swap axes: IQ flat-top formula → pointy-top in XZ
  p = abs(p.yx);
  vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
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
  // Hex shoreline distance — follows the island outline, not a circle
  float shoreDist = sdHexagon(vWorldPos.xz, uLandRadius);
  float shore = max(uShoreWidth, 0.001);
  float deepSpan = max(uDeepFade, 0.001);

  // Mask interior land so tiles stay crisp
  if (shoreDist < -0.3) discard;

  // 1. Depth-based color gradient along hex shore distance
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

  // 2. Shoreline glow — crystal turquoise bloom near land
  float shoreGlow = 1.0 - smoothstep(0.0, shore * 0.7, shoreDist);
  shoreGlow = pow(max(shoreGlow, 0.0), 1.35);
  col = mix(col, uShallow, shoreGlow * 0.28);
  col = mix(col, uBeachEdge, shoreGlow * shoreGlow * 0.18);

  // 3. Large sine-wave color motion (readable from aerial cameras)
  float wt = uTime * uWaveSpeed;
  float wave =
    sin(vWorldPos.x * 0.30 + wt * 0.15) +
    sin(vWorldPos.z * 0.20 + wt * 0.10) +
    sin((vWorldPos.x + vWorldPos.z) * 0.15 + wt * 0.08);
  wave *= 1.0 / 3.0;
  // Keep calm but clearly alive — brighten/darken with the swell
  col += vec3(0.045) * wave;
  col = mix(col, uLagoon, max(wave, 0.0) * 0.06);
  col += vec3(0.02) * vWave;

  // 4. Long soft wave bands traveling toward the hex shore
  float radial = shoreDist * uBandScale - uTime * uBandSpeed;
  float drift = dot(vWorldPos.xz, vec2(0.72, 0.35)) * uBandScale * 0.55 - uTime * uBandSpeed * 0.65;
  float bands =
    softBand(radial) * 0.55 +
    softBand(radial * 0.5 + 1.4) * 0.25 +
    softBand(drift) * 0.20;
  // Fade bands near the beach so foam stays clean
  float bandMask = smoothstep(0.15, shore * 0.35, shoreDist);
  col += vec3(uBandIntensity) * bands * bandMask;

  vec3 N = normalize(vNormalW);
  vec3 V = normalize(vViewDir);
  vec3 L = normalize(uSunDir);

  // 5. Very subtle Fresnel
  float fres = pow(1.0 - max(dot(N, V), 0.0), uFresnelPower);
  fres *= uFresnelStrength;
  vec3 skyTint = mix(uLagoon, uOcean, 0.55);
  col = mix(col, skyTint, fres * 0.35);

  // 6. Broad satin specular
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), uSpecularPower);
  spec = smoothstep(0.0, 1.0, spec);
  // Swell wobbles the highlight slightly
  spec *= 0.85 + 0.15 * wave;
  col += uSunColor * spec * uSpecularIntensity;

  // 7. Soft animated caustics (shallow only)
  float shallowMask = 1.0 - smoothstep(0.0, shore * 0.95, shoreDist);
  shallowMask = pow(max(shallowMask, 0.0), 0.85);
  vec2 cauUv = vWorldPos.xz * uCausticScale;
  float cau = softCaustic(cauUv, uTime * uCausticSpeed);
  col += mix(uBeachEdge, uShallow, 0.4) * cau * uCausticIntensity * shallowMask;

  // 8. Thin soft foam along the hex beach edge
  float foam = smoothstep(-uFoamWidth * 0.35, uFoamWidth * 0.2, shoreDist);
  foam *= 1.0 - smoothstep(uFoamWidth * 0.25, uFoamWidth, shoreDist);
  float foamPulse = 0.78 + 0.22 * sin(uTime * 0.7 + shoreDist * 2.0 + wave * 2.5);
  foam = pow(max(foam, 0.0), 1.2) * foamPulse * uShoreFoam;
  col = mix(col, uFoamColor, clamp(foam, 0.0, 0.85));

  gl_FragColor = vec4(col, 1.0);
}
`;

export class WaterSurface {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private config: StyleConfig = { ...DEFAULT_STYLE_CONFIG };
  private rings = 2;
  private readonly sunDir = new THREE.Vector3(0.4, 0.85, 0.3).normalize();

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
        uLandRadius: { value: islandHexApothem(2) },
        uShoreWidth: { value: this.config.waterShoreWidth },
        uDeepFade: { value: this.config.waterDeepFade },
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
      },
      transparent: false,
      depthWrite: true,
      side: THREE.DoubleSide,
    });

    const segs = Math.max(16, Math.round(this.config.waterSegments));
    const geom = new THREE.PlaneGeometry(80, 80, segs, segs);
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

    const nextSegs = Math.max(16, Math.round(config.waterSegments));
    if (nextSegs !== prevSegs) this.rebuildGeometry(this.rings, nextSegs);
  }

  setSunDirection(dir: THREE.Vector3): void {
    this.sunDir.copy(dir).normalize();
    this.material.uniforms.uSunDir.value.copy(this.sunDir);
  }

  /** Fit shoreline to the pointy-top hex island for this ring count. */
  resize(rings: number): void {
    this.rings = rings;
    const segs = Math.max(16, Math.round(this.config.waterSegments));
    this.rebuildGeometry(rings, segs);
    this.material.uniforms.uLandRadius.value = islandHexApothem(rings, HEX_SIZE);
  }

  private rebuildGeometry(rings: number, segments: number): void {
    const apothem = islandHexApothem(rings, HEX_SIZE);
    const size = Math.max(48, apothem * 8);
    const old = this.mesh.geometry;
    const geom = new THREE.PlaneGeometry(size, size, segments, segments);
    geom.rotateX(-Math.PI / 2);
    this.mesh.geometry = geom;
    old.dispose();
  }

  update(time: number): void {
    this.material.uniforms.uTime.value = time;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
