/**
 * Lightweight FPS overlay (folio Monitoring). Shown when `?debug` is present.
 */
export class Monitoring {
  readonly el: HTMLDivElement;
  private frames = 0;
  private lastMs = performance.now();
  private fps = 0;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'debug-monitor';
    this.el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(this.el);
  }

  static enabled(): boolean {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).has('debug');
  }

  update(label: string): void {
    this.frames += 1;
    const now = performance.now();
    if (now - this.lastMs >= 500) {
      this.fps = (this.frames * 1000) / (now - this.lastMs);
      this.frames = 0;
      this.lastMs = now;
    }
    this.el.textContent = `${this.fps.toFixed(0)} fps\n${label}`;
  }
}
