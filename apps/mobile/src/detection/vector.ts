/**
 * Tiny 3-vector helpers used by the detector math in master doc §6 and the §7
 * sketch (norm, dot, sub, scale, len, ema). Pure, no RN/Expo imports.
 */
import type { Vec3 } from '@edudriver/shared';

export const vec = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;

export const len = (a: Vec3): number => Math.sqrt(dot(a, a));

export const scale = (a: Vec3, k: number): Vec3 => vec(a.x * k, a.y * k, a.z * k);

export const sub = (a: Vec3, b: Vec3): Vec3 => vec(a.x - b.x, a.y - b.y, a.z - b.z);

export const cross = (a: Vec3, b: Vec3): Vec3 =>
  vec(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);

/** Unit vector. Returns the zero vector for a zero input instead of NaN. */
export const norm = (a: Vec3): Vec3 => {
  const l = len(a);
  return l === 0 ? vec(0, 0, 0) : scale(a, 1 / l);
};

/** One exponential moving average step: prev + α (next − prev). §7 step 2. */
export const ema = (prev: number, next: number, alpha: number): number =>
  prev + alpha * (next - prev);
