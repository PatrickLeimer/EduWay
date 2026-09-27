/**
 * Typed access to the shared fixtures.
 *
 * Each JSON file is parsed with its @edudriver/shared schema on import, so a
 * fixture that drifts from the contract fails loudly (in tests and in mocks)
 * instead of silently feeding bad data to another workstream.
 *
 * Scenario: a ~3 minute drive in Miami. North on SW 107th Ave (residential, no
 * maxspeed tag → inferred 25 mph), rolling stop at SW 4th St, right onto SW 8th
 * St (primary, posted 40 mph), then 35 s stopped so the trip can end. The
 * events file covers every event type and tier, timed and placed on the trace.
 */
import {
  CoachOutputSchema,
  GetProgressResponseSchema,
  ProgressUpdateSchema,
  RecordedEventSchema,
  TraceSchema,
  TripSchema,
  TripSummarySchema,
  type DraftEvent,
  type EventType,
  type GpsFix,
} from '@edudriver/shared';
import { z } from 'zod';

import coachOutputJson from './coach-output.json';
import eventsJson from './events.all-types.json';
import overpassJson from './overpass.response.json';
import progressUpdateStreakBrokenJson from './progress-update.streak-broken.json';
import progressUpdateTierUpJson from './progress-update.tier-up.json';
import progressJson from './progress.json';
import traceJson from './trace.short-drive.json';
import tripSummaryJson from './trip-summary.json';
import tripJson from './trip.json';

export const traceFixture = TraceSchema.parse(traceJson);
export const eventsFixture = z.array(RecordedEventSchema).parse(eventsJson);
export const tripFixture = TripSchema.parse(tripJson);
export const tripSummaryFixture = TripSummarySchema.parse(tripSummaryJson);
export const coachOutputFixture = CoachOutputSchema.parse(coachOutputJson);
export const progressFixture = GetProgressResponseSchema.parse(progressJson);
/** POST /trips progressUpdate where the phone-free streak just broke. */
export const progressUpdateStreakBrokenFixture = ProgressUpdateSchema.parse(
  progressUpdateStreakBrokenJson,
);
/** POST /trips progressUpdate where the rank tier just went up (Gold → Platinum). */
export const progressUpdateTierUpFixture = ProgressUpdateSchema.parse(progressUpdateTierUpJson);

/** Seconds from trip start (trace.startedAt) to an event's `at`. Used by mocks to replay events in time. */
export function offsetFromTripStartS(
  at: string,
  startedAt: string = traceFixture.startedAt,
): number {
  return (Date.parse(at) - Date.parse(startedAt)) / 1000;
}

/**
 * The fixture events as detectors would emit them (road context and alert
 * status stripped), each tagged with its offset from trip start.
 */
export const draftEventsFixture: { offsetS: number; event: DraftEvent }[] = eventsFixture.map(
  ({ street: _s, roadClass: _r, limitMph: _l, limitConfidence: _c, alerted: _a, ...draft }) => ({
    offsetS: offsetFromTripStartS(draft.at),
    event: draft,
  }),
);

/**
 * Replays fixture events of the given types in step with a live GPS stream.
 * Used by mocks (detection, road) so a mock trip produces events at the same
 * points in the drive as the fixture. The first fix seen is treated as trip
 * start; each event is re-stamped with the time and position of the fix that
 * released it, so it lines up with whatever trace is actually being recorded.
 */
export function createFixtureEventReplayer(types: readonly EventType[]) {
  const queue = () => draftEventsFixture.filter((e) => types.includes(e.event.type));
  let pending = queue();
  let t0: number | null = null;

  return {
    advance(fix: GpsFix): DraftEvent[] {
      t0 ??= fix.t;
      const elapsedS = (fix.t - t0) / 1000;
      const due = pending.filter((e) => e.offsetS <= elapsedS);
      pending = pending.filter((e) => e.offsetS > elapsedS);
      return due.map(({ event }) => ({
        ...event,
        at: new Date(fix.t).toISOString(),
        location: { type: 'Point', coordinates: [fix.lon, fix.lat] },
      }));
    },
    reset() {
      pending = queue();
      t0 = null;
    },
  };
}

/**
 * Raw Overpass API response (`[out:json]; ... out geom;`). No shared schema:
 * the Overpass format is a WS2-internal detail, so it is exported as `unknown`
 * and road/ casts it to its own OverpassResponse type.
 */
export const overpassFixture: unknown = overpassJson;
