/**
 * §6 Level 1 orientation math (no calibration). Pure, no RN/Expo imports.
 *
 * - ĝ = norm(accG). Expo's accG points toward the ground on both platforms
 *   (see deviceMotion.ts), so yaw = rot · ĝ has the opposite sign of the usual
 *   counter-clockwise-from-above convention. The sign is consistent across
 *   platforms, which is all the rules need: turns use |lateral|, swerve looks
 *   for a sign flip.
 * - Lateral acceleration = GPS speed × yaw rate.
 * - Horizontal acceleration h = acc − (acc · ĝ)ĝ. |h| is the road force; the
 *   sign of the GPS speed change says accelerating (+) vs braking (−).
 */
import { PIPELINE, type GpsFix, type MotionSample, type Vec3 } from '@edudriver/shared';

import { dot, len, norm, scale, sub } from './vector';

export interface MotionFrame {
  /** Unit gravity axis ĝ in phone coordinates. */
  up: Vec3;
  /** Car turning rate, rad/s (rotation about ĝ). */
  yaw: number;
  /** |h|, horizontal acceleration magnitude, m/s². */
  horiz: number;
}

export function motionFrame(s: MotionSample): MotionFrame {
  const up = norm(s.accG);
  const yaw = dot(s.rot, up);
  const h = sub(s.acc, scale(up, dot(s.acc, up)));
  return { up, yaw, horiz: len(h) };
}

/** m/s². GPS speed (m/s) × yaw rate (rad/s). */
export const lateralAccel = (speedMps: number, yaw: number): number => speedMps * yaw;

/** m/s². + accelerating, − braking, 0 when GPS speed is flat. */
export const longitudinalAccel = (horiz: number, dvdt: number): number => Math.sign(dvdt) * horiz;

/** Speed and its rate of change from the last two usable GPS fixes. */
export interface GpsKinematics {
  /** Epoch ms of the fix. */
  t: number;
  speedMps: number;
  /** m/s², 0 until two usable fixes exist. */
  dvdt: number;
}

export interface GpsTracker {
  /** Returns false when the fix was ignored (no speed, or accuracy worse than PIPELINE.maxGpsAccuracyM). */
  update(fix: GpsFix): boolean;
  latest(): GpsKinematics | null;
  reset(): void;
}

/**
 * Keeps the latest usable speed and dv/dt (§15: ignore fixes less accurate
 * than 20 m). A fix with unknown accuracy is used, since the platform gave us
 * nothing to judge it by. Ignored fixes leave the previous values in place.
 */
export function createGpsTracker(): GpsTracker {
  let last: GpsKinematics | null = null;
  return {
    update(fix) {
      // iOS reports −1 when speed is unknown.
      if (fix.speedMps === null || fix.speedMps < 0) return false;
      if (fix.accuracyM !== null && fix.accuracyM > PIPELINE.maxGpsAccuracyM) return false;
      const dt = last ? (fix.t - last.t) / 1000 : 0;
      if (last && dt <= 0) return false;
      const dvdt = last ? (fix.speedMps - last.speedMps) / dt : 0;
      last = { t: fix.t, speedMps: fix.speedMps, dvdt };
      return true;
    },
    latest: () => last,
    reset() {
      last = null;
    },
  };
}
