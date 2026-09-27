/**
 * In-memory TripsRepo (WS3 mock), seeded with the fixture trip. Lets routes,
 * scoring and coach run with no database. Data is lost on restart.
 */
import {
  eventsFixture,
  progressFixture,
  traceFixture,
  tripFixture,
  tripSummaryFixture,
} from '@edudriver/fixtures';
import type { DrivingEvent, RecordedEvent, Trace, Trip } from '@edudriver/shared';

import type { StoredStreetView, TripsRepo } from '../repo';

export function createInMemoryTripsRepo(): TripsRepo {
  const trips = new Map<string, Trip>();
  const events = new Map<string, DrivingEvent[]>();
  const traces = new Map<string, Trace>();
  const streetViews = new Map<string, StoredStreetView | null>();
  let seq = 0;

  const withIds = (list: RecordedEvent[], tripId: string, userId: string): DrivingEvent[] =>
    list.map((e, i) => ({ ...e, _id: `${tripId}-evt-${i}`, tripId, userId }));

  // Seed with the fixture drive so GET endpoints return data on a fresh server.
  trips.set(tripFixture._id, tripFixture);
  events.set(tripFixture._id, withIds(eventsFixture, tripFixture._id, tripFixture.userId));
  traces.set(tripFixture._id, traceFixture);

  return {
    async insertTrip({ trip, events: evts, trace }) {
      const _id = `mem-trip-${++seq}`;
      const saved: Trip = { ...trip, _id, coach: null, coachAudioUrl: null };
      trips.set(_id, saved);
      events.set(_id, withIds(evts, _id, trip.userId));
      traces.set(_id, { ...trace, tripId: _id, userId: trip.userId });
      return { trip: saved, events: events.get(_id)! };
    },
    async setCoaching(tripId, coach, audioUrl) {
      const t = trips.get(tripId);
      if (t) trips.set(tripId, { ...t, coach, coachAudioUrl: audioUrl });
    },
    async setStreetView(tripId, streetView) {
      if (trips.has(tripId)) streetViews.set(tripId, streetView);
    },
    async getStreetView(tripId) {
      return streetViews.get(tripId) ?? null;
    },
    async listTrips(userId) {
      return [...trips.values()]
        .filter((t) => t.userId === userId)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        .map(({ _id, startedAt, endedAt, distanceMi, passenger, score, counts, routePreview }) => ({
          _id,
          startedAt,
          endedAt,
          distanceMi,
          passenger,
          score,
          counts,
          routePreview,
        }));
    },
    async getTrip(tripId) {
      const trip = trips.get(tripId);
      return trip ? { trip, events: events.get(tripId) ?? [] } : null;
    },
    async getTrace(tripId) {
      return traces.get(tripId) ?? null;
    },
    async getHistory() {
      return tripSummaryFixture.history;
    },
    async getProgress() {
      return progressFixture;
    },
  };
}
