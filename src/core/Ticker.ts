/**
 * Ordered frame phases (folio Ticker + documented loop).
 * Sync stays event-driven on the engine; this drives the render loop only.
 */
export type TickPhase = 'motion' | 'atmosphere' | 'world' | 'render';

const PHASE_ORDER: TickPhase[] = ['motion', 'atmosphere', 'world', 'render'];

export class Ticker {
  private readonly listeners = new Map<TickPhase, Set<() => void>>();

  on(phase: TickPhase, fn: () => void): () => void {
    let set = this.listeners.get(phase);
    if (!set) {
      set = new Set();
      this.listeners.set(phase, set);
    }
    set.add(fn);
    return () => set.delete(fn);
  }

  tick(): void {
    for (const phase of PHASE_ORDER) {
      const set = this.listeners.get(phase);
      if (!set) continue;
      for (const fn of set) fn();
    }
  }
}
