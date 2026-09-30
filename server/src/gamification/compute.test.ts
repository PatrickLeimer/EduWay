import { GAMIFICATION } from '@eduway/shared';
import { describe, expect, it } from 'vitest';

import {
  computeProgressUpdate,
  computeReadiness,
  computeStreaks,
  computeTier,
  computeUserProgress,
  qualifyingTrips,
  type GamificationTrip,
} from './compute';

let seq = 0;
/** A qualifying trip by default; override what the case needs. Each one ends a day later. */
function trip(over: Partial<GamificationTrip> = {}): GamificationTrip {
  seq += 1;
  return {
    id: `t${seq}`,
    score: 80,
    completedAt: new Date(Date.UTC(2026, 8, 1) + seq * 86_400_000).toISOString(),
    distanceMi: 3,
    passenger: false,
    harshEvents: 0,
    phoneUseEvents: 0,
    ...over,
  };
}
const scored = (...scores: number[]) => scores.map((score) => trip({ score }));
const q = (trips: GamificationTrip[]) => qualifyingTrips(trips);

describe('qualifying trips', () => {
  it('ignores passenger trips and trips under 1 mile', () => {
    const trips = [
      trip({ passenger: true, score: null }),
      trip({ distanceMi: GAMIFICATION.minQualifyingMi - 0.01 }),
      trip({ distanceMi: GAMIFICATION.minQualifyingMi }),
    ];
    expect(q(trips).map((t) => t.distanceMi)).toEqual([GAMIFICATION.minQualifyingMi]);
    expect(computeUserProgress(trips).qualifyingTrips).toBe(1);
  });

  it('orders by completion time regardless of input order', () => {
    const [a, b] = [trip(), trip()];
    expect(q([b!, a!]).map((t) => t.id)).toEqual([a!.id, b!.id]);
  });
});

describe('rank tier', () => {
  it('is rookie with no qualifying trips', () => {
    expect(computeTier([])).toEqual({
      tier: 'rookie',
      rollingAverage: null,
      nextTier: null,
      tierProgress: 0,
      pointsToNextTier: null,
    });
  });

  it('is rookie under 3 qualifying trips, showing the tier they would rank into', () => {
    const t = computeTier(q(scored(90, 95)));
    expect(t.tier).toBe('rookie');
    expect(t.nextTier).toBe('platinum');
    expect(t.tierProgress).toBeCloseTo(2 / 3);
    expect(t.pointsToNextTier).toBeNull();
  });

  it.each([
    [59.9, 'bronze'],
    [60, 'silver'],
    [74.9, 'silver'],
    [75, 'gold'],
    [84.9, 'gold'],
    [85, 'platinum'],
    [92.9, 'platinum'],
    [93, 'diamond'],
  ])('average %s → %s', (avg, tier) => {
    // Three trips with exactly this average.
    expect(computeTier(q(scored(avg, avg, avg))).tier).toBe(tier);
  });

  it('uses only the last 10 qualifying trips', () => {
    const t = computeTier(q([...scored(0, 0, 0, 0, 0), ...scored(...Array(10).fill(95))]));
    expect(t.rollingAverage).toBe(95);
    expect(t.tier).toBe('diamond');
  });

  it('reports progress and points to the next tier', () => {
    const t = computeTier(q(scored(66, 66, 66))); // silver: 60 → gold at 75
    expect(t).toMatchObject({ tier: 'silver', nextTier: 'gold', pointsToNextTier: 9 });
    expect(t.tierProgress).toBeCloseTo(0.4);
  });

  it('is complete at Diamond', () => {
    expect(computeTier(q(scored(99, 99, 99)))).toMatchObject({
      tier: 'diamond',
      nextTier: null,
      tierProgress: 1,
      pointsToNextTier: null,
    });
  });
});

