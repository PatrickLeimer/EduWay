import type { UserProgress } from '@eduway/shared';
import { describe, expect, it } from 'vitest';

import {
  homeLine,
  readinessChangeText,
  streakChangeText,
  streakText,
  tierChangeText,
  tierLine,
  tierProgressText,
} from './gamificationCopy';

const base: UserProgress = {
  streaks: {
    hot: { current: 0, best: 0 },
    clean: { current: 0, best: 0 },
    phoneFree: { current: 0, best: 0 },
  },
  tier: 'gold',
  rollingAverage: 81,
  nextTier: 'platinum',
  tierProgress: 0.6,
  pointsToNextTier: 3.2,
  readiness: 70,
  readinessProvisional: false,
  qualifyingTrips: 8,
};

describe('streakText', () => {
  it('pluralizes', () => {
    expect(streakText('clean', 1)).toBe('1 clean drive');
    expect(streakText('clean', 5)).toBe('5 clean drives');
    expect(streakText('phoneFree', 2)).toBe('2 phone-free drives');
    expect(streakText('hot', 3)).toBe('3 drives at 80+');
  });
});

describe('tierLine', () => {
  it('names ranked tiers and rookies', () => {
    expect(tierLine('gold')).toBe('Gold tier');
    expect(tierLine('rookie')).toBe('Not ranked yet');
  });
});

describe('tierProgressText', () => {
  it('rounds points up to the next tier', () => {
    expect(tierProgressText(base)).toBe('4 points to Platinum');
    expect(tierProgressText({ ...base, pointsToNextTier: 0.4 })).toBe('1 point to Platinum');
  });

  it('handles rookies and the top tier', () => {
    expect(
      tierProgressText({ ...base, tier: 'rookie', pointsToNextTier: null, qualifyingTrips: 1 }),
    ).toBe('1 of 3 scored drives to get ranked');
    expect(
      tierProgressText({ ...base, tier: 'diamond', nextTier: null, pointsToNextTier: null }),
    ).toBe('Top tier');
  });
});

describe('debrief progress copy', () => {
  it('describes streak changes kindly', () => {
    expect(streakChangeText('clean', { change: 'extended', newBest: false, current: 3 })).toBe(
      '3 clean drives in a row',
    );
    expect(streakChangeText('clean', { change: 'extended', newBest: true, current: 7 })).toBe(
      'New best: 7 clean drives in a row',
    );
    expect(streakChangeText('phoneFree', { change: 'broken', newBest: false, current: 0 })).toBe(
      'Your phone-free streak ended. Start a new one next drive.',
    );
    expect(streakChangeText('hot', { change: 'none', newBest: false, current: 2 })).toBeNull();
  });

  it('describes tier and readiness changes', () => {
    expect(tierChangeText({ before: 'gold', after: 'platinum', change: 'up' })).toBe(
      'You moved up to Platinum.',
    );
    expect(tierChangeText({ before: 'gold', after: 'gold', change: 'same' })).toBeNull();
    expect(readinessChangeText({ before: 60, after: 63, delta: 3 })).toBe(
      'Road test ready: 63%, up 3',
    );
    expect(readinessChangeText({ before: 63, after: 62, delta: -1 })).toBe(
      'Road test ready: 62%, down 1',
    );
  });

  it('builds the home header line', () => {
    expect(
      homeLine({ ...base, streaks: { ...base.streaks, clean: { current: 3, best: 3 } } }),
    ).toBe('Gold tier, 3 clean drives in a row');
    expect(homeLine(base)).toBe('Gold tier');
    expect(homeLine({ ...base, tier: 'rookie', qualifyingTrips: 0 })).toBe(
      'Your first scored drive starts your streaks',
    );
  });
});
