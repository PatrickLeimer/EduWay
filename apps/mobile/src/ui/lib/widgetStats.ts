/**
 * What the home-screen Drive widget shows (ui/widget/): the clean-drive streak
 * (the same one the app leads with, gamificationCopy.homeLine) and the last
 * score. The server computes both; this only picks and words them. Pure,
 * tested in widgetStats.test.ts.
 */
import type { GetProgressResponse } from '@eduway/shared';

export interface WidgetStats {
  /** Clean drives in a row (no harsh events). */
  streak: number;
  /** Line under the streak number. */
  streakLabel: string;
  /** "Last score 86", or a first-drive nudge. */
  lastLine: string;
}

/** Before the app has fetched progress once. */
export const EMPTY_WIDGET_STATS: WidgetStats = {
  streak: 0,
  streakLabel: 'Start a clean streak',
  lastLine: 'Tap to drive',
};

export function widgetStats(p: Pick<GetProgressResponse, 'scores' | 'userProgress'>): WidgetStats {
  const streak = p.userProgress.streaks.clean.current;
  let last: number | null = null;
  for (let i = p.scores.length - 1; i >= 0 && last === null; i--) last = p.scores[i]!.score;
  return {
    streak,
    streakLabel:
      streak === 0 ? 'Start a clean streak' : `clean ${streak === 1 ? 'drive' : 'drives'} in a row`,
    lastLine: last === null ? 'Tap to drive' : `Last score ${Math.round(last)}`,
  };
}

/** Reads stats saved by an earlier app run; null if missing or not the right shape. */
export function parseWidgetStats(json: string | null): WidgetStats | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json) as Partial<WidgetStats> | null;
    if (
      v &&
      typeof v.streak === 'number' &&
      typeof v.streakLabel === 'string' &&
      typeof v.lastLine === 'string'
    ) {
      return { streak: v.streak, streakLabel: v.streakLabel, lastLine: v.lastLine };
    }
  } catch {
    // Corrupt file: fall back to the empty tile.
  }
  return null;
}
