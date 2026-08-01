import * as THREE from 'three';
import { STYLE, toonMat } from './style';

/** Clean gradient sky (no procedural cloud noise) — clouds are real low-poly meshes. */
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
  // Vibrant blue with pale cyan-white horizon (cozy / WW adjacent)
  vec3 sky = mix(uHorizon, uZenith, smoothstep(0.0, 0.7, h));

  float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
  sky += uSunColor * pow(sunDot, 40.0) * 0.7;
  sky += uSunColor * pow(sunDot, 5.0) * 0.12;

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

/** One popcorn-style cloud: clustered low-poly spheres. */
function makeCloudCluster(rand: () => number, blobCount: number): THREE.Group {
  const g = new THREE.Group();
  const lit = toonMat(0xf5f0fa);
  const shade = toonMat(0xb8aec8); // soft lavender-gray shadow blobs

  for (let i = 0; i < blobCount; i++) {
    const r = 1.2 + rand() * 2.4;
    // Icosahedron low detail = faceted but rounded “smooth low poly”
    const geom = new THREE.IcosahedronGeometry(r, 1);
    const mat = rand() > 0.35 ? lit : shade;
    const mesh = new THREE.Mesh(geom, mat.clone());
    mesh.position.set(
      (rand() - 0.5) * 5.5,
      (rand() - 0.5) * 2.2,
      (rand() - 0.5) * 4.5,
    );
    mesh.scale.set(0.85 + rand() * 0.5, 0.65 + rand() * 0.45, 0.85 + rand() * 0.5);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    g.add(mesh);
  }
  return g;
}

export class SkyDome {
  /** Root containing sky sphere + drifting cloud meshes. */
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private clouds = new THREE.Group();
  private cloudDrift: { obj: THREE.Object3D; speed: number; radius: number; height: number; phase: number }[] =
    [];
  private skyRadius = 120;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      vertexShader: skyVertexShader,
      fragmentShader: skyFragmentShader,
      uniforms: {
        uZenith: { value: new THREE.Color(0x4aa8e0) },
        uHorizon: { value: new THREE.Color(0xd8eef8) },
        uSunColor: { value: new THREE.Color(STYLE.sunDisc) },
        uSunDir: { value: new THREE.Vector3(0.45, 0.75, 0.3).normalize() },
      },
      side: THREE.BackSide,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(this.skyRadius, 32, 24), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -2;

    this.group.add(this.mesh);
    this.group.add(this.clouds);
    this.spawnClouds(this.skyRadius);
  }

  private clearClouds(): void {
    while (this.clouds.children.length) {
      const c = this.clouds.children[0];
      this.clouds.remove(c);
      c.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const m = obj.material;
          if (Array.isArray(m)) m.forEach((x) => x.dispose());
          else m.dispose();
        }
      });
    }
    this.cloudDrift = [];
  }

  private spawnClouds(radius: number): void {
    this.clearClouds();
    const rand = seededRand(42);
    const count = 14;
    for (let i = 0; i < count; i++) {
      const blobs = 5 + Math.floor(rand() * 6);
      const cloud = makeCloudCluster(rand, blobs);
      const scale = 1.4 + rand() * 2.2;
      cloud.scale.setScalar(scale);

      const angle = (i / count) * Math.PI * 2 + rand() * 0.4;
      // Keep clouds in upper sky band, outside the play island
      const orbitR = radius * (0.42 + rand() * 0.28);
      const height = radius * (0.18 + rand() * 0.28);
      cloud.position.set(Math.cos(angle) * orbitR, height, Math.sin(angle) * orbitR);
      cloud.lookAt(0, height * 0.6, 0);

      this.clouds.add(cloud);
      this.cloudDrift.push({
        obj: cloud,
        speed: 0.012 + rand() * 0.02,
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
      c.obj.position.y = c.height + Math.sin(time * 0.3 + c.phase) * 0.8;
      // Gentle bob / tumble
      c.obj.rotation.y = a * 0.2;
    }
  }

  dispose(): void {
    this.clearClouds();
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
