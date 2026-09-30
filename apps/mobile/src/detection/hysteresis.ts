/**
 * §7 step 4 hysteresis state machine for one event type, both tiers. Pure.
 *
 * An episode opens when the signal reaches coach `start` and closes when it
 * drops below `release`. It counts only if the signal stayed at or above coach
 * `start` for `minDurationS` in one continuous run; it is harsh if it also
 * stayed at or above harsh `start` for the harsh `minDurationS`. Episodes are
 * reported on release, so peak, duration and tier are final.
 */
import type { HysteresisThreshold, Tier } from '@eduway/shared';

export interface Episode {
  /** Epoch ms when the signal first reached coach start. */
  startT: number;
  /** Epoch ms of release. */
  endT: number;
  peak: number;
  peakT: number;
  tier: Tier;
}

export interface HysteresisMachine {
  /** Returns the finished episode on the sample that releases it, else null. */
  update(value: number, t: number): Episode | null;
  /** True between opening and release (even before the episode is confirmed). */
  active(): boolean;
  reset(): void;
}

interface Open {
  startT: number;
  peak: number;
  peakT: number;
  coachSince: number | null;
  harshSince: number | null;
  confirmed: boolean;
  harsh: boolean;
}

export function createHysteresis(
  th: Readonly<Record<Tier, HysteresisThreshold>>,
): HysteresisMachine {
  let open: Open | null = null;
  const held = (since: number | null, t: number, minS: number) =>
    since !== null && (t - since) / 1000 >= minS;

  return {
    update(value, t) {
      if (!open) {
        if (value < th.coach.start) return null;
        open = {
          startT: t,
          peak: value,
          peakT: t,
          coachSince: null,
          harshSince: null,
          confirmed: false,
          harsh: false,
        };
      }
      if (value < th.coach.release) {
        const done = open;
        open = null;
        if (!done.confirmed) return null;
        return {
          startT: done.startT,
          endT: t,
          peak: done.peak,
          peakT: done.peakT,
          tier: done.harsh ? 'harsh' : 'coach',
        };
      }
      if (value > open.peak) {
        open.peak = value;
        open.peakT = t;
      }
      open.coachSince = value >= th.coach.start ? (open.coachSince ?? t) : null;
      open.harshSince = value >= th.harsh.start ? (open.harshSince ?? t) : null;
      if (held(open.coachSince, t, th.coach.minDurationS)) open.confirmed = true;
      if (held(open.harshSince, t, th.harsh.minDurationS)) open.harsh = true;
      return null;
    },
    active: () => open !== null,
    reset() {
      open = null;
    },
  };
}
