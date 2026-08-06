import type { Terrain } from '../game/types';
import { applyEnvelope, createNoiseBuffer, scheduleLinearFade } from './procedural';
import { TERRAIN_AMBIENCE } from './terrainAmbience';

const CROSSFADE_SEC = 1.6;
const AMBIENT_MASTER = 0.55;
const SFX_MASTER = 0.45;

interface ActiveLoop {
  terrain: Terrain;
  gain: GainNode;
  sources: AudioScheduledSourceNode[];
  stopTimer: ReturnType<typeof setTimeout> | null;
}

interface ActiveOneShot {
  stopTimer: ReturnType<typeof setTimeout>;
}

type AmbientKind = 'wind' | 'sea';

/**
 * Browser ambience inspired by folio-2025's layered loops + sparse one-shots.
 * Terrain beds crossfade on hex clicks; wind and sea gusts fill quiet gaps.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private unlocked = false;
  private activeLoop: ActiveLoop | null = null;
  private crossfading = false;
  private activeOneShots: ActiveOneShot[] = [];

  private nextAmbientAt = 0;
  private ambientDelaySec = 8;

  unlock(): void {
    if (this.unlocked) return;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 1;
    this.masterGain.connect(ctx.destination);

    this.ambientBus = ctx.createGain();
    this.ambientBus.gain.value = AMBIENT_MASTER;
    this.ambientBus.connect(this.masterGain);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = SFX_MASTER;
    this.sfxBus.connect(this.masterGain);

    this.noiseBuffer = createNoiseBuffer(ctx, 4);
    this.unlocked = true;
    this.scheduleNextAmbient(0);
  }

  /** True when a terrain bed or one-shot is audible / fading. */
  hasForegroundAudio(): boolean {
    return this.crossfading || this.activeLoop !== null || this.activeOneShots.length > 0;
  }

  playTerrainAmbient(terrain: Terrain): void {
    if (!this.ensureReady()) return;
    if (this.activeLoop?.terrain === terrain && !this.crossfading) return;

    const ctx = this.ctx!;
    const profile = TERRAIN_AMBIENCE[terrain];
    const loopGain = ctx.createGain();
    loopGain.gain.value = 0;
    loopGain.connect(this.ambientBus!);

    const sources = this.startTerrainBed(ctx, loopGain, profile);
    const newLoop: ActiveLoop = { terrain, gain: loopGain, sources, stopTimer: null };

    const previous = this.activeLoop;
    this.activeLoop = newLoop;
    this.crossfading = true;

    scheduleLinearFade(loopGain, ctx, 0, profile.volume, CROSSFADE_SEC);

    if (previous) {
      scheduleLinearFade(previous.gain, ctx, previous.gain.gain.value, 0, CROSSFADE_SEC);
      const prev = previous;
      prev.stopTimer = setTimeout(() => this.disposeLoop(prev), CROSSFADE_SEC * 1000 + 80);
    }

    setTimeout(() => {
      this.crossfading = false;
    }, CROSSFADE_SEC * 1000);
  }

  clearTerrainAmbient(): void {
    if (!this.activeLoop || !this.ctx) return;
    const ctx = this.ctx;
    const loop = this.activeLoop;
    this.crossfading = true;
    scheduleLinearFade(loop.gain, ctx, loop.gain.gain.value, 0, CROSSFADE_SEC);
    loop.stopTimer = setTimeout(() => {
      this.disposeLoop(loop);
      if (this.activeLoop === loop) this.activeLoop = null;
      this.crossfading = false;
    }, CROSSFADE_SEC * 1000 + 80);
  }

  update(elapsedSec: number): void {
    if (!this.unlocked || !this.ctx) return;
    if (this.ctx.state === 'suspended') return;

    if (elapsedSec < this.nextAmbientAt) return;

    if (!this.hasForegroundAudio()) {
      this.playRandomAmbient();
    }
    this.scheduleNextAmbient(elapsedSec);
  }

  dispose(): void {
    if (this.activeLoop) this.disposeLoop(this.activeLoop);
    this.activeOneShots.forEach((s) => clearTimeout(s.stopTimer));
    this.activeOneShots = [];
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.unlocked = false;
  }

  private ensureReady(): boolean {
    if (!this.unlocked) this.unlock();
    if (!this.ctx || this.ctx.state === 'closed') return false;
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return true;
  }

  private scheduleNextAmbient(fromSec: number): void {
    const delay = this.ambientDelaySec + Math.random() * 18;
    this.nextAmbientAt = fromSec + delay;
    this.ambientDelaySec = 10 + Math.random() * 20;
  }

  private playRandomAmbient(): void {
    const kind: AmbientKind = Math.random() < 0.55 ? 'sea' : 'wind';
    if (kind === 'sea') this.playSeaGust();
    else this.playWindGust();
  }

  private playWindGust(): void {
    const ctx = this.ctx!;
    const bus = this.sfxBus!;
    const buffer = this.noiseBuffer!;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.playbackRate.value = 0.85 + Math.random() * 0.35;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 180 + Math.random() * 520;
    filter.Q.value = 0.4 + Math.random() * 0.5;

    const gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(bus);

    const peak = 0.12 + Math.random() * 0.16;
    const attack = 0.35 + Math.random() * 0.8;
    const hold = 0.4 + Math.random() * 1.6;
    const release = 1.2 + Math.random() * 2.2;
    applyEnvelope(gain, ctx, peak, attack, release, hold);

    const totalMs = (attack + hold + release) * 1000 + 100;
    source.start();
    const stopTimer = setTimeout(() => {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
      this.removeOneShot(handle);
    }, totalMs);

    const handle: ActiveOneShot = { stopTimer };
    this.activeOneShots.push(handle);
  }

  private playSeaGust(): void {
    const ctx = this.ctx!;
    const bus = this.sfxBus!;
    const buffer = this.noiseBuffer!;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.playbackRate.value = 0.7 + Math.random() * 0.25;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 420 + Math.random() * 380;
    lowpass.Q.value = 0.7;

    const rumble = ctx.createOscillator();
    rumble.type = 'sine';
    rumble.frequency.value = 48 + Math.random() * 28;

    const rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0.04 + Math.random() * 0.05;
    rumble.connect(rumbleGain);

    const mix = ctx.createGain();
    mix.gain.value = 0;
    source.connect(lowpass);
    lowpass.connect(mix);
    rumbleGain.connect(mix);
    mix.connect(bus);

    const peak = 0.14 + Math.random() * 0.18;
    const attack = 0.5 + Math.random() * 1.1;
    const hold = 0.8 + Math.random() * 2.4;
    const release = 1.6 + Math.random() * 2.8;
    applyEnvelope(mix, ctx, peak, attack, release, hold);

    const totalMs = (attack + hold + release) * 1000 + 100;
    source.start();
    rumble.start();
    const stopTimer = setTimeout(() => {
      try {
        source.stop();
        rumble.stop();
      } catch {
        /* already stopped */
      }
      source.disconnect();
      lowpass.disconnect();
      rumble.disconnect();
      rumbleGain.disconnect();
      mix.disconnect();
      this.removeOneShot(handle);
    }, totalMs);

    const handle: ActiveOneShot = { stopTimer };
    this.activeOneShots.push(handle);
  }

  private startTerrainBed(
    ctx: AudioContext,
    outGain: GainNode,
    profile: typeof TERRAIN_AMBIENCE[Terrain],
  ): AudioScheduledSourceNode[] {
    const buffer = this.noiseBuffer!;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.playbackRate.value = profile.playbackRate;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = profile.centerHz;
    filter.Q.value = profile.q;

    const bedGain = ctx.createGain();
    bedGain.gain.value = 1 - profile.rumbleMix;

    source.connect(filter);
    filter.connect(bedGain);
    bedGain.connect(outGain);

    const sources: AudioScheduledSourceNode[] = [source];

    if (profile.rumbleMix > 0) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = profile.centerHz * 0.22;

      const rumbleFilter = ctx.createBiquadFilter();
      rumbleFilter.type = 'lowpass';
      rumbleFilter.frequency.value = profile.centerHz * 0.9;

      const rumbleGain = ctx.createGain();
      rumbleGain.gain.value = profile.rumbleMix;

      osc.connect(rumbleFilter);
      rumbleFilter.connect(rumbleGain);
      rumbleGain.connect(outGain);

      osc.start();
      sources.push(osc);
    }

    source.start();
    return sources;
  }

  private disposeLoop(loop: ActiveLoop): void {
    if (loop.stopTimer) clearTimeout(loop.stopTimer);
    const ctx = this.ctx;
    for (const src of loop.sources) {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
      src.disconnect();
    }
    loop.gain.disconnect();
    if (ctx) {
      loop.gain.gain.cancelScheduledValues(ctx.currentTime);
    }
  }

  private removeOneShot(handle: ActiveOneShot): void {
    const idx = this.activeOneShots.indexOf(handle);
    if (idx >= 0) this.activeOneShots.splice(idx, 1);
  }
}
