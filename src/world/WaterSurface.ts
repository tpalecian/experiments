import * as THREE from 'three';
import { HEX_SIZE, islandHexApothem } from '../engine/board';
import { capWaterSegments, getQualityCaps } from '../core/Quality';
import type { AtmosphereSnapshot } from './Atmosphere';
import type { StyleConfig } from '../style/styleConfig';
import { DEFAULT_STYLE_CONFIG } from '../style/styleConfig';
import { WATER_INLAND_DISCARD, coastShaderChunk } from './islandField';

/** Max land hexes supported by the water shoreline SDF (huge map = 61). */
export const WATER_MAX_HEXES = 64;

/**
 * Bruno Simon–inspired reflective water for the island diorama (WebGL).
 *
 * Port of folio-2025 `WaterSurface.js` ideas into WebGL:
 *   - frosted mirrored scene (hash-blur stand-in via multi-tap)
 *   - organic coast SDF / discard (same field as the island mesh)
 *   - thin glowing shore lip flush to the beach (Bruno `shoreNode`)
 *   - sparse thin arc ripples on near-shore proximity (Bruno `ripplesNode`)
 *   - quiet open-water brightness drift (craft; default off)
 *   - depth colour underneath (navy → cyan shelf)
 *
 * Reference: https://github.com/brunosimon/folio-2025/blob/main/sources/Game/World/WaterSurface.js
 * Board meshes never regenerate for look changes.
 */
