/**
 * Mock ApiClient (WS3). Returns fixture data after a short fake latency, and
 * validates requests with the shared schemas so callers find contract bugs
 * before the real server exists.
 *
 * createTrip echoes the uploaded trip times/flags onto the fixture trip, and
 * remembers it so listTrips/getTrip show it afterwards. Its progressUpdate
 * alternates between "tier went up" and "streak just broke" so the debrief can
 * be built against both; passenger trips get a non-qualifying update.
 *
 * Street View (§12): the fixture trip has a callout, a second seeded trip has
 * none (streetView: null), so screens can be built against both. New trips get
 * a callout unless they are passenger trips.
 *
 * A third seeded trip has no coaching (as when Gemini was busy), so the coach
 * screen's "Try again" can be built; retryCoaching fills it in.
 */
import {
  debriefWithoutStreetViewFixture,
  debriefWithStreetViewFixture,
  fixtureEventsWithIds,
  progressFixture,
  progressUpdateStreakBrokenFixture,
  progressUpdateTierUpFixture,
  streetViewCalloutFixture,
  traceFixture,
  tripFixture,
} from '@eduway/fixtures';
import {
  CreateTripRequestSchema,
  type GetTripResponse,
  type ProgressUpdate,
  type StreetViewCallout,
  type Trip,
} from '@eduway/shared';

import { ApiError, type ApiClient } from '../../contracts';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A passenger (or too short) trip changes nothing. */
function unchanged(from: ProgressUpdate): ProgressUpdate {
  const none = (current: number) => ({ change: 'none' as const, newBest: false, current });
  return {
    qualifying: false,
    streaks: {
      hot: none(from.streaks.hot.current),
      clean: none(from.streaks.clean.current),
      phoneFree: none(from.streaks.phoneFree.current),
    },
    tier: { before: from.tier.before, after: from.tier.before, change: 'same' },
    readiness: { before: from.readiness.before, after: from.readiness.before, delta: 0 },
  };
}

export function createMockApiClient(latencyMs = 300): ApiClient {
  const trips = new Map<string, GetTripResponse>();
  trips.set(tripFixture._id, debriefWithStreetViewFixture);
  const noCalloutId = `${tripFixture._id}-no-streetview`;
  trips.set(noCalloutId, {
    trip: { ...debriefWithoutStreetViewFixture.trip, _id: noCalloutId },
    events: fixtureEventsWithIds(noCalloutId, tripFixture.userId),
    streetView: null,
  });

  const noCoachId = `${tripFixture._id}-no-coach`;
  trips.set(noCoachId, {
    trip: { ...tripFixture, _id: noCoachId, coach: null, coachAudioUrl: null },
    events: fixtureEventsWithIds(noCoachId, tripFixture.userId),
    streetView: null,
  });

  /** The fixture callout, re-pointed at another trip (same event index). */
  const calloutFor = (tripId: string): StreetViewCallout => ({
    ...streetViewCalloutFixture,
    eventId: streetViewCalloutFixture.eventId.replace(tripFixture._id, tripId),
    thumbnailUrl: `/streetview/${tripId}/thumbnail`,
    panoramaUrl: `/streetview/${tripId}/panorama`,
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
      const streetView = body.trip.passenger ? null : calloutFor(_id);
      trips.set(_id, { trip, events: fixtureEventsWithIds(_id, body.userId), streetView });
      const sample =
        trips.size % 2 === 0 ? progressUpdateTierUpFixture : progressUpdateStreakBrokenFixture;
      const progressUpdate = body.trip.passenger ? unchanged(sample) : sample;
      return {
        trip,
        coach: trip.coach,
        coachAudioUrl: trip.coachAudioUrl,
        streetView,
        progressUpdate,
      };
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
    async retryCoaching(id) {
      await delay(latencyMs);
      const found = find(id);
      if (found.trip.passenger || found.trip.coach) return found;
      const coached: GetTripResponse = {
        ...found,
        trip: { ...found.trip, coach: tripFixture.coach, coachAudioUrl: tripFixture.coachAudioUrl },
      };
      trips.set(id, coached);
      return coached;
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
