/**
 * The badge list for the Driving growth screen (components/BadgeGrid.tsx).
 * Pure, tested in badges.test.ts.
 *
 * Every badge is a plain reading of UserProgress against a GAMIFICATION
 * constant, so no number here is invented: there are no per-skill badges
 * because UserProgress does not carry per-skill history, and inventing one
 * would mean inventing a threshold.
 */
import { GAMIFICATION, RANKED_TIERS, type RankTier, type UserProgress } from '@edudriver/shared';

import { STREAK_RULE, streakText, TIER_NAME } from './gamificationCopy';

export interface Badge {
  id: string;
  name: string;
  /** One line under the name: what you did, or what it takes. */
  hint: string;
  earned: boolean;
  /** 0 to 1 toward earning it; absent when there is nothing to count. */
  progress?: number;
}

/** A tier that can carry a badge (bronze is everything below silver, so it is not one). */
type BadgeTier = 'gold' | 'diamond';

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function tierIndex(tier: RankTier): number {
  return RANKED_TIERS.findIndex((t) => t === tier);
}

/** True once the rank is at or above `min`; rookies are below every tier. */
function tierReached(tier: RankTier, min: BadgeTier): boolean {
  const i = tierIndex(tier);
  return i >= 0 && i >= tierIndex(min);
}

function rankedBadge(p: UserProgress): Badge {
  const earned = p.tier !== 'rookie';
  return {
    id: 'ranked',
    name: 'Ranked',
    hint: earned
      ? `Ranked into ${TIER_NAME[p.tier]}`
      : `${p.qualifyingTrips} of ${GAMIFICATION.rookieMinTrips} scored drives`,
    earned,
    progress: clamp01(p.qualifyingTrips / GAMIFICATION.rookieMinTrips),
  };
}

function tierBadge(p: UserProgress, tier: BadgeTier): Badge {
  const min = GAMIFICATION.tierMinScore[tier];
  const earned = tierReached(p.tier, tier);
  return {
    id: `tier-${tier}`,
    name: `${TIER_NAME[tier]} tier`,
    hint: earned
      ? `Rolling average of ${min} or better`
      : `${min} average over your last ${GAMIFICATION.tierWindow} drives`,
    earned,
    progress: clamp01((p.rollingAverage ?? 0) / min),
  };
}

const STREAK_BADGE_NAME = {
  clean: 'Clean drive',
  phoneFree: 'Phone-free',
  hot: 'Hot streak',
} as const;

/** Earned by ever having done it once; the hint shows the best run. */
function streakBadge(p: UserProgress, kind: keyof typeof STREAK_BADGE_NAME): Badge {
  const best = p.streaks[kind].best;
  return {
    id: `streak-${kind}`,
    name: STREAK_BADGE_NAME[kind],
    hint: best >= 1 ? streakText(kind, best) : STREAK_RULE[kind],
    earned: best >= 1,
  };
}

function readinessBadge(p: UserProgress): Badge {
  const min = GAMIFICATION.readinessPerfectMinScore;
  const earned = !p.readinessProvisional && p.readiness >= min;
  let hint: string;
  if (earned) hint = `Readiness ${p.readiness}%`;
  else if (p.readinessProvisional) {
    hint = `${GAMIFICATION.readinessWindow} scored drives, then ${min}% readiness`;
  } else hint = `${min}% readiness`;
  return {
    id: 'readiness',
    name: 'Road test ready',
    hint,
    earned,
    progress: clamp01(p.readiness / min),
  };
}

/** Every badge, earned or locked, in the order the grid shows them. */
export function earnedBadges(p: UserProgress): Badge[] {
  return [
    rankedBadge(p),
    streakBadge(p, 'clean'),
    streakBadge(p, 'phoneFree'),
    streakBadge(p, 'hot'),
    tierBadge(p, 'gold'),
    readinessBadge(p),
    tierBadge(p, 'diamond'),
  ];
}
