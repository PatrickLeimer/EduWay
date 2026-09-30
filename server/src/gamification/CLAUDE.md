# gamification/ — WS3 Streaks, rank tiers, road test readiness

**Owner:** WS3.

## What it does
Pure functions that turn stored trip summaries into:
- **Streaks** (current + best): hot (score ≥ 80), clean (no harsh events), phone-free (no phone use), over consecutive qualifying trips. A failing trip resets the current count.
- **Rank tier** from the rolling average of the last 10 qualifying trips (rookie under 3), with progress and points to the next tier.
- **Road test readiness** (0–100): average of the last 5 qualifying trips, capped at 95 unless all 5 are 90+ with no harsh events (then 100); provisional under 5.
- **Progress update** for POST /trips: what the latest trip changed.
- **GET /progress** response (`buildProgress`): score trend, skill totals, test readiness notes, the gamification block and the qualifying-trip list.

A learning tool, not a game: rewards driving well and improving, never driving more.

## Must not
- Do I/O. The repo gathers rows (never traces) and passes them in.
- Hard-code numbers. Use `GAMIFICATION` in `@eduway/shared`.
- Count passenger trips or trips under `GAMIFICATION.minQualifyingMi`.
- Add leaderboards, comparisons with other users, or anything based on miles, trip count, time driving or days in a row.

## Contracts
- Implements: `UserProgress`, `ProgressUpdate`, `GetProgressResponse` (`packages/shared/src/gamification.ts`, `api.ts`).
- Consumed by: `db/` (`getProgress`), `routes/trips.ts` (`progressUpdate`).

## Tests
`compute.test.ts`, `progress.test.ts`: rookie state, every tier boundary, streak break and new best, readiness cap and the 100 case, passenger and short trips ignored.
