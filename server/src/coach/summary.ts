/**
 * Builds the compact Gemini input from a saved trip (master doc §10 "Input").
 * Pure: tested with fixtures (expected output: fixtures/trip-summary.json).
 *
 * Gemini never sees sensor data or the trace, only this summary.
 */
import type { DrivingEvent, EventType, SummaryEvent, Trip, TripSummary } from '@edudriver/shared';

/** Events whose `peak` is an acceleration in m/s². Speeding's peak duplicates over_mph. */
const MOTION_TYPES: readonly EventType[] = ['hard_brake', 'hard_accel', 'rough_turn', 'swerve'];

/** One decimal is plenty for the prompt and keeps raw detector floats out of it. */
const round1 = (n: number) => Math.round(n * 10) / 10;

/** The event the backend picked for Street View (§12), and whether it is at a recurring spot. */
export interface StreetViewPick {
  event: DrivingEvent;
  recurringSpot: boolean;
}

/**
 * `streetView`: the Street View pick for Gemini's caption. Leave it out when the
 * picker did not run; pass null when it ran and nothing qualified.
 */
export function buildTripSummary(
  trip: Trip,
  events: DrivingEvent[],
  history: TripSummary['history'],
  streetView?: StreetViewPick | null,
): TripSummary {
  const durationMs = Date.parse(trip.endedAt) - Date.parse(trip.startedAt);
  const summary: TripSummary = {
    trip: {
      duration_min: round1(durationMs / 60_000),
      distance_mi: trip.distanceMi,
      score: trip.score,
    },
    events: [...events].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).map(toSummaryEvent),
    stats: {
      events_per_10mi: trip.stats.eventsPer10Mi,
      pct_time_speeding: trip.stats.pctTimeSpeeding,
      phone_use_seconds: trip.stats.phoneUseSeconds,
    },
    history,
  };
  if (streetView !== undefined)
    summary.street_view_event = streetView && toStreetViewEvent(streetView);
  return summary;
}

/** The summary event plus the limit (for any type) and the recurring-spot flag (§12). */
function toStreetViewEvent({ event, recurringSpot }: StreetViewPick) {
  const e = toSummaryEvent(event);
  if (e.limit_mph === undefined && event.limitMph != null) e.limit_mph = event.limitMph;
  return { ...e, recurring_spot: recurringSpot };
}

/** Keeps only the fields that matter for the event's type (§10 "Input"). */
function toSummaryEvent(e: DrivingEvent): SummaryEvent {
  const out: SummaryEvent = { type: e.type, tier: e.tier };
  if (MOTION_TYPES.includes(e.type) && e.peak != null) out.peak = round1(e.peak);
  out.speed_mph = round1(e.speedMph);
  if (e.street != null) out.street = e.street;
  out.alerted = e.alerted;

  switch (e.type) {
    case 'speeding':
      if (e.overMph != null) out.over_mph = round1(e.overMph);
      if (e.limitMph != null) out.limit_mph = e.limitMph;
      out.limit_confidence = e.limitConfidence;
      break;
    case 'rolling_stop':
      if (e.minSpeedMph != null) out.min_speed_mph = round1(e.minSpeedMph);
      break;
    case 'phone_use':
      out.duration_s = round1(e.durationS);
      break;
  }
  return out;
}
