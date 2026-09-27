/**
 * Gamification contracts: streaks, rank tiers and road test readiness.
 * PROTECTED CONTRACT (root CLAUDE.md). Approved by the team for the WS3
 * gamification task.
 *
 * A learning tool, like Duolingo, not a game. Everything rewards driving well
 * and improving, never driving more:
 * - No leaderboards, no comparison with other users.
 * - Nothing based on miles, trip count, time driving or days in a row.
 * - Passenger trips and trips under GAMIFICATION.minQualifyingMi never count.
 *
 * The server computes all of this (server/src/gamification); the app only
 * displays it. Numbers below are team-tunable.
 */
import { z } from 'zod';

export const GAMIFICATION = {
  /** Trips shorter than this never count (nor do passenger trips). */
  minQualifyingMi: 1,
  /** Hot streak: a trip continues it with a score at or above this. */
  hotStreakMinScore: 80,
  /** Rank tier = rolling average of the last N qualifying trips. */
  tierWindow: 10,
  /** Fewer qualifying trips than this = rookie (not ranked yet). */
  rookieMinTrips: 3,
  /** Lowest rolling average for each tier, ascending. Bronze is everything below Silver. */
  tierMinScore: { bronze: 0, silver: 60, gold: 75, platinum: 85, diamond: 93 },
  /** Road test readiness = average score of the last N qualifying trips. */
  readinessWindow: 5,
  /** Readiness is capped here unless every trip in the window is perfect (below). */
  readinessCap: 95,
  /** A "perfect" readiness trip: at least this score and zero harsh-tier events. */
  readinessPerfectMinScore: 90,
} as const;

export const StreakKindSchema = z.enum(['hot', 'clean', 'phoneFree']);
export type StreakKind = z.infer<typeof StreakKindSchema>;
export const STREAK_KINDS = StreakKindSchema.options;

export const RankTierSchema = z.enum(['rookie', 'bronze', 'silver', 'gold', 'platinum', 'diamond']);
export type RankTier = z.infer<typeof RankTierSchema>;
/** Ranked tiers in ascending order (rookie is "not ranked yet"). */
export const RANKED_TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond'] as const;

export const StreakSchema = z.object({
  /** Consecutive qualifying trips that met the rule, up to the latest one. */
  current: z.number().int().nonnegative(),
  best: z.number().int().nonnegative(),
});
export type Streak = z.infer<typeof StreakSchema>;

export const StreaksSchema = z.object({
  /** Score ≥ hotStreakMinScore. */
  hot: StreakSchema,
  /** Zero harsh-tier events. */
  clean: StreakSchema,
  /** Zero phone use events. */
  phoneFree: StreakSchema,
});
export type Streaks = z.infer<typeof StreaksSchema>;

export const UserProgressSchema = z.object({
  streaks: StreaksSchema,
  tier: RankTierSchema,
  /** Rolling average of the last tierWindow qualifying trips; null with no qualifying trips. */
  rollingAverage: z.number().min(0).max(100).nullable(),
  /** Next tier up; null at Diamond. For rookies, the tier they would rank into now. */
  nextTier: RankTierSchema.nullable(),
  /**
   * 0 to 1 toward the next tier. Ranked: position of the rolling average between
   * this tier's floor and the next tier's floor (1 at Diamond). Rookie: share of
   * the rookieMinTrips qualifying trips needed to get ranked.
   */
  tierProgress: z.number().min(0).max(1),
  /** Rolling-average points still needed for the next tier; null for rookies and at Diamond. */
  pointsToNextTier: z.number().nonnegative().nullable(),
  /** Road test readiness, 0 to 100. */
  readiness: z.number().int().min(0).max(100),
  /** True while there are fewer than readinessWindow qualifying trips. */
  readinessProvisional: z.boolean(),
  qualifyingTrips: z.number().int().nonnegative(),
});
export type UserProgress = z.infer<typeof UserProgressSchema>;

export const StreakChangeSchema = z.object({
  /** extended: this trip continued it; broken: it had a run and this trip ended it; none: no change. */
  change: z.enum(['extended', 'broken', 'none']),
  /** This trip set a new best. */
  newBest: z.boolean(),
  /** Count after this trip. */
  current: z.number().int().nonnegative(),
});
export type StreakChange = z.infer<typeof StreakChangeSchema>;

/** What the latest trip changed, so the debrief screen can celebrate. */
export const ProgressUpdateSchema = z.object({
  /** False for passenger / too-short trips: nothing below changed. */
  qualifying: z.boolean(),
  streaks: z.object({
    hot: StreakChangeSchema,
    clean: StreakChangeSchema,
    phoneFree: StreakChangeSchema,
  }),
  tier: z.object({
    before: RankTierSchema,
    after: RankTierSchema,
    change: z.enum(['up', 'down', 'same']),
  }),
  readiness: z.object({
    before: z.number().int().min(0).max(100),
    after: z.number().int().min(0).max(100),
    delta: z.number().int(),
  }),
});
export type ProgressUpdate = z.infer<typeof ProgressUpdateSchema>;

/** One point on the progress chart (the app does its own bucketing). */
export const QualifyingTripSchema = z.object({
  id: z.string(),
  score: z.number().min(0).max(100),
  completedAt: z.iso.datetime(),
});
export type QualifyingTrip = z.infer<typeof QualifyingTripSchema>;
