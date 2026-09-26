/**
 * Real TripsRepo over MongoDB (WS3). STUB. Master doc §9.
 *
 * Id convention: documents use ObjectId `_id`; convert to hex strings at this
 * boundary so the rest of the server and the API only see strings.
 */
import type { Db } from 'mongodb';

import type { TripsRepo } from './repo';

const todo = (what: string): never => {
  throw new Error(`TODO(WS3): MongoTripsRepo.${what} not implemented`);
};

export function createMongoTripsRepo(_db: Db): TripsRepo {
  return {
    // TODO(WS3, §9): insert into trips (without trace), events (with tripId/userId and GeoJSON
    //   location), traces (columnar arrays, unique tripId). Consider a transaction or
    //   insert-trip-last so a failed upload leaves no orphan trip.
    insertTrip: async () => todo('insertTrip'),
    // TODO(WS3): updateOne({ _id }, { $set: { coach, coachAudioUrl } }).
    setCoaching: async () => todo('setCoaching'),
    // TODO(WS3): find({ userId }).sort({ startedAt: -1 }) with a projection (no coach, no stats).
    listTrips: async () => todo('listTrips'),
    getTrip: async () => todo('getTrip'),
    getTrace: async () => todo('getTrace'),
    // TODO(WS3, §10): last COACH.historyScores scores; recurring spots via $geoNear / 2dsphere
    //   grouping of the user's events within COACH.recurringSpotRadiusM.
    getHistory: async () => todo('getHistory'),
    // TODO(WS3, §12 screen 5): score trend, per-type totals and per-10-mi rates,
    //   recurring spots, test readiness rule (team to define).
    getProgress: async () => todo('getProgress'),
  };
}
