import { Howl, Howler } from 'howler';
import type { Terrain } from '../game/types';
import { applyEnvelope, createNoiseBuffer } from './procedural';
import { GUST_SOUNDS, TERRAIN_AMBIENCE } from './terrainAmbience';

const CROSSFADE_MS = 1600;
const PREVIEW_CROSSFADE_MS = 700;
const PREVIEW_VOLUME_MUL = 0.42;

type AmbientMode = 'preview' | 'latched';

interface ActiveBed {
  terrain: Terrain;
  howl: Howl;
  soundId: number;
  mode: AmbientMode;
  targetVolume: number;
  fadeTimer: ReturnType<typeof setTimeout> | null;
}

interface ActiveOneShot {
  stopTimer: ReturnType<typeof setTimeout>;
}

type GustKind = 'wind' | 'sea';

/**
 * Layered ambience (folio-2025 style): Howler MP3 loops for terrain beds,
 * procedural gust fallback, hover previews, and craft volume sliders.
 */
export class AudioManager {
  private howls = new Map<string, Howl>();
  private noiseBuffer: AudioBuffer | null = null;
  private gustCtx: AudioContext | null = null;
  private gustBus: GainNode | null = null;

  private unlocked = false;
  private latchedBed: ActiveBed | null = null;
  private previewBed: ActiveBed | null = null;
  private crossfading = false;
  private activeOneShots: ActiveOneShot[] = [];

  private nextAmbientAt = 0;
  private ambientDelaySec = 8;

