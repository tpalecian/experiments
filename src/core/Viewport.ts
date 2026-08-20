export interface ViewportSize {
  width: number;
  height: number;
  aspect: number;
}

/** Window size for camera + renderer (folio Viewport). */
export class Viewport {
  width = 1;
  height = 1;
  aspect = 1;
  private readonly element: HTMLElement;
  private readonly onChange: (size: ViewportSize) => void;

  constructor(element: HTMLElement, onChange: (size: ViewportSize) => void) {
    this.element = element;
    this.onChange = onChange;
    this.measure();
    this.onChange(this.size());
    window.addEventListener('resize', this.handleResize);
  }

  private handleResize = (): void => {
    this.measure();
    this.onChange(this.size());
  };

  measure(): ViewportSize {
    this.width = this.element.clientWidth || window.innerWidth;
    this.height = this.element.clientHeight || window.innerHeight;
    this.aspect = this.width / Math.max(1, this.height);
    return this.size();
  }

  size(): ViewportSize {
    return { width: this.width, height: this.height, aspect: this.aspect };
  }

  dispose(): void {
    window.removeEventListener('resize', this.handleResize);
  }
}
