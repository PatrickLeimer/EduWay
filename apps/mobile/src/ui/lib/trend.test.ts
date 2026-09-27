import type { QualifyingTrip } from '@edudriver/shared';
import { describe, expect, it } from 'vitest';

import { allTimeTier, buildTrend } from './trend';

/** Sunday Sep 27 2026, local time (the helpers use local calendar days). */
const NOW = new Date(2026, 8, 27, 12, 0);

function at(year: number, month: number, day: number): Date {
  return new Date(year, month, day, 12, 0);
}

let nextId = 0;
function trip(score: number, completed: Date): QualifyingTrip {
  return { id: `t${++nextId}`, score, completedAt: completed.toISOString() };
}

function daysBefore(days: number): Date {
  return new Date(NOW.getTime() - days * 86_400_000);
}

describe('allTimeTier', () => {
  it('is raw with no trips', () => {
    expect(allTimeTier([], NOW)).toBe('raw');
  });

  it('is raw for a single recent trip', () => {
    expect(allTimeTier([trip(70, daysBefore(1))], NOW)).toBe('raw');
  });

  it('is raw under two calendar months', () => {
    expect(allTimeTier([trip(70, at(2026, 7, 1))], NOW)).toBe('raw');
  });

  it('buckets by week at exactly two months', () => {
    expect(allTimeTier([trip(70, at(2026, 6, 27))], NOW)).toBe('weekly-buckets');
  });

  it('buckets by week between two months and two years', () => {
    expect(allTimeTier([trip(70, at(2026, 0, 10))], NOW)).toBe('weekly-buckets');
  });

  it('buckets by month at exactly two years', () => {
    expect(allTimeTier([trip(70, at(2024, 8, 27))], NOW)).toBe('monthly-buckets');
  });

  it('buckets by month over two years', () => {
    expect(allTimeTier([trip(70, at(2023, 5, 4))], NOW)).toBe('monthly-buckets');
  });

  it('measures from the earliest trip, not the latest', () => {
    const trips = [trip(70, daysBefore(2)), trip(70, at(2023, 5, 4))];
    expect(allTimeTier(trips, NOW)).toBe('monthly-buckets');
  });
});

describe('buildTrend', () => {
  it('has no points and no best when there are no trips', () => {
    for (const view of ['weekly', 'monthly', 'all-time'] as const) {
      expect(buildTrend([], view, NOW)).toEqual({ points: [], tier: 'raw', best: null });
    }
  });

  it('plots a single trip', () => {
    const t = buildTrend([trip(66, daysBefore(1))], 'weekly', NOW);
    expect(t.points).toEqual([{ label: 'Trip 1', value: 66, tripCount: 1, tooltip: 'Trip 1: 66' }]);
    expect(t.best).toEqual({ index: 0, value: 66 });
  });

  it('numbers raw points in time order and rounds scores', () => {
    const trips = [trip(70, daysBefore(1)), trip(65.6, daysBefore(5)), trip(58, daysBefore(3))];
    const t = buildTrend(trips, 'weekly', NOW);
    expect(t.points.map((p) => p.label)).toEqual(['Trip 1', 'Trip 2', 'Trip 3']);
    expect(t.points.map((p) => p.value)).toEqual([66, 58, 70]);
    expect(t.points[0]?.tooltip).toBe('Trip 1: 66');
    expect(t.best).toEqual({ index: 2, value: 70 });
  });

  it('keeps only the last 7 days on the weekly tab', () => {
    const trips = [trip(60, daysBefore(3)), trip(90, daysBefore(20))];
    expect(buildTrend(trips, 'weekly', NOW).points).toHaveLength(1);
    expect(buildTrend(trips, 'monthly', NOW).points).toHaveLength(2);
  });

  it('returns nothing when the window filters every trip out', () => {
    const trips = [trip(60, daysBefore(40)), trip(90, daysBefore(200))];
    const t = buildTrend(trips, 'weekly', NOW);
    expect(t.points).toEqual([]);
    expect(t.best).toBeNull();
    expect(buildTrend(trips, 'monthly', NOW).points).toEqual([]);
  });

  it('ignores the All-Time tier on the windowed tabs', () => {
    const trips = [trip(60, at(2023, 5, 4)), trip(80, daysBefore(2))];
    const t = buildTrend(trips, 'monthly', NOW);
    expect(t.tier).toBe('raw');
    expect(t.points.map((p) => p.label)).toEqual(['Trip 1']);
  });

  it('averages week buckets and labels them by their Monday', () => {
    const trips = [trip(70, at(2026, 6, 20)), trip(90, at(2026, 8, 14)), trip(92, at(2026, 8, 16))];
    const t = buildTrend(trips, 'all-time', NOW);
    expect(t.tier).toBe('weekly-buckets');
    expect(t.points).toHaveLength(2);
    expect(t.points[1]).toEqual({
      label: 'Wk of Sep 14',
      value: 91,
      tripCount: 2,
      tooltip: 'Week of Sep 14: 91 avg, 2 trips',
    });
    expect(t.points[0]?.tooltip).toBe('Week of Jul 20: 70 avg, 1 trip');
    expect(t.best).toEqual({ index: 1, value: 91 });
  });

  it('averages month buckets and keeps the year once the range spans one', () => {
    const trips = [trip(60, at(2023, 5, 4)), trip(70, at(2026, 8, 2)), trip(75, at(2026, 8, 20))];
    const t = buildTrend(trips, 'all-time', NOW);
    expect(t.tier).toBe('monthly-buckets');
    expect(t.points.map((p) => p.label)).toEqual(['Jun 2023', 'Sep 2026']);
    expect(t.points[1]).toEqual({
      label: 'Sep 2026',
      value: 73,
      tripCount: 2,
      tooltip: 'Sep 2026: 73 avg, 2 trips',
    });
  });

  it('gives the earliest point the best marker on a tie', () => {
    const trips = [trip(88, daysBefore(4)), trip(88, daysBefore(2)), trip(60, daysBefore(1))];
    expect(buildTrend(trips, 'weekly', NOW).best).toEqual({ index: 0, value: 88 });
  });
});