const waterVertexShader = /* glsl */ `
uniform float uTime;
uniform float uWaveHeight;
uniform float uWaveSpeed;
uniform mat4 uTextureMatrix;
uniform vec2 uHexCenters[${WATER_MAX_HEXES}];
uniform int uHexCount;
uniform float uHexApothem;

varying vec3 vWorldPos;
varying vec3 vNormalW;
varying vec3 vViewDir;
varying float vWave;
varying vec4 vReflectCoord;

${coastShaderChunk(WATER_MAX_HEXES)}

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

  float shore = shoreDistance(world.xz);
  float nearLand = 1.0 - smoothstep(0.0, ${(3.2 * HEX_SIZE).toFixed(3)}, shore);
  float amp = uWaveHeight * (1.0 - nearLand * 0.97);
  float displacement = mix(w * amp, abs(w) * amp * 0.15, nearLand);
  displacement = mix(displacement, max(displacement, 0.0), nearLand);

  world.y += displacement;
  vWave = w;

  vec3 n = normalize(vec3(-d.x * amp, 1.0, -d.y * amp));
  vNormalW = normalize(mat3(modelMatrix) * n);
  vWorldPos = world.xyz;
  vViewDir = normalize(cameraPosition - world.xyz);
  vReflectCoord = uTextureMatrix * world;

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
uniform float uBandSoftness;
uniform float uFresnelStrength;
uniform float uFresnelPower;
uniform float uSpecularIntensity;
uniform float uSpecularPower;
uniform float uShoreFoam;
uniform float uFoamWidth;
uniform float uFoamPulse;
uniform float uFoamPulseSpeed;
uniform float uShoreGlow;
uniform float uColorWave;
uniform float uCausticIntensity;
uniform float uCausticScale;
uniform float uCausticSpeed;
uniform float uReflectStrength;
uniform float uReflectDistort;
uniform float uReflectBlur;
uniform float uRippleFreq;
uniform float uRippleSpeed;
uniform float uRippleIntensity;
uniform float uDriftIntensity;
uniform float uDriftScale;
uniform float uDriftSpeed;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyFresnel;
uniform sampler2D tReflection;
uniform vec2 uHexCenters[${WATER_MAX_HEXES}];
uniform int uHexCount;
uniform float uHexApothem;
uniform float uIslandRadius;

varying vec3 vWorldPos;
varying vec3 vNormalW;
varying vec3 vViewDir;
varying float vWave;
varying vec4 vReflectCoord;

${coastShaderChunk(WATER_MAX_HEXES)}

float softBand(float x) {
  float s = 0.5 + 0.5 * sin(x);
  float soft = clamp(uBandSoftness, 0.15, 0.95);
  float lo = mix(0.45, 0.15, soft);
  float hi = mix(0.65, 0.9, soft);
  return smoothstep(lo, hi, s);
}

float softCaustic(vec2 p, float t) {
  float a = sin(p.x * 1.7 + t * 0.6) * sin(p.y * 1.3 - t * 0.45);
  float b = sin((p.x + p.y) * 1.1 - t * 0.35) * sin((p.x - p.y) * 0.9 + t * 0.5);
  float c = sin(p.x * 0.55 - t * 0.2) * sin(p.y * 0.65 + t * 0.18);
  float m = a * 0.45 + b * 0.35 + c * 0.20;
  return smoothstep(-0.15, 0.55, m);
}

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

// Cheap multi-tap blur of the mirrored scene (Bruno-like frosted reflection).
vec3 sampleReflection(vec2 uv, float distortAmp) {
  vec2 jitter = vec2(
    sin(uTime * 0.7 + vWorldPos.x * 0.35 + vWorldPos.z * 0.22),
    cos(uTime * 0.55 + vWorldPos.z * 0.4 - vWorldPos.x * 0.18)
  ) * distortAmp;

  float blur = max(uReflectBlur, 0.0);
  vec3 sum = texture2D(tReflection, uv + jitter).rgb;
  sum += texture2D(tReflection, uv + jitter + vec2( blur, 0.0)).rgb;
  sum += texture2D(tReflection, uv + jitter + vec2(-blur, 0.0)).rgb;
  sum += texture2D(tReflection, uv + jitter + vec2(0.0,  blur)).rgb;
  sum += texture2D(tReflection, uv + jitter + vec2(0.0, -blur)).rgb;
  sum += texture2D(tReflection, uv + jitter + vec2( blur,  blur) * 0.7).rgb;
  sum += texture2D(tReflection, uv + jitter + vec2(-blur, -blur) * 0.7).rgb;
  return sum / 7.0;
}

void main() {
  float shoreDist = shoreDistance(vWorldPos.xz);
  float shore = max(uShoreWidth, 0.001);
  float deepSpan = max(uDeepFade, 0.001);

  // Inland of the sand shelf — terrain covers this. Keep water over shallows.
  if (shoreDist < -${WATER_INLAND_DISCARD.toFixed(3)}) discard;

  // Organic coast ramp near land; circular envelope only in open ocean
  // so we do not paint hex-shaped iso-bands far from shore.
  float organicDepth = max(0.0, shoreDist);
  float radialDepth = max(0.0, length(vWorldPos.xz) - uIslandRadius);
  float depthDist = mix(organicDepth, radialDepth, smoothstep(1.4, 8.0, organicDepth));
  float depthT = clamp(depthDist / (shore + deepSpan), 0.0, 1.0);
  depthT = depthT * depthT * (3.0 - 2.0 * depthT);

  vec3 col = mix(uBeachEdge, uShallow, smoothstep(0.0, 0.18, depthT));
  col = mix(col, uLagoon, smoothstep(0.08, 0.38, depthT));
  col = mix(col, uOcean, smoothstep(0.28, 0.62, depthT));
  col = mix(col, uDeepOcean, smoothstep(0.5, 1.0, depthT));

  // 2. Soft cyan shelf wash — hex-accurate rim (depth palette is circular)
  float shelfWash = 1.0 - smoothstep(0.0, shore * 0.42, shoreDist);
  shelfWash = pow(max(shelfWash, 0.0), 1.55);
  col = mix(col, uShallow, shelfWash * uShoreGlow);

  // 3. Gentle colour motion
  float wt = uTime * uWaveSpeed;
  float wave =
    sin(vWorldPos.x * 0.30 + wt * 0.15) +
    sin(vWorldPos.z * 0.20 + wt * 0.10) +
    sin((vWorldPos.x + vWorldPos.z) * 0.15 + wt * 0.08);
  wave *= 1.0 / 3.0;
  col += vec3(uColorWave) * wave;
  col = mix(col, uLagoon, max(wave, 0.0) * uColorWave * 1.4);
  col += vec3(uColorWave * 0.5) * vWave;

  // 4. Soft travelling bands — world-space only (shoreDist phase = hex iso rings)
  float radial = length(vWorldPos.xz) * uBandScale * 0.35 - uTime * uBandSpeed;
  float bandDrift = dot(vWorldPos.xz, vec2(0.72, 0.35)) * uBandScale * 0.55 - uTime * uBandSpeed * 0.65;
  float bands =
    softBand(radial) * 0.55 +
    softBand(radial * 0.5 + 1.4) * 0.25 +
    softBand(bandDrift) * 0.20;
  col += vec3(uBandIntensity) * bands;

  vec3 N = normalize(vNormalW);
  vec3 V = normalize(vViewDir);
  vec3 L = normalize(uSunDir);

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

  // 5. Frosted mirror — softer, more painted (Bruno viewport hashBlur feel)
  vec2 ruv = vReflectCoord.xy / max(vReflectCoord.w, 0.0001);
  float fres = pow(1.0 - max(dot(N, V), 0.0), uFresnelPower);
  // Keep base depth colour dominant; reflection adds soft scene contact shadows
  float reflectAmt = clamp(uReflectStrength * (0.22 + fres * uFresnelStrength * 2.8), 0.0, 0.72) * keep;
  if (ruv.x > 0.0 && ruv.x < 1.0 && ruv.y > 0.0 && ruv.y < 1.0) {
    vec3 refl = sampleReflection(ruv, uReflectDistort * (0.5 + fres * 0.8));
    // Desaturate / darken reflection so water stays readable as painted navy
    float reflLuma = dot(refl, vec3(0.299, 0.587, 0.114));
    refl = mix(vec3(reflLuma), refl, 0.55) * 0.85;
    col = mix(col, refl, reflectAmt);
  } else {
    col = mix(col, uSkyFresnel, fres * uFresnelStrength * keep * 0.35);
  }

  // 6. Soft satin specular (matte folio look — not glitter)
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), uSpecularPower);
  spec = smoothstep(0.15, 1.0, spec);
  spec *= 0.7 + 0.3 * wave;
  col += uSunColor * spec * uSpecularIntensity * keep * (1.0 - reflectAmt * 0.65);

  // 7. Soft caustics in shallow water
  float shallowMask = 1.0 - smoothstep(0.0, shore * 0.95, shoreDist);
  shallowMask = pow(max(shallowMask, 0.0), 0.85);
  float cau = softCaustic(vWorldPos.xz * uCausticScale, uTime * uCausticSpeed);
  col += mix(uBeachEdge, uShallow, 0.4) * cau * uCausticIntensity * shallowMask * keep;

  // 7b. Soft open-water drift — quiet brightness only (craft knob; default off)
  float openWater = smoothstep(1.2, 4.0, shoreDist);
  vec2 driftUvA = vWorldPos.xz * uDriftScale + vec2(uTime * uDriftSpeed * 0.11, -uTime * uDriftSpeed * 0.07);
  vec2 driftUvB = vWorldPos.xz * uDriftScale * 1.55 + vec2(-uTime * uDriftSpeed * 0.06, uTime * uDriftSpeed * 0.09);
  float dnA = valueNoise(driftUvA);
  float dnB = valueNoise(driftUvB + vec2(2.7, 5.1));
  float dnC = valueNoise(driftUvA * 2.2 + vec2(uTime * 0.015, -1.3));
  float driftPatch = smoothstep(0.58, 0.82, dnA) * (1.0 - smoothstep(0.55, 0.85, dnB));
  driftPatch *= 0.4 + 0.6 * dnC;
  float driftPatch2 = smoothstep(0.64, 0.9, valueNoise(driftUvB * 0.7 + vec2(4.2, uTime * 0.012)));
  float driftWaves = max(driftPatch * 0.7, driftPatch2 * 0.35);
  col += vec3(0.04) * driftWaves * openWater * uDriftIntensity * keep;

  // 8. Bruno ripplesNode — iso-contours of the hex shoreline SDF
  // Those smooth outer "bubble" arcs are distance-field contours: near the
  // hexes they hug tile edges; farther out, min(hex SDF) rounds into arcs.
  // Isolated crescents are the same contour, broken by noise gates.
  //
  // Direction: prox - time → crests move toward land (prox↑ / shoreDist↓).
  // (prox + time was the outward flow visible in screenshots.)
  float prox = clamp(1.0 - shoreDist / 3.2, 0.0, 1.0);
  float slopeFreq = max(uRippleFreq, 0.05) * 6.5;
  float timed = prox - uTime * uRippleSpeed * 0.45;
  float band = timed * slopeFreq;
  float bandIdx = floor(band);
  float bandFrac = fract(band);

  vec2 coastUv = vWorldPos.xz * 0.28;
  float n1 = valueNoise(coastUv + vec2(bandIdx * 1.7, bandIdx * 0.9));
  float n2 = valueNoise(coastUv * 1.9 + vec2(-bandIdx * 0.6, bandIdx * 2.1));
  float n3 = valueNoise(vWorldPos.xz * 0.08 + vec2(bandIdx * 3.1, -2.4));

  // Bruno: fract - remap proximity attenuation + noise
  float atten = mix(1.15, 0.05, prox);
  float rippleField = bandFrac - atten + n1 * 0.35 + n2 * 0.15;
  // Soft side fades — hard step() was cutting crescent edges
  float accept = smoothstep(0.42, 0.62, rippleField);
  float arcGate = smoothstep(0.48, 0.72, n1 * 0.55 + n2 * 0.45);
  float crest = 1.0 - abs(bandFrac - mix(0.55, 0.82, n3));
  crest = pow(max(crest, 0.0), 5.5);
  // Keep crests closer to land so they still follow hex edges (less outer rounding)
  float nearShore = smoothstep(0.22, 0.5, prox) * (1.0 - smoothstep(0.82, 0.98, prox));
  float ripple = accept * arcGate * crest * nearShore * clamp(uRippleIntensity, 0.0, 1.2);

  // Shore foam — thick blob lip like a toy shoreline, not a thin glow ring
  float foamWidth = max(uFoamWidth, 0.08);
  float foamBand = smoothstep(-0.06 * foamWidth, 0.02, shoreDist) * (1.0 - smoothstep(0.04, foamWidth * 1.55, shoreDist));
  float blobA = valueNoise(vWorldPos.xz * 1.65);
  float blobB = valueNoise(vWorldPos.xz * 3.4 + vec2(2.1, -1.4));
  float blob = smoothstep(0.22, 0.58, blobA * 0.65 + blobB * 0.35);
  float thickFoam = foamBand * mix(0.45, 1.0, blob);
  float foamPulse = 1.0 - uFoamPulse + uFoamPulse * (0.5 + 0.5 * sin(uTime * uFoamPulseSpeed + shoreDist * 1.6 + wave * 1.4));
  float shoreFoam = thickFoam * uShoreFoam * foamPulse;
  float shoreGlowRim = foamBand * uShoreGlow * 0.85;

  col = mix(col, mix(uShallow, uFoamColor, 0.2), clamp(shoreGlowRim, 0.0, 0.45) * keep);

  float foam = max(ripple * 0.35, shoreFoam);
  col = mix(col, uFoamColor, clamp(foam, 0.0, 0.97) * keep);

  // 9. Horizon dissolve
  vec3 fadeCol = uHorizon * (1.0 + uHorizonHaze * 0.55);
  col = mix(col, fadeCol, haze);
  if (keep < 0.04) discard;

  float shallowAlpha = mix(0.28, 1.0, smoothstep(-0.08, 2.1, shoreDist));
  gl_FragColor = vec4(col, keep * shallowAlpha);
}
`;

