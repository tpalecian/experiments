/**
 * Shared asset types and hex primitives.
 */
import * as THREE from 'three';
import type { Terrain } from '../../engine/types';
import { STYLIZED_PLAYER } from '../../style/style';

export type AssetCategory = 'pieces' | 'props' | 'board';

export interface AssetCreateOptions {
  /** Player color index 0–3 for settlements / cities / roads. */
  playerIndex?: number;
  /** Explicit hex color override for player-tinted pieces. */
  color?: number;
  /** Tree / prop scale multiplier. */
  scale?: number;
  /** Number token face value (2–12). */
  number?: number;
  /** Terrain for hex tile / rim samples. */
  terrain?: Terrain;
  /** Harbor label text (e.g. "3:1" or "2:1 W"). */
  harborLabel?: string;
  /** Harbor label background. */
  harborBg?: string;
  /** Prop look variant (sheep pose, rock/bush cluster, wall piece). */
  variant?: number;
}

export interface AssetDefinition {
  id: string;
  name: string;
  category: AssetCategory;
  description: string;
  /** Whether the player-color control applies. */
  playerTint?: boolean;
  create: (opts?: AssetCreateOptions) => THREE.Object3D;
}

export const TILE_HEIGHT = 0.28;

export function hexShape(size: number): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const x = size * Math.cos(angle);
    const y = size * Math.sin(angle);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

export function numberTexture(n: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 128, 128);
  ctx.beginPath();
  ctx.arc(64, 64, 56, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(48, 44, 10, 64, 64, 56);
  g.addColorStop(0, '#ffe7b0');
  g.addColorStop(1, '#d4a45a');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#5c3d2e';
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.fillStyle = n === 6 || n === 8 ? '#d62828' : '#3a2a18';
  ctx.font = 'bold 58px Fraunces, Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(n), 64, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function resolvePlayerColor(opts?: AssetCreateOptions): number {
  if (opts?.color !== undefined) return opts.color;
  const idx = Math.max(0, Math.min(3, opts?.playerIndex ?? 0));
  return STYLIZED_PLAYER[idx]!;
}