describe('streaks', () => {
  it('counts consecutive trips, breaks on a failing trip and keeps the best', () => {
    const s = computeStreaks(q(scored(85, 90, 95, 70, 88)));
    expect(s.hot).toEqual({ current: 1, best: 3 });
  });

  it('tracks clean and phone-free streaks separately', () => {
    const trips = [
      trip({ harshEvents: 0, phoneUseEvents: 1 }),
      trip({ harshEvents: 0, phoneUseEvents: 0 }),
      trip({ harshEvents: 2, phoneUseEvents: 0 }),
    ];
    const s = computeStreaks(q(trips));
    expect(s.clean).toEqual({ current: 0, best: 2 });
    expect(s.phoneFree).toEqual({ current: 2, best: 2 });
  });

  it('is unaffected by non-qualifying trips in between', () => {
    const trips = [
      trip({ score: 90 }),
      trip({ passenger: true, score: null }),
      trip({ score: 90 }),
    ];
    expect(computeStreaks(q(trips)).hot).toEqual({ current: 2, best: 2 });
  });
});

describe('road test readiness', () => {
  it('averages the last 5 qualifying trips and caps at 95', () => {
    expect(computeReadiness(q(scored(50, 70, 80, 90, 100, 100)))).toEqual({
      readiness: 88,
      readinessProvisional: false,
    });
    expect(computeReadiness(q(scored(99, 99, 99, 99, 80)))).toEqual({
      readiness: 95,
      readinessProvisional: false,
    });
  });

  it('is 100 only when all 5 scored 90+ with no harsh events', () => {
    expect(computeReadiness(q(scored(90, 91, 95, 99, 100))).readiness).toBe(100);
    const oneHarsh = [...scored(95, 95, 95, 95), trip({ score: 95, harshEvents: 1 })];
    expect(computeReadiness(q(oneHarsh)).readiness).toBe(95);
  });

  it('is provisional with fewer than 5 trips, and never 100 then', () => {
    expect(computeReadiness(q(scored(100, 100)))).toEqual({
      readiness: 95,
      readinessProvisional: true,
    });
    expect(computeReadiness([])).toEqual({ readiness: 0, readinessProvisional: true });
  });
});

describe('computeProgressUpdate', () => {
  it('reports a broken streak', () => {
    const before = scored(85, 90);
    const u = computeProgressUpdate(before, trip({ score: 60 }));
    expect(u.qualifying).toBe(true);
    expect(u.streaks.hot).toEqual({ change: 'broken', newBest: false, current: 0 });
  });

  it('reports an extended streak with a new best', () => {
    const before = [trip({ score: 90 }), trip({ score: 50 }), trip({ score: 90 })];
    const u = computeProgressUpdate(before, trip({ score: 90 }));
    expect(u.streaks.hot).toEqual({ change: 'extended', newBest: true, current: 2 });
  });

  it('reports a tier change and the readiness delta', () => {
    const before = scored(74, 74, 74);
    const u = computeProgressUpdate(before, trip({ score: 100 }));
    expect(u.tier).toEqual({ before: 'silver', after: 'gold', change: 'up' });
    expect(u.readiness).toEqual({ before: 74, after: 81, delta: 7 });
  });

  it('counts leaving rookie as a tier-up', () => {
    const u = computeProgressUpdate(scored(80, 80), trip({ score: 80 }));
    expect(u.tier).toEqual({ before: 'rookie', after: 'gold', change: 'up' });
  });

  it('changes nothing for a passenger or short trip', () => {
    const before = scored(90, 90, 90);
    for (const latest of [
      trip({ passenger: true, score: null }),
      trip({ distanceMi: 0.4, score: 20 }),
    ]) {
      const u = computeProgressUpdate(before, latest);
      expect(u.qualifying).toBe(false);
      expect(u.tier.change).toBe('same');
      expect(u.readiness.delta).toBe(0);
      expect(Object.values(u.streaks).every((s) => s.change === 'none' && !s.newBest)).toBe(true);
    }
  });
});
