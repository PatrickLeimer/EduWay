/**
 * §7 steps 2–3: EMA filtering of the Level 1 signals and junk rejection.
 * Pure, no RN/Expo imports.
 */
import { PIPELINE, type MotionSample } from '@edudriver/shared';

import { lateralAccel, longitudinalAccel, type GpsKinematics, type MotionFrame } from './level1';
import { ema, len, scale, sub } from './vector';

/** Filtered signals the §7 state machines consume, all m/s². */
export interface Signals {
  /** Lateral acceleration, signed (see level1.ts for the sign convention). */
  lat: number;
  /** Longitudinal acceleration: + accelerating, − braking. */
  lon: number;
  /** Horizontal acceleration magnitude. */
  horiz: number;
}

/**
 * True when the phone is being handled rather than riding with the car: raw
 * rotation off the gravity axis above PIPELINE.junkRotationRadPerS (picked up),
 * or raw |accG| above PIPELINE.junkAccelMps2 (dropped, pothole).
 */
export function isJunk(s: MotionSample, frame: MotionFrame): boolean {
  const offAxis = len(sub(s.rot, scale(frame.up, frame.yaw)));
  return offAxis > PIPELINE.junkRotationRadPerS || len(s.accG) > PIPELINE.junkAccelMps2;
}

export interface SignalFilter {
  update(frame: MotionFrame, gps: GpsKinematics | null): Signals;
  reset(): void;
}

/**
 * EMA (PIPELINE.emaAlpha, ~2 Hz cutoff at 50 Hz) on lateral and horizontal
 * acceleration, as in the §7 sketch. Starts from 0, so it under-reads for the
 * first few samples rather than firing on a cold start. Without a usable GPS
 * fix, speed and dv/dt count as 0 (no lateral, no longitudinal).
 */
export function createSignalFilter(): SignalFilter {
  let lat = 0;
  let horiz = 0;
  return {
    update(frame, gps) {
      lat = ema(lat, lateralAccel(gps?.speedMps ?? 0, frame.yaw), PIPELINE.emaAlpha);
      horiz = ema(horiz, frame.horiz, PIPELINE.emaAlpha);
      return { lat, horiz, lon: longitudinalAccel(horiz, gps?.dvdt ?? 0) };
    },
    reset() {
      lat = 0;
      horiz = 0;
    },
  };
}
