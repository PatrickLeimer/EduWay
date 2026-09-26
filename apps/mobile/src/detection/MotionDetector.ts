/**
 * Real MotionDetector (WS1). Signal pipeline done; event classification still a stub.
 *
 * Pure logic only: no React Native or Expo imports, so it runs under Vitest
 * with fixture samples. Thresholds come from @edudriver/shared (never inline).
 */
import type { DraftEvent, GpsFix, MotionSample } from '@edudriver/shared';

import type { MotionDetector, Unsubscribe } from '../contracts';

import { createEmitter } from './emitter';
import { createGpsTracker, motionFrame } from './level1';
import { createSignalFilter, isJunk } from './signals';

export function createMotionDetector(): MotionDetector {
  const events = createEmitter<DraftEvent>();
  const gps = createGpsTracker();
  const filter = createSignalFilter();
  let paused = false;

  return {
    onMotion(sample: MotionSample) {
      const frame = motionFrame(sample);
      // §7 step 3. Every junk sample restarts the filter, so handling noise
      // never carries into the signals once the phone settles.
      paused = isJunk(sample, frame);
      if (paused) {
        filter.reset();
        // TODO(WS1, §7 step 4): reset the state machines too.
        return;
      }
      filter.update(frame, gps.latest());
      // TODO(WS1, §7 step 4): feed the filtered signals to hysteresis state machines
      //   using HARD_BRAKE, HARD_ACCEL, ROUGH_TURN, SWERVE; merge same-type events
      //   within PIPELINE.mergeWindowS.
      // TODO(WS1, §7 step 5): events.emit(draft) with the GPS fix nearest the peak.
      // TODO(WS1, §6 Level 2, only if time allows): learn forward axis.
    },
    onGps(fix: GpsFix) {
      gps.update(fix);
      // TODO(WS1): keep heading history; skip lateral rules below
      //   PIPELINE.minSpeedForLateralMps (§15).
    },
    reset() {
      paused = false;
      gps.reset();
      filter.reset();
      // TODO(WS1): clear state machines.
    },
    isPaused: () => paused,
    subscribe: (listener): Unsubscribe => events.subscribe(listener),
  };
}
