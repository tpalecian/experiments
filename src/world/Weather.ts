import * as THREE from 'three';
import type { WeatherKind } from '../style/styleConfig';
import { cloneSnapshot, type AtmosphereSnapshot } from './Atmosphere';

/** Environment-State-only weather. Never rebuilds hex meshes. */
export type { WeatherKind };

/**
 * Palette / scalar multipliers on a snapshot copy.
 * Call after day-cycle sampling — board geometry stays static.
 */
export function applyWeather(src: AtmosphereSnapshot, weather: WeatherKind): AtmosphereSnapshot {
  const atm = cloneSnapshot(src);
  switch (weather) {
    case 'clear':
      break;
    case 'overcast':
      atm.sunIntensity *= 0.55;
      atm.hemiIntensity *= 1.12;
      atm.exposure *= 0.92;
      atm.fogNearMul *= 0.75;
      atm.fogFarMul *= 0.7;
      atm.cloudLit.lerp(new THREE.Color('#9aa8b8'), 0.35);
      atm.cloudShade.lerp(new THREE.Color('#5a6878'), 0.3);
      atm.starsIntensity *= 0.15;
      atm.shadowStrength *= 0.45;
      atm.waterCausticIntensity *= 0.4;
      atm.horizonHaze = Math.min(1, atm.horizonHaze + 0.12);
      break;
    case 'rain':
      atm.sunIntensity *= 0.4;
      atm.hemiIntensity *= 1.05;
      atm.exposure *= 0.85;
      atm.fogNearMul *= 0.55;
      atm.fogFarMul *= 0.55;
      atm.horizonHaze = Math.min(1, atm.horizonHaze + 0.22);
      atm.cloudLit.lerp(new THREE.Color('#7a8898'), 0.5);
      atm.cloudShade.lerp(new THREE.Color('#3a4450'), 0.4);
      atm.starsIntensity = 0;
      atm.shadowStrength *= 0.3;
      atm.waterCausticIntensity *= 0.2;
      atm.foamBrightness = Math.min(1.2, atm.foamBrightness * 1.15);
      atm.waveBandIntensity = Math.min(1.4, atm.waveBandIntensity * 1.25);
      atm.skyHorizon.lerp(new THREE.Color('#6a7888'), 0.25);
      break;
    default: {
      const _exhaustive: never = weather;
      return _exhaustive;
    }
  }
  if (atm.shadowStrength < 1) {
    atm.sunIntensity *= 0.65 + 0.35 * atm.shadowStrength;
  }
  return atm;
}
