/**
 * §7 swerve rule: lateral goes past +peak then −peak (or the reverse) within
 * SWERVE.windowS, with net heading change under SWERVE.maxNetHeadingChangeDeg.
 * Pure. The caller gates on speed (SWERVE.minSpeedMps).
 *
 * A "lobe" is a run of samples with |lat| ≥ SWERVE.coach.peakMps2 and one sign.
 * Two opposite lobes whose peaks are within the window make a swerve, reported
 * when the second lobe ends. Harsh when both peaks reach SWERVE.harsh.peakMps2.
 */
import { DEG_TO_RAD, SWERVE } from '@eduway/shared';

import type { Episode } from './hysteresis';

interface Lobe {
  sign: number;
  startT: number;
  /** Integrated heading (rad) when the lobe started. */
  startHeading: number;
  peak: number;
  peakT: number;
}

export interface SwerveDetector {
  /** `lat` filtered lateral m/s²; `heading` integrated yaw, rad. */
  update(lat: number, t: number, heading: number): Episode | null;
  reset(): void;
}

export function createSwerveDetector(): SwerveDetector {
  let cur: Lobe | null = null;
  let prev: Lobe | null = null;

  function finish(lobe: Lobe, t: number, heading: number): Episode | null {
    const first = prev;
    if (
      first &&
      first.sign !== lobe.sign &&
      lobe.peakT - first.peakT <= SWERVE.windowS * 1000 &&
      Math.abs(heading - first.startHeading) < SWERVE.maxNetHeadingChangeDeg * DEG_TO_RAD
    ) {
      prev = null;
      return {
        startT: first.startT,
        endT: t,
        peak: Math.max(first.peak, lobe.peak),
        peakT: first.peak >= lobe.peak ? first.peakT : lobe.peakT,
        tier: Math.min(first.peak, lobe.peak) >= SWERVE.harsh.peakMps2 ? 'harsh' : 'coach',
      };
    }
    prev = lobe;
    return null;
  }

  return {
    update(lat, t, heading) {
      const mag = Math.abs(lat);
      const sign = Math.sign(lat);
      let result: Episode | null = null;
      if (cur && (mag < SWERVE.coach.peakMps2 || sign !== cur.sign)) {
        result = finish(cur, t, heading);
        cur = null;
      }
      if (!cur && mag >= SWERVE.coach.peakMps2) {
        cur = { sign, startT: t, startHeading: heading, peak: mag, peakT: t };
      } else if (cur && mag > cur.peak) {
        cur.peak = mag;
        cur.peakT = t;
      }
      return result;
    },
    reset() {
      cur = null;
      prev = null;
    },
  };
}
