/**
 * WS1 Motion detection boundary. Master doc §5, §6, §7.
 * PROTECTED CONTRACT (see root CLAUDE.md).
 *
 * Data flow (all on the phone, §3):
 *   MotionSource (Expo DeviceMotion, 50 Hz) ─┐
 *   GPS fixes from the trip session (1 Hz) ──┼─> MotionDetector ──> DraftEvent
 *   PhoneUseMonitor (AppState + touches) ─────────────────────────> DraftEvent
 *
 * Motion samples are kept only in short ring buffers inside the detector and
 * discarded once classified. They are never stored or uploaded (§3, §9).
 */
import type { DraftEvent, GpsFix, MotionSample } from '@edudriver/shared';

import type { Subscribable } from './common';

/**
 * Thin adapter over expo-sensors DeviceMotion. The ONLY place that touches the
 * Expo sensor API, so detectors stay pure and testable with fixtures.
 * Must: setUpdateInterval(PIPELINE.motionIntervalMs), and convert rotationRate
 * from deg/s (Expo SDK 57) to rad/s.
 */
export interface MotionSource {
  /** Resolves once permission is granted and samples are flowing. */
  start(onSample: (sample: MotionSample) => void): Promise<void>;
  stop(): void;
}

/**
 * Rules-based detector for hard_brake, hard_accel, rough_turn and swerve (§7).
 * Pure logic: no React Native or Expo imports.
 *
 * Emits events without road context; the trip session adds street, limit and
 * alert status.
 */
export interface MotionDetector extends Subscribable<DraftEvent> {
  /** Feed every motion sample (~50 Hz). */
  onMotion(sample: MotionSample): void;
  /** Feed every GPS fix (~1 Hz). Needed for speed, dv/dt sign and heading change. */
  onGps(fix: GpsFix): void;
  /** Clear filters, state machines and ring buffers (trip start). */
  reset(): void;
  /** True while junk rejection has paused detection (phone picked up / dropped). Debug only. */
  isPaused(): boolean;
}

/**
 * Detects phone use while moving (§7 "Phone use detection").
 * Lock on: any non-emergency/navigation touch on the lock screen.
 * Lock off: any in-app touch, or AppState → background.
 * Emits one phone_use DraftEvent per episode; durationS covers time away (§18 flag 2).
 */
export interface PhoneUseMonitor extends Subscribable<DraftEvent> {
  /**
   * Begin watching AppState. `getLatestFix` supplies speed and location, so
   * phone use only counts above PHONE_USE.minSpeedMps.
   */
  start(opts: { lockEnabled: boolean; getLatestFix: () => GpsFix | null }): void;
  stop(): void;
  /** UI calls this from a root touch handler while driving. */
  reportTouch(): void;
}
