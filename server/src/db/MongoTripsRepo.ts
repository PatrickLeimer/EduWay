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

import {
  buildProgress,
  toGamificationTrip,
  type ProgressSpot,
  type ProgressTrip,
} from '../gamification';
import { COLLECTIONS } from './collections';
import { pickMainProblem } from './mainProblem';
import type { StoredStreetView, TripsRepo } from './repo';

type TripDoc = Omit<Trip, '_id' | 'startedAt' | 'endedAt'> & {
  _id: ObjectId;
  startedAt: Date;
  endedAt: Date;
  /** Street View callout (§12); only our own data, never the image. */
  streetView?: StoredStreetView | null;
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

const toTrip = ({ _id, startedAt, endedAt, streetView: _streetView, ...rest }: TripDoc): Trip => ({
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

  /** Trip summaries + harsh-event counts for progress and gamification. Never loads traces (§9). */
  async function progressRows(userId: string): Promise<ProgressTrip[]> {
    const docs = await trips
      .find({ userId })
      .project<
        Pick<
          TripDoc,
          '_id' | 'startedAt' | 'endedAt' | 'distanceMi' | 'passenger' | 'score' | 'counts'
        >
      >({
        startedAt: 1,
        endedAt: 1,
        distanceMi: 1,
        passenger: 1,
        score: 1,
        counts: 1,
      })
      .toArray();
    const harsh = await events
      .aggregate<{ _id: ObjectId; n: number }>([
        { $match: { userId, tier: 'harsh' } },
        { $group: { _id: '$tripId', n: { $sum: 1 } } },
      ])
      .toArray();
    const harshByTrip = new Map(harsh.map((h) => [h._id.toHexString(), h.n]));
    return docs.map((d) => {
      const id = d._id.toHexString();
      return {
        id,
        startedAt: d.startedAt.toISOString(),
        endedAt: d.endedAt.toISOString(),
        distanceMi: d.distanceMi,
        passenger: d.passenger,
        score: d.score,
        counts: d.counts,
        harshEvents: harshByTrip.get(id) ?? 0,
      };
    });
  }

  /**
   * Recurring spots across all trips: the same event type on the same street on
   * at least COACH.recurringSpotMinCount different trips. (getHistory does the
   * 50 m 2dsphere version per event for the Gemini summary; per-street grouping
   * keeps the progress screen to one query.)
   */
  async function recurringSpotsFor(userId: string): Promise<ProgressSpot[]> {
    return events
      .aggregate<ProgressSpot>([
        { $match: { userId, street: { $ne: null } } },
        {
          $group: {
            _id: { type: '$type', street: '$street' },
            trips: { $addToSet: '$tripId' },
            location: { $first: '$location' },
          },
        },
        {
          $project: {
            _id: 0,
            type: '$_id.type',
            street: '$_id.street',
            count: { $size: '$trips' },
            location: { type: '$location.type', coordinates: '$location.coordinates' },
          },
        },
        { $match: { count: { $gte: COACH.recurringSpotMinCount } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ])
      .toArray();
  }

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

    async setStreetView(tripId, streetView) {
      const _id = toObjectId(tripId);
      if (!_id) return;
      await trips.updateOne({ _id }, { $set: { streetView } });
    },

    async getStreetView(tripId) {
      const _id = toObjectId(tripId);
      if (!_id) return null;
      const doc = await trips.findOne({ _id }, { projection: { streetView: 1 } });
      return doc?.streetView ?? null;
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

      // Scores stay "before this trip". The pattern count includes this trip, so
      // the debrief can be the moment a problem reaches the minimum.
      const patternEvents = await events
        .find({ userId })
        .project<{ type: EventDoc['type']; street: EventDoc['street']; tripId: ObjectId }>({
          _id: 0,
          type: 1,
          street: 1,
          tripId: 1,
        })
        .toArray();

      return {
        last_5_scores: last5,
        recurring_spots: [...spots.values()],
        main_problem: pickMainProblem(
          patternEvents.map((event) => ({
            type: event.type,
            street: event.street,
            tripId: event.tripId.toHexString(),
          })),
        ),
      };
    },

    async getProgress(userId) {
      const [rows, spots] = await Promise.all([progressRows(userId), recurringSpotsFor(userId)]);
      return buildProgress(rows, spots);
    },

    async listGamificationTrips(userId) {
      return (await progressRows(userId)).map(toGamificationTrip);
    },
  };
}
