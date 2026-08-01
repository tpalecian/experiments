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
uniform float uTime;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunColor;
uniform vec3 uSunDir;
uniform float uCloudCover;

varying vec3 vDir;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x),
        mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
        mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z
  );
}

float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.0 + 0.15;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec3 dir = normalize(vDir);
  float h = dir.y * 0.5 + 0.5;
  // Warm cozy horizon wash into playful blue zenith
  vec3 sky = mix(uHorizon, uZenith, smoothstep(0.05, 0.75, h));
  sky = floor(sky * 6.0 + 0.5) / 6.0;

  float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
  sky += uSunColor * pow(sunDot, 32.0) * 1.1;
  sky += uSunColor * pow(sunDot, 4.0) * 0.18;

  if (dir.y > -0.02) {
    vec3 cloudP = dir * 2.0;
    cloudP.x += uTime * 0.015;
    cloudP.z += uTime * 0.01;
    float n = fbm(cloudP);
    // Chunkier, more illustrative clouds
    float clouds = smoothstep(1.0 - uCloudCover, 1.0 - uCloudCover + 0.22, n);
    clouds = floor(clouds * 3.0 + 0.5) / 3.0;
    clouds *= smoothstep(-0.01, 0.28, dir.y);
    vec3 cloudCol = mix(vec3(0.95, 0.9, 0.88), vec3(1.0, 0.98, 0.94), sunDot);
    sky = mix(sky, cloudCol, clouds * 0.9);
  }

  gl_FragColor = vec4(sky, 1.0);
}
`;

export class SkyDome {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      vertexShader: skyVertexShader,
      fragmentShader: skyFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uZenith: { value: new THREE.Color(STYLE.skyZenith) },
        uHorizon: { value: new THREE.Color(STYLE.skyHorizon) },
        uSunColor: { value: new THREE.Color(STYLE.sunDisc) },
        uSunDir: { value: new THREE.Vector3(0.45, 0.75, 0.3).normalize() },
        uCloudCover: { value: 0.58 },
      },
      side: THREE.BackSide,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(120, 32, 24), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -2;
  }

  setSunDirection(dir: THREE.Vector3): void {
    this.material.uniforms.uSunDir.value.copy(dir).normalize();
  }

  resize(radius: number): void {
    const r = Math.max(80, radius * 10);
    const old = this.mesh.geometry;
    this.mesh.geometry = new THREE.SphereGeometry(r, 32, 24);
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
