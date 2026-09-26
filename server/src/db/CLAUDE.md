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
- Consumes: domain types from `@edudriver/shared`; `COACH` thresholds for recurring spots.

## Files
| File | Status |
|---|---|
| `collections.ts` | Done: names + indexes (2dsphere on `events.location`, unique `traces.tripId`) |
| `setup.ts` | Done: `npm run db:setup` creates collections + indexes (idempotent) |
| `client.ts` | Done: shared MongoClient |
| `MongoTripsRepo.ts` | STUB |
| `mocks/InMemoryTripsRepo.ts` | Seeded with the fixture trip |

## Done means (master doc §14)
- [ ] Saturday afternoon: Atlas cluster up, `npm run db:setup` run, `USE_REAL_DB=true` saves real trips.
- [ ] Recurring spots via 2dsphere across trips (§1 differentiator 3).
- [ ] Progress: score trend, per-type totals, recurring spots, test readiness (rule TBD by team).
