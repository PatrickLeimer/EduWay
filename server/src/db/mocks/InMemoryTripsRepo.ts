/**
 * In-memory TripsRepo (WS3 mock), seeded with the fixture trip. Lets routes,
 * scoring and coach run with no database. Data is lost on restart.
 * Progress is computed from the stored trips with the same builder as MongoDB.
 */
import { eventsFixture, traceFixture, tripFixture, tripSummaryFixture } from '@edudriver/fixtures';
import {
  COACH,
  type DrivingEvent,
  type RecordedEvent,
  type Trace,
  type Trip,
} from '@edudriver/shared';

import {
  buildProgress,
  toGamificationTrip,
  type ProgressSpot,
  type ProgressTrip,
} from '../../gamification';
import type { StoredStreetView, TripsRepo } from '../repo';

export function createInMemoryTripsRepo(): TripsRepo {
  const trips = new Map<string, Trip>();
  const events = new Map<string, DrivingEvent[]>();
  const traces = new Map<string, Trace>();
  const streetViews = new Map<string, StoredStreetView | null>();
  let seq = 0;

  const withIds = (list: RecordedEvent[], tripId: string, userId: string): DrivingEvent[] =>
    list.map((e, i) => ({ ...e, _id: `${tripId}-evt-${i}`, tripId, userId }));

  const progressRows = (userId: string): ProgressTrip[] =>
    [...trips.values()]
      .filter((t) => t.userId === userId)
      .map((t) => ({
        id: t._id,
        startedAt: t.startedAt,
        endedAt: t.endedAt,
        distanceMi: t.distanceMi,
        passenger: t.passenger,
        score: t.score,
        counts: t.counts,
        harshEvents: (events.get(t._id) ?? []).filter((e) => e.tier === 'harsh').length,
      }));

  /** Same event type on the same street on at least recurringSpotMinCount trips. */
  const recurringSpots = (userId: string): ProgressSpot[] => {
    const groups = new Map<string, { spot: ProgressSpot; trips: Set<string> }>();
    for (const list of events.values()) {
      for (const e of list) {
        if (e.userId !== userId || !e.street) continue;
        const key = `${e.type}|${e.street}`;
        const g = groups.get(key) ?? {
          spot: { type: e.type, street: e.street, count: 0, location: e.location },
          trips: new Set<string>(),
        };
        g.trips.add(e.tripId);
        groups.set(key, g);
      }
    }
    return [...groups.values()]
      .map((g) => ({ ...g.spot, count: g.trips.size }))
      .filter((s) => s.count >= COACH.recurringSpotMinCount)
      .sort((a, b) => b.count - a.count);
  };

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
    async getProgress(userId) {
      return buildProgress(progressRows(userId), recurringSpots(userId));
    },
    async listGamificationTrips(userId) {
      return progressRows(userId).map(toGamificationTrip);
    },
  };
}
