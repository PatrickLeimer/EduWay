/**
 * Mock ApiClient (WS3). Returns fixture data after a short fake latency, and
 * validates requests with the shared schemas so callers find contract bugs
 * before the real server exists.
 *
 * createTrip echoes the uploaded trip times/flags onto the fixture trip, and
 * remembers it so listTrips/getTrip show it afterwards.
 */
import { eventsFixture, progressFixture, traceFixture, tripFixture } from '@edudriver/fixtures';
import { CreateTripRequestSchema, type DrivingEvent, type Trip } from '@edudriver/shared';

import { ApiError, type ApiClient } from '../../contracts';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createMockApiClient(latencyMs = 300): ApiClient {
  const trips = new Map<string, { trip: Trip; events: DrivingEvent[] }>();
  const withIds = (tripId: string, userId: string): DrivingEvent[] =>
    eventsFixture.map((e, i) => ({ ...e, _id: `${tripId}-evt-${i}`, tripId, userId }));
  trips.set(tripFixture._id, {
    trip: tripFixture,
    events: withIds(tripFixture._id, tripFixture.userId),
  });

  const find = (id: string) => {
    const hit = trips.get(id);
    if (!hit) throw new ApiError(`Trip ${id} not found`, 404);
    return hit;
  };

  return {
    async createTrip(req) {
      await delay(latencyMs);
      const body = CreateTripRequestSchema.parse(req);
      const _id = `mock-trip-${trips.size + 1}`;
      const trip: Trip = {
        ...tripFixture,
        ...body.trip,
        _id,
        userId: body.userId,
        score: body.trip.passenger ? null : tripFixture.score,
      };
      trips.set(_id, { trip, events: withIds(_id, body.userId) });
      return { trip, coach: trip.coach, coachAudioUrl: trip.coachAudioUrl };
    },
    async listTrips(userId) {
      await delay(latencyMs);
      const list = [...trips.values()]
        .filter((t) => t.trip.userId === userId)
        .map(({ trip }) => ({
          _id: trip._id,
          startedAt: trip.startedAt,
          endedAt: trip.endedAt,
          distanceMi: trip.distanceMi,
          passenger: trip.passenger,
          score: trip.score,
          counts: trip.counts,
          routePreview: trip.routePreview,
        }))
        .reverse();
      return { trips: list };
    },
    async getTrip(id) {
      await delay(latencyMs);
      return find(id);
    },
    async getTrace(id) {
      await delay(latencyMs);
      const { trip } = find(id);
      return { ...traceFixture, tripId: trip._id, userId: trip.userId };
    },
    async getProgress() {
      await delay(latencyMs);
      return progressFixture;
    },
    async ask(_userId, question) {
      await delay(latencyMs);
      return { answer: `(mock coach) You asked: "${question}". Your stops are improving.` };
    },
  };
}
