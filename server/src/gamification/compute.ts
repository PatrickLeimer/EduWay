/**
 * Streaks, rank tier and road test readiness (WS3). Pure: no database, no I/O.
 * Rules and numbers: packages/shared/src/gamification.ts (GAMIFICATION).
 *
 * Rewards driving well and improving, never driving more: only qualifying
 * trips count (not passenger, at least GAMIFICATION.minQualifyingMi), and
 * nothing depends on miles, trip count beyond the rookie gate, or days.
 */
import {
  GAMIFICATION,
  RANKED_TIERS,
  STREAK_KINDS,
  type ProgressUpdate,
  type RankTier,
  type StreakChange,
  type StreakKind,
  type Streaks,
  type UserProgress,
} from '@eduway/shared';

/** What gamification needs to know about one trip. */
export interface GamificationTrip {
  id: string;
  /** Null for passenger trips (not scored). */
  score: number | null;
  /** ISO time the trip ended; trips are ordered by it. */
  completedAt: string;
  distanceMi: number;
  passenger: boolean;
  harshEvents: number;
  phoneUseEvents: number;
}

type ScoredTrip = GamificationTrip & { score: number };

export function isQualifying(t: GamificationTrip): t is ScoredTrip {
  return !t.passenger && t.distanceMi >= GAMIFICATION.minQualifyingMi && t.score != null;
}

/** Qualifying trips, oldest first. */
export function qualifyingTrips(trips: GamificationTrip[]): ScoredTrip[] {
  return trips
    .filter(isQualifying)
    .sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt));
}

const STREAK_RULE: Record<StreakKind, (t: ScoredTrip) => boolean> = {
  hot: (t) => t.score >= GAMIFICATION.hotStreakMinScore,
  clean: (t) => t.harshEvents === 0,
  phoneFree: (t) => t.phoneUseEvents === 0,
};

/** Current and best run for each streak over qualifying trips (oldest first). */
export function computeStreaks(qualifying: ScoredTrip[]): Streaks {
  const out = {} as Streaks;
  for (const kind of STREAK_KINDS) {
    let current = 0;
    let best = 0;
    for (const t of qualifying) {
      current = STREAK_RULE[kind](t) ? current + 1 : 0;
      best = Math.max(best, current);
    }
    out[kind] = { current, best };
  }
  return out;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const average = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** The ranked tier for a rolling average (ignores the rookie gate). */
export function tierForAverage(avg: number): (typeof RANKED_TIERS)[number] {
  let tier: (typeof RANKED_TIERS)[number] = 'bronze';
  for (const t of RANKED_TIERS) if (avg >= GAMIFICATION.tierMinScore[t]) tier = t;
  return tier;
}

type TierInfo = Pick<
  UserProgress,
  'tier' | 'rollingAverage' | 'nextTier' | 'tierProgress' | 'pointsToNextTier'
>;

export function computeTier(qualifying: ScoredTrip[]): TierInfo {
  if (qualifying.length === 0) {
    return {
      tier: 'rookie',
      rollingAverage: null,
      nextTier: null,
      tierProgress: 0,
      pointsToNextTier: null,
    };
  }
  const window = qualifying.slice(-GAMIFICATION.tierWindow);
  const avg = round1(average(window.map((t) => t.score)));
  const ranked = tierForAverage(avg);

  if (qualifying.length < GAMIFICATION.rookieMinTrips) {
    return {
      tier: 'rookie',
      rollingAverage: avg,
      nextTier: ranked,
      tierProgress: qualifying.length / GAMIFICATION.rookieMinTrips,
      pointsToNextTier: null,
    };
  }

  const i = RANKED_TIERS.indexOf(ranked);
  const next = RANKED_TIERS[i + 1];
  if (!next) {
    return {
      tier: ranked,
      rollingAverage: avg,
      nextTier: null,
      tierProgress: 1,
      pointsToNextTier: null,
    };
  }
  const floor = GAMIFICATION.tierMinScore[ranked];
  const ceiling = GAMIFICATION.tierMinScore[next];
  return {
    tier: ranked,
    rollingAverage: avg,
    nextTier: next,
    tierProgress: Math.min(1, Math.max(0, round1(((avg - floor) / (ceiling - floor)) * 100) / 100)),
    pointsToNextTier: round1(ceiling - avg),
  };
}

/**
 * Average score of the last readinessWindow qualifying trips, capped at
 * readinessCap unless all of them are perfect (score ≥ readinessPerfectMinScore
 * and zero harsh events), which gives 100. Provisional with fewer trips.
 */
export function computeReadiness(
  qualifying: ScoredTrip[],
): Pick<UserProgress, 'readiness' | 'readinessProvisional'> {
  const window = qualifying.slice(-GAMIFICATION.readinessWindow);
  const provisional = window.length < GAMIFICATION.readinessWindow;
  if (window.length === 0) return { readiness: 0, readinessProvisional: true };
  const perfect =
    !provisional &&
    window.every((t) => t.score >= GAMIFICATION.readinessPerfectMinScore && t.harshEvents === 0);
  const avg = average(window.map((t) => t.score));
  return {
    readiness: perfect ? 100 : Math.round(Math.min(avg, GAMIFICATION.readinessCap)),
    readinessProvisional: provisional,
  };
}

export function computeUserProgress(trips: GamificationTrip[]): UserProgress {
  const qualifying = qualifyingTrips(trips);
  return {
    streaks: computeStreaks(qualifying),
    ...computeTier(qualifying),
    ...computeReadiness(qualifying),
    qualifyingTrips: qualifying.length,
  };
}

const tierRank = (t: RankTier) => (t === 'rookie' ? -1 : RANKED_TIERS.indexOf(t));

/**
 * What `latest` changed, given every trip before it. Non-qualifying trips
 * (passenger, too short) change nothing.
 */
export function computeProgressUpdate(
  before: GamificationTrip[],
  latest: GamificationTrip,
): ProgressUpdate {
  const prev = computeUserProgress(before);
  const next = isQualifying(latest) ? computeUserProgress([...before, latest]) : prev;

  const streak = (kind: StreakKind): StreakChange => {
    const a = prev.streaks[kind];
    const b = next.streaks[kind];
    return {
      change:
        b.current > a.current ? 'extended' : a.current > 0 && b.current === 0 ? 'broken' : 'none',
      newBest: b.best > a.best,
      current: b.current,
    };
  };
  const dt = tierRank(next.tier) - tierRank(prev.tier);

  return {
    qualifying: isQualifying(latest),
    streaks: { hot: streak('hot'), clean: streak('clean'), phoneFree: streak('phoneFree') },
    tier: { before: prev.tier, after: next.tier, change: dt > 0 ? 'up' : dt < 0 ? 'down' : 'same' },
    readiness: {
      before: prev.readiness,
      after: next.readiness,
      delta: next.readiness - prev.readiness,
    },
  };
}
