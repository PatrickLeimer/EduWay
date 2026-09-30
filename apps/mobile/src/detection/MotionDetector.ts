/**
 * Real MotionDetector (WS1): §6 Level 1 signals → §7 events.
 *
 * Pure logic only: no React Native or Expo imports, so it runs under Vitest
 * with fixture samples. Thresholds come from @eduway/shared (never inline).
 *
 * Events are emitted when they end (peak, duration and tier are final then).
 * Merging (§7 step 4): an event that starts within PIPELINE.mergeWindowS of the
 * previous same-type event's end is folded into it and not emitted again.
 */
import {
  DEG_TO_RAD,
  HARD_ACCEL,
  HARD_BRAKE,
  MPS_TO_MPH,
  PIPELINE,
  ROUGH_TURN,
  SWERVE,
  type DraftEvent,
  type EventType,
  type GpsFix,
  type MotionSample,
} from '@eduway/shared';

import type { MotionDetector, Unsubscribe } from '../contracts';

import { createEmitter } from './emitter';
import { createHysteresis, type Episode } from './hysteresis';
import { createGpsTracker, motionFrame } from './level1';
import { createSignalFilter, isJunk } from './signals';
import { createSwerveDetector } from './swerve';

const nearestFix = (fixes: GpsFix[], t: number): GpsFix | null =>
  fixes.reduce<GpsFix | null>(
    (best, f) => (!best || Math.abs(f.t - t) < Math.abs(best.t - t) ? f : best),
    null,
  );

export function createMotionDetector(): MotionDetector {
  const events = createEmitter<DraftEvent>();
  const gps = createGpsTracker();
  const filter = createSignalFilter();
  const brake = createHysteresis(HARD_BRAKE);
  const accel = createHysteresis(HARD_ACCEL);
  const turn = createHysteresis(ROUGH_TURN);
  const swerve = createSwerveDetector();
  /** Recent fixes (PIPELINE.ringBufferS) for the "GPS fix nearest the peak". */
  let fixes: GpsFix[] = [];
  const lastEndT = new Map<EventType, number>();
  /** Car heading integrated from yaw, rad. Only differences are meaningful. */
  let heading = 0;
  let turnStartHeading = 0;
  let lastT: number | null = null;
  let paused = false;

  function resetMachines() {
    filter.reset();
    brake.reset();
    accel.reset();
    turn.reset();
    swerve.reset();
  }

  function record(type: EventType, e: Episode) {
    const prevEnd = lastEndT.get(type);
    lastEndT.set(type, e.endT);
    if (prevEnd !== undefined && e.startT - prevEnd < PIPELINE.mergeWindowS * 1000) return;
    const fix = nearestFix(fixes, e.peakT);
    if (!fix) return;
    events.emit({
      type,
      tier: e.tier,
      peak: e.peak,
      durationS: (e.endT - e.startT) / 1000,
      speedMph: Math.max(0, fix.speedMps ?? 0) * MPS_TO_MPH,
      at: new Date(e.peakT).toISOString(),
      location: { type: 'Point', coordinates: [fix.lon, fix.lat] },
    });
  }

  return {
    onMotion(sample: MotionSample) {
      const { t } = sample;
      const frame = motionFrame(sample);
      heading += lastT === null ? 0 : (frame.yaw * (t - lastT)) / 1000;
      lastT = t;

      // §7 step 3. Every junk sample restarts the filter and state machines, so
      // handling noise never carries into an event once the phone settles.
      paused = isJunk(sample, frame);
      if (paused) {
        resetMachines();
        return;
      }

      const s = filter.update(frame, gps.latest());
      // lon is signed by GPS dv/dt, so "GPS speed dropping/rising" holds by construction.
      const b = brake.update(-s.lon, t);
      if (b) record('hard_brake', b);
      const a = accel.update(s.lon, t);
      if (a) record('hard_accel', a);

      const speed = gps.latest()?.speedMps ?? 0;
      if (speed >= PIPELINE.minSpeedForLateralMps) {
        const wasActive = turn.active();
        const tr = turn.update(Math.abs(s.lat), t);
        if (!wasActive && turn.active()) turnStartHeading = heading;
        if (
          tr &&
          Math.abs(heading - turnStartHeading) > ROUGH_TURN.minHeadingChangeDeg * DEG_TO_RAD
        ) {
          record('rough_turn', tr);
        }
      } else {
        turn.reset();
      }
      if (speed > SWERVE.minSpeedMps) {
        const sw = swerve.update(s.lat, t, heading);
        if (sw) record('swerve', sw);
      } else {
        swerve.reset();
      }
      // TODO(WS1, §6 Level 2, only if time allows): learn forward axis.
    },
    onGps(fix: GpsFix) {
      gps.update(fix);
      fixes = fixes.filter((f) => fix.t - f.t <= PIPELINE.ringBufferS * 1000);
      fixes.push(fix);
    },
    reset() {
      paused = false;
      gps.reset();
      resetMachines();
      fixes = [];
      lastEndT.clear();
      heading = 0;
      lastT = null;
    },
    isPaused: () => paused,
    subscribe: (listener): Unsubscribe => events.subscribe(listener),
  };
}