function emptyHexCenters(): THREE.Vector2[] {
  return Array.from({ length: WATER_MAX_HEXES }, () => new THREE.Vector2(0, 0));
}

function reflectionSize(): number {
  return getQualityCaps().reflectionSize;
}

export class WaterSurface {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private config: StyleConfig = { ...DEFAULT_STYLE_CONFIG };
  private rings = 2;
  private readonly sunDir = new THREE.Vector3(0.4, 0.85, 0.3).normalize();
  private readonly hexCenters = emptyHexCenters();
  private readonly tmpColor = new THREE.Color();

  private readonly reflectionTarget: THREE.WebGLRenderTarget;
  private readonly reflectionCamera = new THREE.PerspectiveCamera();
  private readonly textureMatrix = new THREE.Matrix4();
  private readonly reflectorPlane = new THREE.Plane();
  private readonly normal = new THREE.Vector3();
  private readonly reflectorWorldPosition = new THREE.Vector3();
  private readonly cameraWorldPosition = new THREE.Vector3();
  private readonly rotationMatrix = new THREE.Matrix4();
  private readonly lookAtPosition = new THREE.Vector3(0, 0, -1);
  private readonly clipPlane = new THREE.Vector4();
  private readonly view = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly q = new THREE.Vector4();
  private readonly clipBias = 0.003;
  private reflecting = false;

