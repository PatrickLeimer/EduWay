/**
 * Builds the compact Gemini input from a saved trip (master doc §10 "Input").
 * STUB. Pure: tested with fixtures (expected output: fixtures/trip-summary.json).
 *
 * Gemini never sees sensor data or the trace, only this summary.
 */
import type { DrivingEvent, Trip, TripSummary } from '@edudriver/shared';

export function buildTripSummary(
  trip: Trip,
  _events: DrivingEvent[],
  history: TripSummary['history'],
): TripSummary {
  // TODO(WS4, §10): map each event to a SummaryEvent (snake_case, only the fields that matter
  //   for its type: over_mph/limit_mph/limit_confidence for speeding, min_speed_mph for
  //   rolling stops, duration_s for phone use). duration_min from startedAt/endedAt.
  return {
    trip: { duration_min: 0, distance_mi: trip.distanceMi, score: trip.score },
    events: [],
    stats: {
      events_per_10mi: trip.stats.eventsPer10Mi,
      pct_time_speeding: trip.stats.pctTimeSpeeding,
      phone_use_seconds: trip.stats.phoneUseSeconds,
    },
    history,
  };
}
