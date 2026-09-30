/**
 * Decides which GPS fixes become the recorded route (master doc §9 "Route
 * traces", §15: ignore fixes worse than 20 m) and how far the car moved. Pure.
 *
 * Phones hand out a few bad fixes: a cached or cell-tower position when the
 * watch starts, low-accuracy fixes in garages, and single-fix jumps. Those used
 * to go straight into the trace, so the replay car flew off the road and the
 * trip distance was wrong. Detectors still get every fix; they filter on their own.
 */
import { PIPELINE, TRIP, type GpsFix } from '@edudriver/shared';

import { haversineM } from '../road';

export interface GpsPath {
  /** Meters moved since the last kept fix, or null when this fix is dropped. */
  add(fix: GpsFix): number | null;
}

export function createGpsPath(): GpsPath {
  let last: GpsFix | null = null;
  let jumps = 0;
  return {
    add(fix) {
      if (!Number.isFinite(fix.lat) || !Number.isFinite(fix.lon)) return null;
      if (fix.lat === 0 && fix.lon === 0) return null;
      if (fix.accuracyM != null && fix.accuracyM > PIPELINE.maxGpsAccuracyM) return null;
      if (!last) {
        last = fix;
        return 0;
      }
      const dtS = (fix.t - last.t) / 1000;
      if (!(dtS > 0)) return null;
      const stepM = haversineM(last.lat, last.lon, fix.lat, fix.lon);
      if (stepM / dtS > TRIP.maxPlausibleSpeedMps) {
        // A jump. Several in a row means the kept fix was the bad one: start over here.
        jumps++;
        if (jumps < TRIP.maxGpsJumps) return null;
        jumps = 0;
        last = fix;
        return 0;
      }
      jumps = 0;
      last = fix;
      // No distance across a long GPS gap (it isn't a measured path), or while
      // stopped (position jitter at a light would add up).
      if (dtS > TRIP.maxGpsGapS) return 0;
      if (fix.speedMps != null && fix.speedMps < TRIP.stoppedSpeedMps) return 0;
      return stepM;
    },
  };
}
