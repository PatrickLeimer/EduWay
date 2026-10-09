/**
 * How long the car has been stopped, for the 30 s End Trip rule (§4).
 *
 * A stop starts on a fix with low or unknown speed and lasts while the car
 * stays within TRIP.stopRadiusM (plus the fix's accuracy) of where it began,
 * whatever the speed reads: parked phones often report no speed or a noisy
 * 1-2 m/s. Time is counted on the clock between fixes too, because phones send
 * fewer fixes while standing still. Pure (no Expo), tested in stopTimer.test.ts.
 */
import { TRIP, type GpsFix } from '@eduway/shared';

import { haversineM } from '../road';

export interface StopTimer {
  /** Adds a fix. Returns the seconds stopped as of that fix. */
  onFix(fix: GpsFix, nowMs: number): number;
  /** Seconds stopped right now, counting the time since the last fix. */
  stoppedForS(nowMs: number): number;
  reset(): void;
}

export function createStopTimer(): StopTimer {
  /** Where and when (fix time) the current stop began; null while moving. */
  let anchor: { lat: number; lon: number; t: number } | null = null;
  /** Last fix time and the clock when it arrived, to keep counting between fixes. */
  let last: { t: number; arrivedMs: number } | null = null;

  const isSlow = (fix: GpsFix) => fix.speedMps == null || fix.speedMps < TRIP.stoppedSpeedMps;
  const nearAnchor = (fix: GpsFix) =>
    anchor !== null &&
    haversineM(anchor.lat, anchor.lon, fix.lat, fix.lon) <= TRIP.stopRadiusM + (fix.accuracyM ?? 0);

  const timer: StopTimer = {
    onFix(fix, nowMs) {
      if (nearAnchor(fix)) {
        // Still parked: keep the stop, whatever the speed reads.
      } else if (isSlow(fix)) {
        anchor = { lat: fix.lat, lon: fix.lon, t: fix.t };
      } else {
        anchor = null;
      }
      last = { t: fix.t, arrivedMs: nowMs };
      return timer.stoppedForS(nowMs);
    },
    stoppedForS(nowMs) {
      if (!anchor || !last) return 0;
      return Math.max(0, (last.t - anchor.t) / 1000 + (nowMs - last.arrivedMs) / 1000);
    },
    reset() {
      anchor = null;
      last = null;
    },
  };
  return timer;
}
