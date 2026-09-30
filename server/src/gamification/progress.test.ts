import { GetProgressResponseSchema, type TripCounts } from '@eduway/shared';
import { describe, expect, it } from 'vitest';

import { buildProgress, type ProgressTrip } from './progress';

const NO_EVENTS: TripCounts = {
  brake: 0,
  accel: 0,
  turn: 0,
  swerve: 0,
  speeding: 0,
  rollingStop: 0,
  phoneUse: 0,
};

function trip(day: number, over: Partial<ProgressTrip> = {}): ProgressTrip {
  const start = Date.UTC(2026, 8, day, 15);
  return {
    id: `trip-${day}`,
    startedAt: new Date(start).toISOString(),
    endedAt: new Date(start + 600_000).toISOString(),
    distanceMi: 5,
    passenger: false,
    score: 90,
    counts: NO_EVENTS,
    harshEvents: 0,
    ...over,
  };
}

describe('buildProgress', () => {
  const trips = [
    trip(3, { score: 70, counts: { ...NO_EVENTS, brake: 2, phoneUse: 1 }, harshEvents: 1 }),
    trip(1, { score: 60 }),
    trip(2, { passenger: true, score: null, counts: { ...NO_EVENTS, brake: 9 } }),
    trip(4, { distanceMi: 0.5, score: 100 }),
  ];
  const spot = {
    type: 'hard_brake' as const,
    street: 'SW 8th St',
    count: 2,
    location: { type: 'Point' as const, coordinates: [-80.37, 25.76] as [number, number] },
  };
  const p = buildProgress(trips, [spot]);

  it('matches the shared GET /progress contract', () => {
    expect(() => GetProgressResponseSchema.parse(p)).not.toThrow();
  });

  it('lists driven trips oldest first for the score trend', () => {
    expect(p.scores.map((s) => s.tripId)).toEqual(['trip-1', 'trip-3', 'trip-4']);
  });

  it('totals skills over driven trips only, per 10 miles driven', () => {
    // 2 brakes over 5 + 5 + 0.5 = 10.5 driven miles; the passenger trip's 9 don't count.
    expect(p.skills.hard_brake).toEqual({ count: 2, per10Mi: 1.9 });
    expect(p.skills.swerve).toEqual({ count: 0, per10Mi: 0 });
  });

  it('computes gamification from qualifying trips only', () => {
    expect(p.qualifyingTrips.map((t) => t.id)).toEqual(['trip-1', 'trip-3']);
    expect(p.userProgress.qualifyingTrips).toBe(2);
    expect(p.userProgress.tier).toBe('rookie');
    expect(p.userProgress.readiness).toBe(65);
    expect(p.userProgress.readinessProvisional).toBe(true);
    expect(p.recurringSpots).toEqual([spot]);
  });

  it('explains readiness and is not ready yet', () => {
    expect(p.testReadiness.ready).toBe(false);
    expect(p.testReadiness.notes[0]).toContain('65/100');
    expect(p.testReadiness.notes.some((n) => n.startsWith('Most frequent: hard brake'))).toBe(true);
  });

  it('is ready at readiness 100 from a full window', () => {
    const perfect = [1, 2, 3, 4, 5].map((d) => trip(d, { score: 95 }));
    const ready = buildProgress(perfect, []);
    expect(ready.userProgress.readiness).toBe(100);
    expect(ready.testReadiness.ready).toBe(true);
  });

  it('handles a new user with no trips', () => {
    const empty = buildProgress([], []);
    expect(GetProgressResponseSchema.parse(empty).userProgress.tier).toBe('rookie');
    expect(empty.scores).toEqual([]);
  });
});
