/**
 * Converts one expo-sensors DeviceMotion reading into a MotionSample (§5). Pure,
 * no RN/Expo imports, so the unit and axis handling is tested under Vitest.
 *
 * Platform quirks, checked against the expo-sensors 57 native code:
 * - rotationRate is deg/s on both platforms; the contract wants rad/s.
 * - rotationRate axes differ: iOS sends alpha = z, beta = y, gamma = x;
 *   Android sends alpha = x, beta = y, gamma = z. Getting this wrong breaks
 *   yaw = rot · ĝ (§6) on one platform.
 * - accelerationIncludingGravity points toward the ground on both platforms
 *   (≈ (0, 0, −9.8) lying face up), and accG − acc is gravity on both, so the
 *   Level 1 math (ĝ, rot · ĝ, |h|) behaves the same everywhere.
 * - Android can emit before every sensor has reported, so rotationRate may be
 *   null and accelerationIncludingGravity missing. Those readings are dropped.
 */
import { DEG_TO_RAD, type MotionSample } from '@eduway/shared';

import { vec } from './vector';

type Xyz = { x: number; y: number; z: number };

/** The subset of expo-sensors' DeviceMotionMeasurement we read. */
export interface DeviceMotionReading {
  acceleration: Xyz | null;
  accelerationIncludingGravity?: Xyz | null;
  rotationRate: { alpha: number; beta: number; gamma: number } | null;
}

export type MotionPlatform = 'ios' | 'android';

/** Returns null when the reading is incomplete (sensor not warmed up yet). */
export function toMotionSample(
  m: DeviceMotionReading,
  platform: MotionPlatform,
  t: number,
): MotionSample | null {
  const { acceleration: a, accelerationIncludingGravity: g, rotationRate: r } = m;
  if (!a || !g || !r) return null;

  const rot =
    platform === 'ios'
      ? vec(r.gamma * DEG_TO_RAD, r.beta * DEG_TO_RAD, r.alpha * DEG_TO_RAD)
      : vec(r.alpha * DEG_TO_RAD, r.beta * DEG_TO_RAD, r.gamma * DEG_TO_RAD);

  return { t, acc: vec(a.x, a.y, a.z), accG: vec(g.x, g.y, g.z), rot };
}
