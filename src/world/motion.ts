import type { StyleConfig } from '../style/styleConfig';
import { DEFAULT_STYLE_CONFIG } from '../style/styleConfig';

export interface MotionFeel {
  hoverLift: number;
  highlightFade: number;
  pieceSpawnSec: number;
  roadSpawnSec: number;
  upgradeSec: number;
  robberHopSec: number;
  productionPulseSec: number;
  productionPulseStrength: number;
  harborBobAmp: number;
}

export function motionFromStyle(config: StyleConfig = DEFAULT_STYLE_CONFIG): MotionFeel {
  return {
    hoverLift: config.hexHoverLift,
    highlightFade: config.motionHighlightFade,
    pieceSpawnSec: config.motionPieceSpawnSec,
    roadSpawnSec: config.motionRoadSpawnSec,
    upgradeSec: config.motionUpgradeSec,
    robberHopSec: config.motionRobberHopSec,
    productionPulseSec: config.productionPulseSec,
    productionPulseStrength: config.productionPulseStrength,
    harborBobAmp: config.harborBobAmp,
  };
}
