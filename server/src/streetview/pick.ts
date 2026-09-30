/**
 * Which infraction to show in Street View, and which way the camera faces
 * (master doc §12 "Street View callout"). Pure: tested in pick.test.ts.
 */
import {
  PIPELINE,
  STREET_VIEW,
  type DrivingEvent,
  type RecurringSpot,
  type Trace,
} from '@eduway/shared';

/** What the picker needs from the trip's GPS trace (§9). */
export type PickTrace = Pick<Trace, 'startedAt' | 't' | 'lat' | 'lon' | 'heading' | 'accuracyM'>;

/** Same key getHistory uses for recurring spots (type + street). */
export function isRecurringSpot(event: DrivingEvent, spots: RecurringSpot[]): boolean {
  const street = event.street ?? 'an unnamed road';
  return spots.some((s) => s.type === event.type && s.street === street);
}

/**
 * Events that may be shown, best first. Excluded: types not in
 * STREET_VIEW.typePriority (phone use, hard acceleration), speeding against an
 * inferred or unknown limit, and events whose GPS fix is worse than
 * PIPELINE.maxGpsAccuracyM. Ranked by: harsh before coach, recurring spot,
 * type priority, higher peak, then earlier.
 */
export function rankStreetViewCandidates(
  events: DrivingEvent[],
  trace: PickTrace,
  spots: RecurringSpot[],
): DrivingEvent[] {
  const priority = (e: DrivingEvent) => STREET_VIEW.typePriority.indexOf(e.type);
  return events
    .filter((e) => priority(e) >= 0)
    .filter((e) => e.type !== 'speeding' || e.limitConfidence === 'posted')
    .filter((e) => {
      const accuracy = nearestFix(trace, offsetS(trace, e.at), (i) => trace.accuracyM[i]);
      return accuracy == null || accuracy <= PIPELINE.maxGpsAccuracyM;
    })
    .map((e) => ({ e, recurring: isRecurringSpot(e, spots) }))
    .sort(
      (a, b) =>
        Number(b.e.tier === 'harsh') - Number(a.e.tier === 'harsh') ||
        Number(b.recurring) - Number(a.recurring) ||
        priority(a.e) - priority(b.e) ||
        (b.e.peak ?? -Infinity) - (a.e.peak ?? -Infinity) ||
        Date.parse(a.e.at) - Date.parse(b.e.at),
    )
    .map(({ e }) => e);
}

/**
 * Camera heading (degrees, 0 = north): the driving direction about
 * STREET_VIEW.headingLookbackS before the event, so it shows what the student
 * saw on approach. Falls back to the heading at the event, then to the bearing
 * from an earlier fix to the event, then 0.
 */
export function headingBefore(trace: PickTrace, event: DrivingEvent): number {
  const at = offsetS(trace, event.at);
  const heading = (i: number) => trace.heading[i];
  const h =
    nearestFix(trace, at - STREET_VIEW.headingLookbackS, heading) ??
    nearestFix(trace, at, heading) ??
    bearingOnApproach(trace, event, at);
  return normalizeDeg(h ?? 0);
}

function offsetS(trace: PickTrace, atIso: string): number {
  return (Date.parse(atIso) - Date.parse(trace.startedAt)) / 1000;
}

/** A value from the fix nearest `tS` within the match window, or null. */
function nearestFix(
  trace: PickTrace,
  tS: number,
  value: (i: number) => number | null | undefined,
): number | null {
  let best: number | null = null;
  let bestDt = Infinity;
  trace.t.forEach((t, i) => {
    const dt = Math.abs(t - tS);
    const v = value(i);
    if (v != null && dt <= STREET_VIEW.headingMatchWindowS && dt < bestDt) {
      best = v;
      bestDt = dt;
    }
  });
  return best;
}

/** Bearing from the fix about lookback seconds before the event to the event itself. */
function bearingOnApproach(trace: PickTrace, event: DrivingEvent, at: number): number | null {
  let i = -1;
  trace.t.forEach((t, k) => {
    if (t <= at - 1) i = k;
  });
  if (i < 0) return null;
  const [lon2, lat2] = event.location.coordinates;
  const lat1 = trace.lat[i]!;
  const lon1 = trace.lon[i]!;
  if (lat1 === lat2 && lon1 === lon2) return null;
  const rad = Math.PI / 180;
  const y = Math.sin((lon2 - lon1) * rad) * Math.cos(lat2 * rad);
  const x =
    Math.cos(lat1 * rad) * Math.sin(lat2 * rad) -
    Math.sin(lat1 * rad) * Math.cos(lat2 * rad) * Math.cos((lon2 - lon1) * rad);
  return Math.atan2(y, x) / rad;
}

function normalizeDeg(d: number): number {
  return Math.round((((d % 360) + 360) % 360) * 10) / 10;
}
