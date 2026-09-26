/**
 * Real TripsRepo over MongoDB (WS3). Master doc §9.
 *
 * Id convention: documents use ObjectId `_id` (and ObjectId `tripId` on events
 * and traces); convert to hex strings at this boundary so the rest of the server
 * and the API only see strings. Timestamps are stored as BSON Dates and returned
 * as ISO strings.
 */
import {
  COACH,
  type DrivingEvent,
  type RecurringSpot,
  type Trace,
  type Trip,
  type TripListItem,
} from '@edudriver/shared';
import { ObjectId, type Db } from 'mongodb';

import { COLLECTIONS } from './collections';
import type { TripsRepo } from './repo';

type TripDoc = Omit<Trip, '_id' | 'startedAt' | 'endedAt'> & {
  _id: ObjectId;
  startedAt: Date;
  endedAt: Date;
};
type EventDoc = Omit<DrivingEvent, '_id' | 'tripId' | 'at'> & {
  _id: ObjectId;
  tripId: ObjectId;
  at: Date;
};
type TraceDoc = Omit<Trace, 'tripId' | 'startedAt'> & {
  _id: ObjectId;
  tripId: ObjectId;
  startedAt: Date;
};

const EARTH_RADIUS_M = 6378100;

/** Only 24-char hex strings are our ids; anything else is "not found", not a 500. */
const toObjectId = (id: string): ObjectId | null =>
  /^[0-9a-f]{24}$/i.test(id) ? new ObjectId(id) : null;

const toTrip = ({ _id, startedAt, endedAt, ...rest }: TripDoc): Trip => ({
  ...rest,
  _id: _id.toHexString(),
  startedAt: startedAt.toISOString(),
  endedAt: endedAt.toISOString(),
});

const toEvent = ({ _id, tripId, at, ...rest }: EventDoc): DrivingEvent => ({
  ...rest,
  _id: _id.toHexString(),
  tripId: tripId.toHexString(),
  at: at.toISOString(),
});

const toTrace = ({ _id: _ignored, tripId, startedAt, ...rest }: TraceDoc): Trace => ({
  ...rest,
  tripId: tripId.toHexString(),
  startedAt: startedAt.toISOString(),
});

export function createMongoTripsRepo(db: Db): TripsRepo {
  const trips = db.collection<TripDoc>(COLLECTIONS.trips);
  const events = db.collection<EventDoc>(COLLECTIONS.events);
  const traces = db.collection<TraceDoc>(COLLECTIONS.traces);
  // Optional fields left undefined (e.g. overMph) must be omitted, not stored as null.
  const writeOpts = { ignoreUndefined: true } as const;

  return {
    async insertTrip({ trip, events: recorded, trace }) {
      const tripId = new ObjectId();
      const tripDoc: TripDoc = {
        ...trip,
        _id: tripId,
        startedAt: new Date(trip.startedAt),
        endedAt: new Date(trip.endedAt),
        coach: null,
        coachAudioUrl: null,
      };
      const eventDocs: EventDoc[] = recorded.map((e) => ({
        ...e,
        _id: new ObjectId(),
        tripId,
        userId: trip.userId,
        at: new Date(e.at),
      }));
      const traceDoc: TraceDoc = {
        ...trace,
        _id: new ObjectId(),
        tripId,
        userId: trip.userId,
        startedAt: new Date(trace.startedAt),
      };

      // All three writes or none, so a failed upload never leaves orphan events or traces.
      const session = db.client.startSession();
      try {
        await session.withTransaction(async () => {
          await trips.insertOne(tripDoc, { session, ...writeOpts });
          if (eventDocs.length > 0) await events.insertMany(eventDocs, { session, ...writeOpts });
          await traces.insertOne(traceDoc, { session, ...writeOpts });
        });
      } finally {
        await session.endSession();
      }

      return { trip: toTrip(tripDoc), events: eventDocs.map(toEvent) };
    },

    async setCoaching(tripId, coach, audioUrl) {
      const _id = toObjectId(tripId);
      if (!_id) return;
      await trips.updateOne({ _id }, { $set: { coach, coachAudioUrl: audioUrl } });
    },

    async listTrips(userId) {
      const docs = await trips
        .find({ userId })
        .sort({ startedAt: -1 })
        .project<Pick<TripDoc, '_id' | 'startedAt' | 'endedAt' | keyof TripListItem>>({
          startedAt: 1,
          endedAt: 1,
          distanceMi: 1,
          passenger: 1,
          score: 1,
          counts: 1,
          routePreview: 1,
        })
        .toArray();
      return docs.map(({ _id, startedAt, endedAt, ...rest }) => ({
        ...rest,
        _id: _id.toHexString(),
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
      }));
    },

    async getTrip(tripId) {
      const _id = toObjectId(tripId);
      if (!_id) return null;
      const doc = await trips.findOne({ _id });
      if (!doc) return null;
      const evts = await events.find({ tripId: _id }).sort({ at: 1 }).toArray();
      return { trip: toTrip(doc), events: evts.map(toEvent) };
    },

    async getTrace(tripId) {
      const _id = toObjectId(tripId);
      if (!_id) return null;
      const doc = await traces.findOne({ tripId: _id });
      return doc ? toTrace(doc) : null;
    },

    async getHistory(userId, excludeTripId) {
      const current = toObjectId(excludeTripId);

      // Last scored trips before this one, returned oldest first (trend order, §10 example).
      const scored = await trips
        .find({ userId, score: { $ne: null }, ...(current && { _id: { $ne: current } }) })
        .sort({ startedAt: -1 })
        .limit(COACH.historyScores)
        .project<{ score: number }>({ _id: 0, score: 1 })
        .toArray();
      const last5 = scored.map((t) => t.score).reverse();

      // Recurring spots (§1 differentiator 3): for each event in this trip, count the distinct
      // trips with the same event type within COACH.recurringSpotRadiusM (2dsphere index).
      const spots = new Map<string, RecurringSpot>();
      const tripEvents = current ? await events.find({ tripId: current }).toArray() : [];
      for (const e of tripEvents) {
        const street = e.street ?? 'an unnamed road';
        const key = `${e.type}|${street}`;
        const tripIds = await events.distinct('tripId', {
          userId,
          type: e.type,
          location: {
            $geoWithin: {
              $centerSphere: [e.location.coordinates, COACH.recurringSpotRadiusM / EARTH_RADIUS_M],
            },
          },
        });
        const count = tripIds.length;
        if (count >= COACH.recurringSpotMinCount && count > (spots.get(key)?.count ?? 0)) {
          spots.set(key, { type: e.type, street, count });
        }
      }

      return { last_5_scores: last5, recurring_spots: [...spots.values()] };
    },

    // TODO(WS3, §12 screen 5): score trend, per-type totals and per-10-mi rates,
    //   recurring spots, test readiness rule (team to define).
    getProgress: async () => {
      throw new Error('TODO(WS3): MongoTripsRepo.getProgress not implemented');
    },
  };
}
