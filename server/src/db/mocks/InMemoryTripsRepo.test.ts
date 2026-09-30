// Placeholder test: the in-memory repo round-trips a trip and honors the shared schemas.
import { eventsFixture, traceFixture, tripFixture } from '@eduway/fixtures';
import { GetTripResponseSchema, TraceSchema } from '@eduway/shared';
import { describe, expect, it } from 'vitest';

import { createInMemoryTripsRepo } from './InMemoryTripsRepo';

describe('InMemoryTripsRepo', () => {
  it('inserts and reads back a trip, its events and its trace', async () => {
    const repo = createInMemoryTripsRepo();
    const { _id: _ignored, coach: _c, coachAudioUrl: _a, ...trip } = tripFixture;
    const { trip: saved } = await repo.insertTrip({
      trip,
      events: eventsFixture,
      trace: traceFixture,
    });

    const loaded = await repo.getTrip(saved._id);
    // The repo returns trip + events; the route adds `streetView` (Street View Part 1).
    expect(GetTripResponseSchema.omit({ streetView: true }).safeParse(loaded).success).toBe(true);
    expect(loaded?.events).toHaveLength(eventsFixture.length);
    expect(TraceSchema.parse(await repo.getTrace(saved._id)).tripId).toBe(saved._id);
    expect((await repo.listTrips(trip.userId)).map((t) => t._id)).toContain(saved._id);
  });
});