  constructor(config?: StyleConfig) {
    if (config) this.config = { ...config };

    const size = reflectionSize();
    this.reflectionTarget = new THREE.WebGLRenderTarget(size, size, {
      type: THREE.HalfFloatType,
      samples: 0,
      depthBuffer: true,
    });
    this.reflectionTarget.texture.generateMipmaps = false;
    this.reflectionTarget.texture.minFilter = THREE.LinearFilter;
    this.reflectionTarget.texture.magFilter = THREE.LinearFilter;

    this.material = new THREE.ShaderMaterial({
      vertexShader: waterVertexShader,
      fragmentShader: waterFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uWaveHeight: { value: this.config.waterWaveHeight },
        uWaveSpeed: { value: this.config.waterWaveSpeed },
        uTextureMatrix: { value: this.textureMatrix },
        tReflection: { value: this.reflectionTarget.texture },
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
        uBandSoftness: { value: this.config.waterBandSoftness },
        uFresnelStrength: { value: this.config.waterFresnelStrength },
        uFresnelPower: { value: this.config.waterFresnelPower },
        uSpecularIntensity: { value: this.config.waterSpecularIntensity },
        uSpecularPower: { value: this.config.waterSpecularPower },
        uShoreFoam: { value: this.config.waterShoreFoam },
        uFoamWidth: { value: this.config.waterFoamWidth },
        uFoamPulse: { value: this.config.waterFoamPulse },
        uFoamPulseSpeed: { value: this.config.waterFoamPulseSpeed },
        uShoreGlow: { value: this.config.waterShoreGlow },
        uColorWave: { value: this.config.waterColorWave },
        uCausticIntensity: { value: this.config.waterCausticIntensity },
        uCausticScale: { value: this.config.waterCausticScale },
        uCausticSpeed: { value: this.config.waterCausticSpeed },
        uReflectStrength: { value: this.config.waterReflectStrength },
        uReflectDistort: { value: this.config.waterReflectDistort },
        uReflectBlur: { value: this.config.waterReflectBlur },
        uRippleFreq: { value: this.config.waterRippleFreq },
        uRippleSpeed: { value: this.config.waterRippleSpeed },
        uRippleIntensity: { value: this.config.waterRippleIntensity },
        uDriftIntensity: { value: this.config.waterDriftIntensity },
        uDriftScale: { value: this.config.waterDriftScale },
        uDriftSpeed: { value: this.config.waterDriftSpeed },
        uSunDir: { value: this.sunDir.clone() },
        uSunColor: { value: new THREE.Color('#fff6e8') },
        uSkyFresnel: { value: new THREE.Color(this.config.waterLagoon) },
        uHexCenters: { value: this.hexCenters },
        uHexCount: { value: 0 },
        uHexApothem: { value: HEX_SIZE * Math.sqrt(3) * 0.5 },
        uIslandRadius: { value: islandHexApothem(2, HEX_SIZE) },
      },
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide,
    });

