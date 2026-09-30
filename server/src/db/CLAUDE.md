# db/ — WS3 MongoDB

**Owner:** WS3.

## What it does
All storage, behind the `TripsRepo` interface (master doc §9): trips, events (GeoJSON points, 2dsphere index), one columnar trace document per trip, history for the Gemini summary, progress aggregates and recurring-spot queries.

## Must not
- Store motion sensor data. Only trips, events and the 1 Hz GPS trace.
- Load traces when listing trips or computing progress (§9: keep lists fast).
- Leak MongoDB types (ObjectId etc.) past `TripsRepo`. Ids are strings outside db/.
- Create indexes anywhere but `collections.ts` + `setup.ts`.

## Contracts
- Implements: `TripsRepo` (`repo.ts`).
- Consumes: domain types from `@eduway/shared`; `COACH` thresholds for recurring spots.

## Storage notes
- `_id` and `tripId` are ObjectIds in MongoDB; hex strings everywhere else.
- `startedAt`, `endedAt` and event `at` are BSON Dates in MongoDB; ISO strings everywhere else.

## Files
| File | Status |
|---|---|
| `collections.ts` | Done: names + indexes (2dsphere on `events.location`, unique `traces.tripId`) |
| `setup.ts` | Done: `npm run db:setup` creates collections + indexes (idempotent) |
| `client.ts` | Done: shared MongoClient |
| `MongoTripsRepo.ts` | Done: insertTrip (transaction), setCoaching, listTrips, getTrip, getTrace, getHistory, getProgress (trip summaries + harsh counts + per-street recurring spots → `gamification/buildProgress`), listGamificationTrips |
| `MongoTripsRepo.test.ts` | Live Atlas test, opt-in: `RUN_MONGO_TESTS=true npm test` (throwaway `<db>_test` database) |
| `mocks/InMemoryTripsRepo.ts` | Seeded with the fixture trip; progress computed with the same builder |

## Done means (master doc §14)
- [x] Saturday afternoon: Atlas cluster up, `npm run db:setup` run, `USE_REAL_DB=true` saves real trips.
- [ ] Recurring spots via 2dsphere across trips (§1 differentiator 3).
- [x] Progress: score trend, per-type totals, recurring spots, test readiness (road test readiness 100 from a full window), plus streaks and rank tier (`gamification/`).
