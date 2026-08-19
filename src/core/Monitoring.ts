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
    Object.assign(this.el.style, {
      position: 'fixed',
      left: '8px',
      bottom: '8px',
      zIndex: '80',
      pointerEvents: 'none',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: '11px',
      lineHeight: '1.35',
      color: '#fff8e8',
      background: 'rgba(20, 24, 32, 0.72)',
      border: '1px solid rgba(255, 244, 220, 0.25)',
      borderRadius: '8px',
      padding: '6px 8px',
      whiteSpace: 'pre',
    });
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