    const segs = capWaterSegments(this.config.waterSegments);
    const radius = 180;
    const geom = new THREE.CircleGeometry(radius, Math.max(64, segs * 2));
    geom.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geom, this.material);
    this.mesh.position.y = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
    this.mesh.receiveShadow = false;
  }

  applyConfig(config: StyleConfig): void {
    const prevSegs = capWaterSegments(this.config.waterSegments);
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
    u.uBandSoftness.value = config.waterBandSoftness;
    u.uFresnelStrength.value = config.waterFresnelStrength;
    u.uFresnelPower.value = config.waterFresnelPower;
    u.uSpecularIntensity.value = config.waterSpecularIntensity;
    u.uSpecularPower.value = config.waterSpecularPower;
    u.uShoreFoam.value = config.waterShoreFoam;
    u.uFoamWidth.value = config.waterFoamWidth;
    u.uFoamPulse.value = config.waterFoamPulse;
    u.uFoamPulseSpeed.value = config.waterFoamPulseSpeed;
    u.uShoreGlow.value = config.waterShoreGlow;
    u.uColorWave.value = config.waterColorWave;
    u.uCausticIntensity.value = config.waterCausticIntensity;
    u.uCausticScale.value = config.waterCausticScale;
    u.uCausticSpeed.value = config.waterCausticSpeed;
    u.uReflectStrength.value = config.waterReflectStrength;
    u.uReflectDistort.value = config.waterReflectDistort;
    u.uReflectBlur.value = config.waterReflectBlur;
    u.uRippleFreq.value = config.waterRippleFreq;
    u.uRippleSpeed.value = config.waterRippleSpeed;
    u.uRippleIntensity.value = config.waterRippleIntensity;
    u.uDriftIntensity.value = config.waterDriftIntensity;
    u.uDriftScale.value = config.waterDriftScale;
    u.uDriftSpeed.value = config.waterDriftSpeed;
    u.uSkyFresnel.value.set(config.waterLagoon);

    const nextSegs = capWaterSegments(config.waterSegments);
    if (nextSegs !== prevSegs) this.rebuildGeometry(this.rings, nextSegs);
  }

  applyAtmosphere(atm: AtmosphereSnapshot): void {
    const u = this.material.uniforms;
    const bright = atm.waterBrightness;
    const tintMix = atm.waterTintMix;
    const tint = atm.waterTint;
    const paletteMix = atm.waterPaletteMix;

    const tmp = this.tmpColor;
    const composeBand = (craftHex: string, scheme: THREE.Color, uniform: { value: THREE.Color }) => {
      tmp.set(craftHex).lerp(scheme, paletteMix);
      tmp.multiplyScalar(bright).lerp(tint, tintMix);
      uniform.value.copy(tmp);
    };

    composeBand(this.config.waterDeepOcean, atm.waterDeep, u.uDeepOcean);
    composeBand(this.config.waterOcean, atm.waterOcean, u.uOcean);
    composeBand(this.config.waterLagoon, atm.waterLagoon, u.uLagoon);
    composeBand(this.config.waterShallow, atm.waterShallow, u.uShallow);
    composeBand(this.config.waterBeachEdge, atm.waterShelf, u.uBeachEdge);

    tmp.set(this.config.waterFoam).lerp(atm.waterFoamColor, paletteMix);
    tmp.multiplyScalar(atm.foamBrightness);
    u.uFoamColor.value.copy(tmp);

    u.uSunColor.value.copy(atm.waterSunColor);
    u.uSkyFresnel.value.copy(atm.skyFresnelColor);
    u.uHorizon.value.copy(atm.skyHorizon);
    u.uHorizonHaze.value = atm.horizonHaze;

    const fresnelRef = 0.12;
    const specularRef = 0.28;
    const causticRef = 0.08;
    u.uFresnelStrength.value =
      this.config.waterFresnelStrength * (atm.waterFresnelStrength / Math.max(fresnelRef, 0.001));
    u.uSpecularIntensity.value =
      this.config.waterSpecularIntensity * (atm.waterSpecularIntensity / Math.max(specularRef, 0.001));
    u.uCausticIntensity.value =
      this.config.waterCausticIntensity * (atm.waterCausticIntensity / Math.max(causticRef, 0.001));
    u.uBandIntensity.value = this.config.waterBandIntensity * atm.waveBandIntensity;
    u.uShoreFoam.value = this.config.waterShoreFoam * atm.foamBrightness;
    u.uRippleIntensity.value = this.config.waterRippleIntensity * atm.foamBrightness;
  }

  setSunDirection(dir: THREE.Vector3): void {
    this.sunDir.copy(dir).normalize();
    this.material.uniforms.uSunDir.value.copy(this.sunDir);
  }

  setLandHexes(centers: { x: number; z: number }[], tileRadius = HEX_SIZE): void {
    const count = Math.min(centers.length, WATER_MAX_HEXES);
    const tileApothem = tileRadius * Math.sqrt(3) * 0.5;
    let islandR = tileApothem;
    for (let i = 0; i < WATER_MAX_HEXES; i++) {
      if (i < count) {
        this.hexCenters[i].set(centers[i].x, centers[i].z);
        islandR = Math.max(islandR, Math.hypot(centers[i].x, centers[i].z) + tileApothem);
      } else {
        this.hexCenters[i].set(0, 0);
      }
    }
    this.material.uniforms.uHexCount.value = count;
    this.material.uniforms.uHexApothem.value = tileApothem;
    this.material.uniforms.uHexCenters.value = this.hexCenters;
    this.material.uniforms.uIslandRadius.value = islandR;
  }

  resize(rings: number): void {
    this.rings = rings;
    const segs = capWaterSegments(this.config.waterSegments);
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
    this.material.uniforms.uIslandRadius.value = apothem;
  }

  /**
   * Render mirrored scene into the reflection RT (Bruno-like frosted mirror).
   * Call once per frame before the main render, with the water mesh hidden.
   */
  renderReflection(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ): void {
    if (this.reflecting) return;
    if (this.config.waterReflectStrength <= 0.001) return;

    this.reflecting = true;
    const wasVisible = this.mesh.visible;
    this.mesh.visible = false;

    this.reflectorWorldPosition.setFromMatrixPosition(this.mesh.matrixWorld);
    this.cameraWorldPosition.setFromMatrixPosition(camera.matrixWorld);
    this.rotationMatrix.extractRotation(this.mesh.matrixWorld);

    this.normal.set(0, 1, 0);
    this.view.subVectors(this.reflectorWorldPosition, this.cameraWorldPosition);
    if (this.view.dot(this.normal) > 0) {
      this.mesh.visible = wasVisible;
      this.reflecting = false;
      return;
    }

    this.view.reflect(this.normal).negate();
    this.view.add(this.reflectorWorldPosition);

    this.rotationMatrix.extractRotation(camera.matrixWorld);
    this.lookAtPosition.set(0, 0, -1);
    this.lookAtPosition.applyMatrix4(this.rotationMatrix);
    this.lookAtPosition.add(this.cameraWorldPosition);

    this.target.subVectors(this.reflectorWorldPosition, this.lookAtPosition);
    this.target.reflect(this.normal).negate();
    this.target.add(this.reflectorWorldPosition);

    this.reflectionCamera.position.copy(this.view);
    this.reflectionCamera.up.set(0, 1, 0).applyMatrix4(this.rotationMatrix).reflect(this.normal);
    this.reflectionCamera.lookAt(this.target);
    this.reflectionCamera.far = (camera as THREE.PerspectiveCamera).far;
    this.reflectionCamera.updateMatrixWorld();
    this.reflectionCamera.projectionMatrix.copy((camera as THREE.PerspectiveCamera).projectionMatrix);

    this.reflectorPlane.setFromNormalAndCoplanarPoint(this.normal, this.reflectorWorldPosition);
    this.reflectorPlane.applyMatrix4(this.reflectionCamera.matrixWorldInverse);

    this.clipPlane.set(
      this.reflectorPlane.normal.x,
      this.reflectorPlane.normal.y,
      this.reflectorPlane.normal.z,
      this.reflectorPlane.constant,
    );

    const projectionMatrix = this.reflectionCamera.projectionMatrix;
    this.q.x = (Math.sign(this.clipPlane.x) + projectionMatrix.elements[8]) / projectionMatrix.elements[0];
    this.q.y = (Math.sign(this.clipPlane.y) + projectionMatrix.elements[9]) / projectionMatrix.elements[5];
    this.q.z = -1;
    this.q.w = (1 + projectionMatrix.elements[10]) / projectionMatrix.elements[14];

    this.clipPlane.multiplyScalar(2 / this.clipPlane.dot(this.q));
    projectionMatrix.elements[2] = this.clipPlane.x;
    projectionMatrix.elements[6] = this.clipPlane.y;
    projectionMatrix.elements[10] = this.clipPlane.z + 1 - this.clipBias;
    projectionMatrix.elements[14] = this.clipPlane.w;

    this.textureMatrix.set(
      0.5, 0.0, 0.0, 0.5,
      0.0, 0.5, 0.0, 0.5,
      0.0, 0.0, 0.5, 0.5,
      0.0, 0.0, 0.0, 1.0,
    );
    this.textureMatrix.multiply(this.reflectionCamera.projectionMatrix);
    this.textureMatrix.multiply(this.reflectionCamera.matrixWorldInverse);
    this.textureMatrix.multiply(this.mesh.matrixWorld);

    const currentXr = renderer.xr.enabled;
    const currentShadow = renderer.shadowMap.autoUpdate;
    renderer.xr.enabled = false;
    renderer.shadowMap.autoUpdate = false;

    const currentRenderTarget = renderer.getRenderTarget();
    const currentXrEnabled = renderer.xr.enabled;
    void currentXrEnabled;

    renderer.setRenderTarget(this.reflectionTarget);
    if (renderer.autoClear === false) renderer.clear();
    renderer.render(scene, this.reflectionCamera);
    renderer.setRenderTarget(currentRenderTarget);

    renderer.xr.enabled = currentXr;
    renderer.shadowMap.autoUpdate = currentShadow;

    this.mesh.visible = wasVisible;
    this.reflecting = false;
  }

  update(time: number): void {
    this.material.uniforms.uTime.value = time;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.reflectionTarget.dispose();
  }
}