  private ambientMaster = 0.55;
  private sfxMaster = 0.45;
  private hoverPreviewEnabled = true;

  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    Howler.volume(1);
    this.preloadHowls();
    this.initGustFallback();
    this.scheduleNextAmbient(0);
  }

  applyStyle(ambientVolume: number, sfxVolume: number, hoverPreview: boolean): void {
    this.ambientMaster = ambientVolume;
    this.sfxMaster = sfxVolume;
    this.hoverPreviewEnabled = hoverPreview;
    if (this.gustBus) this.gustBus.gain.value = sfxVolume;

    if (!hoverPreview) this.clearPreview();

    if (this.latchedBed) {
      const vol = this.scaleLatchedVolume(this.latchedBed.terrain);
      this.latchedBed.targetVolume = vol;
      this.latchedBed.howl.volume(vol, this.latchedBed.soundId);
    }
    if (this.previewBed) {
      const vol = this.scalePreviewVolume(this.previewBed.terrain);
      this.previewBed.targetVolume = vol;
      this.previewBed.howl.volume(vol, this.previewBed.soundId);
    }
  }

  hasForegroundAudio(): boolean {
    return (
      this.crossfading ||
      this.latchedBed !== null ||
      this.previewBed !== null ||
      this.activeOneShots.length > 0
    );
  }

  /** Latch full biome ambient on hex click. */
  playTerrainAmbient(terrain: Terrain): void {
    if (!this.ensureReady()) return;
    this.clearPreview();
    if (this.latchedBed?.terrain === terrain && !this.crossfading) return;
    this.startBed(terrain, 'latched', CROSSFADE_MS);
  }

  /** Short hover preview — quieter overlay, cleared on pointer leave. */
  playTerrainPreview(terrain: Terrain): void {
    if (!this.ensureReady() || !this.hoverPreviewEnabled) return;
    if (this.latchedBed?.terrain === terrain) return;
    if (this.previewBed?.terrain === terrain) return;
    this.startBed(terrain, 'preview', PREVIEW_CROSSFADE_MS);
  }

  clearTerrainAmbient(): void {
    this.fadeOutBed('latched');
  }

  clearPreview(): void {
    this.fadeOutBed('preview');
  }

  update(elapsedSec: number): void {
    if (!this.unlocked) return;
    if (elapsedSec < this.nextAmbientAt) return;

    if (!this.hasForegroundAudio()) {
      this.playRandomGust();
    }
    this.scheduleNextAmbient(elapsedSec);
  }

  dispose(): void {
    this.fadeOutBed('latched', 0);
    this.fadeOutBed('preview', 0);
    this.activeOneShots.forEach((s) => clearTimeout(s.stopTimer));
    this.activeOneShots = [];
    for (const howl of this.howls.values()) howl.unload();
    this.howls.clear();
    if (this.gustCtx) {
      this.gustCtx.close();
      this.gustCtx = null;
    }
    this.unlocked = false;
  }

  private ensureReady(): boolean {
    if (!this.unlocked) this.unlock();
    if (Howler.ctx && Howler.ctx.state === 'suspended') {
      void Howler.ctx.resume();
    }
    return this.unlocked;
  }

  private preloadHowls(): void {
    const paths = new Set<string>();
    for (const profile of Object.values(TERRAIN_AMBIENCE)) paths.add(profile.path);
    paths.add(GUST_SOUNDS.wind.path);
    paths.add(GUST_SOUNDS.sea.path);

    for (const path of paths) {
      if (this.howls.has(path)) continue;
      const howl = new Howl({
        src: [path],
        preload: true,
        loop: true,
        volume: 0,
        pool: 2,
        onloaderror: (_id, err) => {
          console.warn(`Audio: failed to load ${path}`, err);
        },
      });
      this.howls.set(path, howl);
    }
  }

  private getHowl(path: string): Howl {
    let howl = this.howls.get(path);
    if (!howl) {
      howl = new Howl({ src: [path], preload: true, loop: true, volume: 0, pool: 2 });
      this.howls.set(path, howl);
    }
    return howl;
  }

  private initGustFallback(): void {
    try {
      const ctx = new AudioContext();
      this.gustCtx = ctx;
      const bus = ctx.createGain();
      bus.gain.value = this.sfxMaster;
      bus.connect(ctx.destination);
      this.gustBus = bus;
      this.noiseBuffer = createNoiseBuffer(ctx, 4);
    } catch {
      /* procedural gusts unavailable */
    }
  }

  private scheduleNextAmbient(fromSec: number): void {
    const delay = this.ambientDelaySec + Math.random() * 18;
    this.nextAmbientAt = fromSec + delay;
    this.ambientDelaySec = 10 + Math.random() * 20;
  }

  private scaleLatchedVolume(terrain: Terrain): number {
    return TERRAIN_AMBIENCE[terrain].volume * this.ambientMaster;
  }

  private scalePreviewVolume(terrain: Terrain): number {
    return TERRAIN_AMBIENCE[terrain].volume * this.ambientMaster * PREVIEW_VOLUME_MUL;
  }

  private startBed(terrain: Terrain, mode: AmbientMode, fadeMs: number): void {
    const profile = TERRAIN_AMBIENCE[terrain];
    const howl = this.getHowl(profile.path);
    const targetVolume =
      mode === 'latched' ? this.scaleLatchedVolume(terrain) : this.scalePreviewVolume(terrain);

    const soundId = howl.play();
    howl.loop(true, soundId);
    howl.rate(profile.rate, soundId);
    howl.volume(0, soundId);

    const bed: ActiveBed = {
      terrain,
      howl,
      soundId,
      mode,
      targetVolume,
      fadeTimer: null,
    };

    const previous = mode === 'latched' ? this.latchedBed : this.previewBed;
    if (mode === 'latched') this.latchedBed = bed;
    else this.previewBed = bed;

    this.crossfading = true;
    howl.fade(0, targetVolume, fadeMs, soundId);

    if (previous) {
      this.fadeOutActiveBed(previous, fadeMs);
    }

    bed.fadeTimer = setTimeout(() => {
      this.crossfading = false;
    }, fadeMs + 40);
  }

  private fadeOutBed(mode: AmbientMode, fadeMs = CROSSFADE_MS): void {
    const bed = mode === 'latched' ? this.latchedBed : this.previewBed;
    if (!bed) return;
    if (mode === 'latched') this.latchedBed = null;
    else this.previewBed = null;
    this.fadeOutActiveBed(bed, fadeMs);
  }

  private fadeOutActiveBed(bed: ActiveBed, fadeMs: number): void {
    if (bed.fadeTimer) clearTimeout(bed.fadeTimer);
    this.crossfading = true;
    const currentVol = bed.howl.volume(bed.soundId) as number;
    bed.howl.fade(currentVol, 0, fadeMs, bed.soundId);
    setTimeout(() => {
      bed.howl.stop(bed.soundId);
      this.crossfading = false;
    }, fadeMs + 60);
  }

  private playRandomGust(): void {
    const kind: GustKind = Math.random() < 0.55 ? 'sea' : 'wind';
    const asset = GUST_SOUNDS[kind];
    const howl = this.getHowl(asset.path);
    const peak = asset.volume * this.sfxMaster;

    if (howl.state() === 'loaded') {
      this.playHowlGust(howl, peak);
      return;
    }

    howl.once('load', () => this.playHowlGust(howl, peak));
    howl.once('loaderror', () => {
      if (kind === 'sea') this.playProceduralSeaGust();
      else this.playProceduralWindGust();
    });
    if (howl.state() === 'unloaded') howl.load();
  }

  private playHowlGust(howl: Howl, peak: number): void {
    const soundId = howl.play();
    howl.loop(false, soundId);
    howl.rate(0.85 + Math.random() * 0.35, soundId);
    const vol = peak * (0.65 + Math.random() * 0.5);
    howl.volume(0, soundId);
    const fadeIn = 400 + Math.random() * 900;
    const fadeOut = 1200 + Math.random() * 2200;
    howl.fade(0, vol, fadeIn, soundId);
    const stopTimer = setTimeout(() => {
      howl.fade(vol, 0, fadeOut, soundId);
      setTimeout(() => {
        howl.stop(soundId);
        this.removeOneShot(handle);
      }, fadeOut + 40);
    }, fadeIn + 400 + Math.random() * 1600);

    const handle: ActiveOneShot = { stopTimer };
    this.activeOneShots.push(handle);
  }

  private playProceduralWindGust(): void {
    const ctx = this.gustCtx!;
    const bus = this.gustBus!;
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

    const peak = (0.12 + Math.random() * 0.16) * this.sfxMaster;
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

  private playProceduralSeaGust(): void {
    const ctx = this.gustCtx!;
    const bus = this.gustBus!;
    const buffer = this.noiseBuffer!;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.playbackRate.value = 0.7 + Math.random() * 0.25;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 420 + Math.random() * 380;

    const mix = ctx.createGain();
    mix.gain.value = 0;
    source.connect(lowpass);
    lowpass.connect(mix);
    mix.connect(bus);

    const peak = (0.14 + Math.random() * 0.18) * this.sfxMaster;
    const attack = 0.5 + Math.random() * 1.1;
    const hold = 0.8 + Math.random() * 2.4;
    const release = 1.6 + Math.random() * 2.8;
    applyEnvelope(mix, ctx, peak, attack, release, hold);

    const totalMs = (attack + hold + release) * 1000 + 100;
    source.start();
    const stopTimer = setTimeout(() => {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
      source.disconnect();
      lowpass.disconnect();
      mix.disconnect();
      this.removeOneShot(handle);
    }, totalMs);

    const handle: ActiveOneShot = { stopTimer };
    this.activeOneShots.push(handle);
  }

  private removeOneShot(handle: ActiveOneShot): void {
    const idx = this.activeOneShots.indexOf(handle);
    if (idx >= 0) this.activeOneShots.splice(idx, 1);
  }
}
