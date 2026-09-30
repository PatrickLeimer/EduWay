# scoring/ — WS3 Trip score

**Owner:** WS3.

## What it does
Computes the trip score (0-100), per-type counts and stats in code (master doc §7 "Scoring"): start at 100, subtract weighted penalties per event normalized per 10 miles; harsh weighs more than coach; phone use heaviest. Gemini receives the score and explains it; it never computes it.

## Must not
- Do I/O. `scoreTrip` is a pure function tested with fixtures.
- Hard-code weights. Use `SCORING` in `@eduway/shared` (current values are placeholders; tune as a team).
- Score passenger trips (score is null, §4).

## Contracts
- Implements: `ScoreTrip` (`score.ts`).
- Consumes: `RecordedEvent`, `TraceUpload`, `TripCounts`, `TripStats`, `SCORING`, `COUNT_KEY_BY_EVENT`.

## Done means (master doc §14)
- [x] Saturday afternoon: real `scoreTrip` with Vitest cases (no events → 100, phone use dominates, short-trip normalization).
- [x] `pctTimeSpeeding` from speeding durations over trip time.
- [ ] `USE_REAL_SCORING=true` in the deployed server.
