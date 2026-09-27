/**
 * Display copy for streaks, rank tiers and readiness. Pure, tested in
 * gamificationCopy.test.ts. The server computes every number (gamification.ts
 * in @edudriver/shared); this only turns them into words.
 */
import {
  GAMIFICATION,
  type ProgressUpdate,
  type RankTier,
  type StreakChange,
  type StreakKind,
  type UserProgress,
} from '@edudriver/shared';

export const TIER_NAME: Record<RankTier, string> = {
  rookie: 'Rookie',
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
  diamond: 'Diamond',
};

/** "Gold tier", or "Not ranked yet" for rookies. */
export function tierLine(tier: RankTier): string {
  return tier === 'rookie' ? 'Not ranked yet' : `${TIER_NAME[tier]} tier`;
}

/** Short name of each streak, for lists. */
export const STREAK_TITLE: Record<StreakKind, string> = {
  clean: 'Clean drives',
  phoneFree: 'Phone-free drives',
  hot: `Scores of ${GAMIFICATION.hotStreakMinScore}+`,
};

/** What keeps each streak going. */
export const STREAK_RULE: Record<StreakKind, string> = {
  clean: 'No harsh events',
  phoneFree: 'No phone use while moving',
  hot: `Score ${GAMIFICATION.hotStreakMinScore} or higher`,
};

/** "5 clean drives", "1 phone-free drive", "3 drives at 80+". */
export function streakText(kind: StreakKind, count: number): string {
  const drives = count === 1 ? 'drive' : 'drives';
  switch (kind) {
    case 'clean':
      return `${count} clean ${drives}`;
    case 'phoneFree':
      return `${count} phone-free ${drives}`;
    case 'hot':
      return `${count} ${drives} at ${GAMIFICATION.hotStreakMinScore}+`;
  }
}

/** Line under the tier progress bar: "4 points to Platinum". */
export function tierProgressText(p: UserProgress): string {
  if (p.tier === 'rookie') {
    return `${p.qualifyingTrips} of ${GAMIFICATION.rookieMinTrips} scored drives to get ranked`;
  }
  if (p.nextTier === null) return 'Top tier';
  const next = TIER_NAME[p.nextTier];
  if (p.pointsToNextTier === null) return `On the way to ${next}`;
  const points = Math.max(1, Math.ceil(p.pointsToNextTier));
  return `${points} ${points === 1 ? 'point' : 'points'} to ${next}`;
}

const STREAK_NOUN: Record<StreakKind, string> = {
  clean: 'clean',
  phoneFree: 'phone-free',
  hot: `${GAMIFICATION.hotStreakMinScore}+ score`,
};

/** Home header: "Gold tier, 3 clean drives in a row". */
export function homeLine(p: UserProgress): string {
  const clean = p.streaks.clean.current;
  if (clean > 0) return `${tierLine(p.tier)}, ${streakText('clean', clean)} in a row`;
  if (p.qualifyingTrips === 0) return 'Your first scored drive starts your streaks';
  return tierLine(p.tier);
}

/** Debrief line for one streak after a trip, or null when nothing changed. */
export function streakChangeText(kind: StreakKind, change: StreakChange): string | null {
  switch (change.change) {
    case 'extended':
      return change.newBest
        ? `New best: ${streakText(kind, change.current)} in a row`
        : `${streakText(kind, change.current)} in a row`;
    case 'broken':
      return `Your ${STREAK_NOUN[kind]} streak ended. Start a new one next drive.`;
    case 'none':
      return null;
  }
}

/** Debrief line for a tier change, or null when the tier stayed the same. */
export function tierChangeText(tier: ProgressUpdate['tier']): string | null {
  if (tier.change === 'up') return `You moved up to ${TIER_NAME[tier.after]}.`;
  if (tier.change === 'down') {
    return `You're ${TIER_NAME[tier.after]} for now. A few smooth drives will bring ${TIER_NAME[tier.before]} back.`;
  }
  return null;
}

/** "Road test ready: 64%, up 3". */
export function readinessChangeText(r: ProgressUpdate['readiness']): string {
  if (r.delta > 0) return `Road test ready: ${r.after}%, up ${r.delta}`;
  if (r.delta < 0) return `Road test ready: ${r.after}%, down ${-r.delta}`;
  return `Road test ready: ${r.after}%`;
}
