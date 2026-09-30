/**
 * Detection mocks (WS1). Realistic fake behavior so WS2/WS4/UI can build today.
 *
 * - MockMotionSource: synthetic "phone in a mount" samples at 50 Hz.
 * - MockMotionDetector: replays the fixture's brake/accel/turn/swerve events in
 *   step with the GPS stream it is fed (fixtures/events.all-types.json).
 * - MockPhoneUseMonitor: replays the fixture phone_use event, and also emits one
 *   whenever reportTouch() is called while moving.
 */
import { createFixtureEventReplayer } from '@eduway/fixtures';
import {
  G,
  MPS_TO_MPH,
  PHONE_USE,
  type DraftEvent,
  type GpsFix,
  type MotionSample,
} from '@eduway/shared';

import type { MotionDetector, MotionSource, PhoneUseMonitor } from '../../contracts';
import { createEmitter } from '../emitter';

export function createMockMotionSource(intervalMs = 20): MotionSource {
  let timer: ReturnType<typeof setInterval> | null = null;
  return {
    async start(onSample) {
      timer = setInterval(() => {
        const noise = () => (Math.random() - 0.5) * 0.1;
        const acc = { x: noise(), y: noise(), z: noise() };
        const sample: MotionSample = {
          t: Date.now(),
          acc,
          accG: { x: acc.x, y: acc.y, z: G + acc.z },
          rot: { x: noise() / 10, y: noise() / 10, z: noise() / 10 },
        };
        onSample(sample);
      }, intervalMs);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}

export function createMockMotionDetector(): MotionDetector {
  const events = createEmitter<DraftEvent>();
  const replayer = createFixtureEventReplayer(['hard_brake', 'hard_accel', 'rough_turn', 'swerve']);
  return {
    onMotion() {},
    onGps(fix) {
      for (const e of replayer.advance(fix)) events.emit(e);
    },
    reset: () => replayer.reset(),
    isPaused: () => false,
    subscribe: (l) => events.subscribe(l),
  };
}

export function createMockPhoneUseMonitor(pollMs = 250): PhoneUseMonitor {
  const events = createEmitter<DraftEvent>();
  const replayer = createFixtureEventReplayer(['phone_use']);
  let getLatestFix: (() => GpsFix | null) | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  return {
    start(opts) {
      getLatestFix = opts.getLatestFix;
      replayer.reset();
      timer = setInterval(() => {
        const fix = getLatestFix?.();
        if (fix) for (const e of replayer.advance(fix)) events.emit(e);
      }, pollMs);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
      getLatestFix = null;
    },
    reportTouch() {
      const fix = getLatestFix?.();
      if (!fix || (fix.speedMps ?? 0) <= PHONE_USE.minSpeedMps) return;
      events.emit({
        type: 'phone_use',
        tier: 'harsh',
        peak: null,
        durationS: 1,
        speedMph: (fix.speedMps ?? 0) * MPS_TO_MPH,
        at: new Date(fix.t).toISOString(),
        location: { type: 'Point', coordinates: [fix.lon, fix.lat] },
      });
    },
    reportSafeExit() {
      // The mock does not watch AppState, so there is nothing to excuse.
    },
    subscribe: (l) => events.subscribe(l),
  };
}
