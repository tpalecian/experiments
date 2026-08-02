import * as THREE from 'three';

export type PickKind = 'hex' | 'vertex' | 'edge';

export interface PickResult {
  kind: PickKind;
  id: string;
}

export class Picker {
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();

  constructor(
    private camera: THREE.Camera,
    private canvas: HTMLCanvasElement,
  ) {}

  pick(clientX: number, clientY: number, objects: THREE.Object3D[]): PickResult | null {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(objects, true);
    for (const hit of hits) {
      let obj: THREE.Object3D | null = hit.object;
      while (obj) {
        const kind = obj.userData?.kind as PickKind | undefined;
        const id = obj.userData?.id as string | undefined;
        if (kind && id) return { kind, id };
        obj = obj.parent;
      }
    }
    return null;
  }
}
