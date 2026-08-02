import * as THREE from 'three';
import type { StyleConfig } from './styleConfig';
import { DEFAULT_STYLE_CONFIG } from './styleConfig';

/**
 * Stylized tropical low-poly water — calm, painterly, aerial-friendly.
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

void swellDeriv(vec2 p, float t, out float dx, out float dy) {
  dx =
    0.30 * cos(p.x * 0.30 + t * 0.15) +
    0.15 * cos((p.x + p.y) * 0.15 + t * 0.08);
  dy =
    0.20 * cos(p.y * 0.20 + t * 0.10) +
    0.15 * cos((p.x + p.y) * 0.15 + t * 0.08);
  dx *= 1.0 / 3.0;
  dy *= 1.0 / 3.0;
}

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  float t = uTime * uWaveSpeed;
  float w = swell(world.xz, t);
  float dx;
  float dy;
  swellDeriv(world.xz, t, dx, dy);

  world.y += w * uWaveHeight;
  vWave = w;

  // Extremely smooth normals — tiny swell tilt only
  vec3 n = normalize(vec3(-dx * uWaveHeight, 1.0, -dy * uWaveHeight));
  vNormalW = normalize(mat3(modelMatrix) * n);
  vWorldPos = world.xyz;

  vec3 cam = cameraPosition;
  vViewDir = normalize(cam - world.xyz);

  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const waterFragmentShader = /* glsl */ `
uniform float uTime;
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

float softBand(float x) {
  // Low-contrast, blurred swell highlight
  float s = 0.5 + 0.5 * sin(x);
  return smoothstep(0.35, 0.85, s);
}

float softCaustic(vec2 p, float t) {
  // Soft projected caustics — no high-frequency noise
  float a = sin(p.x * 1.7 + t * 0.6) * sin(p.y * 1.3 - t * 0.45);
  float b = sin((p.x + p.y) * 1.1 - t * 0.35) * sin((p.x - p.y) * 0.9 + t * 0.5);
  float c = sin(p.x * 0.55 - t * 0.2) * sin(p.y * 0.65 + t * 0.18);
  float m = a * 0.45 + b * 0.35 + c * 0.20;
  return smoothstep(-0.15, 0.55, m);
}

void main() {
  float dist = length(vWorldPos.xz);
  float shore = max(uShoreWidth, 0.001);
  float deepSpan = max(uDeepFade, 0.001);

  // 1. Depth-based color gradient (wide, soft stops)
  float d0 = uLandRadius;
  float d1 = uLandRadius + shore * 0.22;
  float d2 = uLandRadius + shore * 0.55;
  float d3 = uLandRadius + shore * 1.05;
  float d4 = uLandRadius + shore + deepSpan;

  float tBeach = 1.0 - smoothstep(d0, d1, dist);
  float tShallow = smoothstep(d0, d1, dist) * (1.0 - smoothstep(d1, d2, dist));
  float tLagoon = smoothstep(d1, d2, dist) * (1.0 - smoothstep(d2, d3, dist));
  float tOcean = smoothstep(d2, d3, dist) * (1.0 - smoothstep(d3, d4, dist));
  float tDeep = smoothstep(d3, d4, dist);

  // Normalize soft weights for a painterly blend
  float wSum = tBeach + tShallow + tLagoon + tOcean + tDeep + 1e-5;
  vec3 col =
    (uBeachEdge * tBeach +
     uShallow * tShallow +
     uLagoon * tLagoon +
     uOcean * tOcean +
     uDeepOcean * tDeep) / wSum;

  // 2. Shoreline glow — crystal turquoise bloom near land
  float shoreGlow = 1.0 - smoothstep(uLandRadius, uLandRadius + shore * 0.7, dist);
  shoreGlow = pow(shoreGlow, 1.35);
  col = mix(col, uShallow, shoreGlow * 0.28);
  col = mix(col, uBeachEdge, shoreGlow * shoreGlow * 0.18);

  // Slight swell tint (almost imperceptible)
  col += vec3(0.012) * vWave;

  // 4. Long soft wave bands traveling toward shore (radial swells)
  float radial = dist * uBandScale - uTime * uBandSpeed;
  float angular = atan(vWorldPos.z, vWorldPos.x) * 0.35;
  float bands =
    softBand(radial) * 0.65 +
    softBand(radial * 0.55 + angular + 1.7) * 0.35;
  bands = mix(0.0, bands, smoothstep(uLandRadius + 0.2, uLandRadius + shore * 0.4, dist));
  col += vec3(uBandIntensity) * bands;

  vec3 N = normalize(vNormalW);
  vec3 V = normalize(vViewDir);
  vec3 L = normalize(uSunDir);

  // 5. Very subtle Fresnel — water mostly shows its own color
  float fres = pow(1.0 - max(dot(N, V), 0.0), uFresnelPower);
  fres *= uFresnelStrength;
  vec3 skyTint = mix(uLagoon, uOcean, 0.55);
  col = mix(col, skyTint, fres * 0.35);

  // 6. Broad satin specular (not glass)
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), uSpecularPower);
  // Soften with a wide shoulder
  spec = smoothstep(0.0, 1.0, spec);
  col += uSunColor * spec * uSpecularIntensity;

  // 7. Soft animated caustics on the imagined sea floor (shallow only)
  float shallowMask = 1.0 - smoothstep(uLandRadius, uLandRadius + shore * 0.95, dist);
  shallowMask = pow(shallowMask, 0.85);
  vec2 cauUv = vWorldPos.xz * uCausticScale;
  float cau = softCaustic(cauUv, uTime * uCausticSpeed);
  col += mix(uBeachEdge, uShallow, 0.4) * cau * uCausticIntensity * shallowMask;

  // 8. Thin soft beach foam where waves meet land
  float foamInner = uLandRadius - uFoamWidth * 0.15;
  float foamOuter = uLandRadius + uFoamWidth;
  float foam = smoothstep(foamInner, uLandRadius + uFoamWidth * 0.25, dist);
  foam *= 1.0 - smoothstep(uLandRadius + uFoamWidth * 0.35, foamOuter, dist);
  // Gentle swell modulation — soft edges, no noise
  float foamPulse = 0.82 + 0.18 * sin(uTime * 0.55 + dist * 1.4 + vWave * 2.0);
  foam = pow(foam, 1.25) * foamPulse * uShoreFoam;
  col = mix(col, uFoamColor, clamp(foam, 0.0, 0.85));

  // Mask out interior land disc so island tiles stay crisp
  float landMask = smoothstep(uLandRadius - 0.35, uLandRadius + 0.05, dist);
  if (landMask < 0.001) discard;

  gl_FragColor = vec4(col, landMask);
}
`;

export class WaterSurface {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private config: StyleConfig = { ...DEFAULT_STYLE_CONFIG };
  private landRadius = 5;
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
        uLandRadius: { value: 5 },
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
      transparent: true,
      depthWrite: false,
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
    if (nextSegs !== prevSegs) this.rebuildGeometry(this.landRadius, nextSegs);
  }

  setSunDirection(dir: THREE.Vector3): void {
    this.sunDir.copy(dir).normalize();
    this.material.uniforms.uSunDir.value.copy(this.sunDir);
  }

  resize(landRadius: number): void {
    this.landRadius = landRadius;
    const segs = Math.max(16, Math.round(this.config.waterSegments));
    this.rebuildGeometry(landRadius, segs);
    this.material.uniforms.uLandRadius.value = landRadius;
  }

  private rebuildGeometry(landRadius: number, segments: number): void {
    const size = Math.max(48, landRadius * 9);
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
