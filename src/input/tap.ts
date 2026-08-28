/** Max pointer travel (px) still counted as a tap, not a pan/orbit. */
export const TAP_SLOP_PX = 10;

/** True when the pointer did not move farther than `slop` pixels. */
export function isTap(dx: number, dy: number, slop = TAP_SLOP_PX): boolean {
  return dx * dx + dy * dy <= slop * slop;
}
