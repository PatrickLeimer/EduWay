import { GAMIFICATION, type UserProgress } from '@eduway/shared';
import { describe, expect, it } from 'vitest';

import { earnedBadges, type Badge } from './badges';

const rookie: UserProgress = {
  streaks: {
    hot: { current: 0, best: 0 },
    clean: { current: 0, best: 0 },
    phoneFree: { current: 0, best: 0 },
  },
  tier: 'rookie',
  rollingAverage: null,
  nextTier: null,
  tierProgress: 0,
  pointsToNextTier: null,
  readiness: 0,
  readinessProvisional: true,
  qualifyingTrips: 0,
};

function byId(p: UserProgress, id: string): Badge {
  const badge = earnedBadges(p).find((b) => b.id === id);
  if (!badge) throw new Error(`no badge ${id}`);
  return badge;
}

describe('earnedBadges', () => {
  it('locks everything for a brand new driver', () => {
    const badges = earnedBadges(rookie);
    expect(badges.every((b) => !b.earned)).toBe(true);
    expect(badges.map((b) => b.id)).toEqual([
      'ranked',
      'streak-clean',
      'streak-phoneFree',
      'streak-hot',
      'tier-gold',
      'readiness',
      'tier-diamond',
    ]);
  });

  it('counts scored drives toward getting ranked', () => {
    const locked = byId({ ...rookie, qualifyingTrips: 2 }, 'ranked');
    expect(locked.earned).toBe(false);
    expect(locked.hint).toBe(`2 of ${GAMIFICATION.rookieMinTrips} scored drives`);
    expect(locked.progress).toBeCloseTo(2 / GAMIFICATION.rookieMinTrips);

    const earned = byId({ ...rookie, tier: 'bronze', qualifyingTrips: 4 }, 'ranked');
    expect(earned.earned).toBe(true);
    expect(earned.hint).toBe('Ranked into Bronze');
    expect(earned.progress).toBe(1);
  });

  it('earns a tier badge at or above that rank', () => {
    expect(byId({ ...rookie, tier: 'silver' }, 'tier-gold').earned).toBe(false);
    expect(byId({ ...rookie, tier: 'gold' }, 'tier-gold').earned).toBe(true);
    expect(byId({ ...rookie, tier: 'platinum' }, 'tier-gold').earned).toBe(true);
    expect(byId({ ...rookie, tier: 'platinum' }, 'tier-diamond').earned).toBe(false);
    expect(byId({ ...rookie, tier: 'diamond' }, 'tier-diamond').earned).toBe(true);
  });

  it('measures tier progress against the tier minimum', () => {
    const p = { ...rookie, tier: 'silver' as const, rollingAverage: 60 };
    const gold = byId(p, 'tier-gold');
    expect(gold.hint).toBe(
      `${GAMIFICATION.tierMinScore.gold} average over your last ${GAMIFICATION.tierWindow} drives`,
    );
    expect(gold.progress).toBeCloseTo(60 / GAMIFICATION.tierMinScore.gold);
    expect(byId({ ...p, tier: 'gold', rollingAverage: 80 }, 'tier-gold').hint).toBe(
      `Rolling average of ${GAMIFICATION.tierMinScore.gold} or better`,
    );
  });

  it('shows the streak rule while locked and the best run once earned', () => {
    const locked = byId(rookie, 'streak-hot');
    expect(locked.hint).toBe(`Score ${GAMIFICATION.hotStreakMinScore} or higher`);
    expect(locked.progress).toBeUndefined();

    const p = {
      ...rookie,
      streaks: { ...rookie.streaks, hot: { current: 0, best: 3 }, clean: { current: 1, best: 1 } },
    };
    expect(byId(p, 'streak-hot')).toMatchObject({
      earned: true,
      hint: `3 drives at ${GAMIFICATION.hotStreakMinScore}+`,
    });
    expect(byId(p, 'streak-clean')).toMatchObject({ earned: true, hint: '1 clean drive' });
    expect(byId(p, 'streak-phoneFree').earned).toBe(false);
  });

  it('only earns road test ready once readiness is final and high enough', () => {
    const min = GAMIFICATION.readinessPerfectMinScore;
    const provisional = byId(
      { ...rookie, readiness: min, readinessProvisional: true },
      'readiness',
    );
    expect(provisional.earned).toBe(false);
    expect(provisional.hint).toBe(
      `${GAMIFICATION.readinessWindow} scored drives, then ${min}% readiness`,
    );

    const short = byId({ ...rookie, readiness: min - 1, readinessProvisional: false }, 'readiness');
    expect(short.earned).toBe(false);
    expect(short.hint).toBe(`${min}% readiness`);
    expect(short.progress).toBeCloseTo((min - 1) / min);

    const done = byId({ ...rookie, readiness: min, readinessProvisional: false }, 'readiness');
    expect(done).toMatchObject({ earned: true, hint: `Readiness ${min}%`, progress: 1 });
  });
});
