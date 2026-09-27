/**
 * gamification/ public API (WS3): streaks, rank tier, road test readiness and
 * the GET /progress builder. Pure functions; callers bring the data.
 * Contract: packages/shared/src/gamification.ts.
 */
export {
  computeProgressUpdate,
  computeReadiness,
  computeStreaks,
  computeTier,
  computeUserProgress,
  isQualifying,
  qualifyingTrips,
  tierForAverage,
  type GamificationTrip,
} from './compute';
export {
  buildProgress,
  skillTotals,
  testReadiness,
  toGamificationTrip,
  type ProgressSpot,
  type ProgressTrip,
} from './progress';
