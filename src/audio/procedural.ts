/** Small helpers for procedural ambience via Web Audio API. */

export function createNoiseBuffer(ctx: AudioContext, seconds = 2): AudioBuffer {
  const length = Math.ceil(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export function applyEnvelope(
  gain: GainNode,
  ctx: AudioContext,
  peak: number,
  attackSec: number,
  releaseSec: number,
  holdSec = 0,
): void {
  const now = ctx.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peak, now + attackSec);
  const holdEnd = now + attackSec + holdSec;
  gain.gain.setValueAtTime(peak, holdEnd);
  gain.gain.linearRampToValueAtTime(0, holdEnd + releaseSec);
}

export function scheduleLinearFade(
  gain: GainNode,
  ctx: AudioContext,
  from: number,
  to: number,
  durationSec: number,
): void {
  const now = ctx.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(from, now);
  gain.gain.linearRampToValueAtTime(to, now + durationSec);
}
