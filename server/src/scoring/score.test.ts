// Placeholder test: scoring output matches the shared trip schemas. WS3 replaces the
// stub expectations with real penalty cases once scoreTrip is implemented.
import { eventsFixture, traceFixture, tripFixture } from '@edudriver/fixtures';
import { TripCountsSchema, TripStatsSchema } from '@edudriver/shared';
import { describe, expect, it } from 'vitest';

import { mockScoreTrip } from './mocks';
import { scoreTrip } from './score';

describe('scoreTrip', () => {
  const input = {
    events: eventsFixture,
    distanceMi: tripFixture.distanceMi,
    passenger: false,
    trace: traceFixture,
  };

  it('returns schema-valid counts and stats', () => {
    for (const fn of [scoreTrip, mockScoreTrip]) {
      const r = fn(input);
      expect(TripCountsSchema.safeParse(r.counts).success).toBe(true);
      expect(TripStatsSchema.safeParse(r.stats).success).toBe(true);
    }
  });

  it('does not score passenger trips (§4)', () => {
    expect(scoreTrip({ ...input, passenger: true }).score).toBeNull();
    expect(mockScoreTrip({ ...input, passenger: true }).score).toBeNull();
  });
});
