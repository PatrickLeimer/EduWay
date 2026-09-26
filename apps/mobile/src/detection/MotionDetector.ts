/**
 * Real MotionDetector (WS1). STUB: satisfies the contract, detects nothing yet.
 *
 * Pure logic only: no React Native or Expo imports, so it runs under Vitest
 * with fixture samples. Thresholds come from @edudriver/shared (never inline).
 */
import type { DraftEvent, GpsFix, MotionSample } from '@edudriver/shared';

import type { MotionDetector, Unsubscribe } from '../contracts';

import { createEmitter } from './emitter';

export function createMotionDetector(): MotionDetector {
  const events = createEmitter<DraftEvent>();
  let paused = false;

  return {
    onMotion(_sample: MotionSample) {
      // TODO(WS1, §6 Level 1): up = norm(accG); yaw = dot(rot, up);
      //   h = acc − (acc·up)up; lat = speed × yaw; lon = sign(dv/dt) × |h|.
      // TODO(WS1, §7 step 2): EMA filter with PIPELINE.emaAlpha.
      // TODO(WS1, §7 step 3): set `paused` when off-axis rotation > PIPELINE.junkRotationRadPerS
      //   or |accG| > PIPELINE.junkAccelMps2.
      // TODO(WS1, §7 step 4): hysteresis state machines using HARD_BRAKE, HARD_ACCEL,
      //   ROUGH_TURN, SWERVE; merge same-type events within PIPELINE.mergeWindowS.
      // TODO(WS1, §7 step 5): events.emit(draft) with the GPS fix nearest the peak.
      // TODO(WS1, §6 Level 2, only if time allows): learn forward axis.
    },
    onGps(_fix: GpsFix) {
      // TODO(WS1): keep latest speed, dv/dt sign and heading history. Ignore fixes with
      //   accuracy worse than PIPELINE.maxGpsAccuracyM; skip lateral rules below
      //   PIPELINE.minSpeedForLateralMps (§15).
    },
    reset() {
      paused = false;
      // TODO(WS1): clear filters, ring buffers and state machines.
    },
    isPaused: () => paused,
    subscribe: (listener): Unsubscribe => events.subscribe(listener),
  };
}
