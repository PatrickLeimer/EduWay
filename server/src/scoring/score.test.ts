import { eventsFixture, traceFixture, tripFixture } from '@edudriver/fixtures';
import { SCORING, TripCountsSchema, TripStatsSchema, type RecordedEvent } from '@edudriver/shared';
import { describe, expect, it } from 'vitest';

import { mockScoreTrip } from './mocks';
import { scoreTrip } from './score';

describe('scoreTrip', () => {
  const input = {
    events: eventsFixture,
    distanceMi: tripFixture.distanceMi,
    passenger: false,
    trace: traceFixture,
  };

  const event = (over: Partial<RecordedEvent>): RecordedEvent => ({
    ...eventsFixture[0]!,
    ...over,
  });

  it('returns schema-valid counts and stats', () => {
    for (const fn of [scoreTrip, mockScoreTrip]) {
      const r = fn(input);
      expect(TripCountsSchema.safeParse(r.counts).success).toBe(true);
      expect(TripStatsSchema.safeParse(r.stats).success).toBe(true);
    }
  });

  it('does not score passenger trips (§4)', () => {
    expect(scoreTrip({ ...input, passenger: true }).score).toBeNull();
    expect(mockScoreTrip({ ...input, passenger: true }).score).toBeNull();
  });

  it('reproduces the fixture trip counts and stats', () => {
    const r = scoreTrip(input);
    expect(r.counts).toEqual(tripFixture.counts);
    expect(r.stats).toEqual(tripFixture.stats);
  });

  it('scores a clean trip at 100', () => {
    const r = scoreTrip({ ...input, events: [], distanceMi: 10 });
    expect(r.score).toBe(SCORING.base);
    expect(r.stats).toEqual({ eventsPer10Mi: 0, pctTimeSpeeding: 0, phoneUseSeconds: 0 });
  });

  it('subtracts penalties per 10 miles', () => {
    // 2 harsh brakes over 10 mi: 100 − 2 × 6 = 88.
    const events = [
      event({ type: 'hard_brake', tier: 'harsh' }),
      event({ type: 'hard_brake', tier: 'harsh' }),
    ];
    expect(scoreTrip({ ...input, events, distanceMi: 10 }).score).toBe(88);
    // Same events over 20 mi count half as much.
    expect(scoreTrip({ ...input, events, distanceMi: 20 }).score).toBe(94);
  });

  it('weighs harsh tier over coach tier', () => {
    const coach = scoreTrip({
      ...input,
      events: [event({ type: 'swerve', tier: 'coach' })],
      distanceMi: 10,
    });
    const harsh = scoreTrip({
      ...input,
      events: [event({ type: 'swerve', tier: 'harsh' })],
      distanceMi: 10,
    });
    expect(harsh.score!).toBeLessThan(coach.score!);
  });

  it('makes phone use the heaviest penalty', () => {
    const phone = scoreTrip({
      ...input,
      events: [event({ type: 'phone_use', tier: 'coach', durationS: 4 })],
      distanceMi: 10,
    });
    for (const type of [
      'hard_brake',
      'hard_accel',
      'rough_turn',
      'swerve',
      'speeding',
      'rolling_stop',
    ] as const) {
      const other = scoreTrip({
        ...input,
        events: [event({ type, tier: 'harsh' })],
        distanceMi: 10,
      });
      expect(phone.score!).toBeLessThan(other.score!);
    }
    expect(phone.stats.phoneUseSeconds).toBe(4);
  });

  it('normalizes short trips as if they were minNormalizeMi long', () => {
    const events = [event({ type: 'hard_brake', tier: 'harsh' })];
    const tiny = scoreTrip({ ...input, events, distanceMi: 0.2 });
    const floor = scoreTrip({ ...input, events, distanceMi: SCORING.minNormalizeMi });
    expect(tiny.score).toBe(floor.score);
    // Stats still use the real distance.
    expect(tiny.stats.eventsPer10Mi).toBe(50);
  });

  it('clamps the score at 0', () => {
    const events = Array.from({ length: 20 }, () => event({ type: 'phone_use', tier: 'harsh' }));
    expect(scoreTrip({ ...input, events, distanceMi: 1 }).score).toBe(0);
  });

  it('handles a zero-distance trip with no trace', () => {
    const r = scoreTrip({
      ...input,
      events: [event({ type: 'speeding', tier: 'coach', durationS: 5 })],
      distanceMi: 0,
      trace: { ...traceFixture, t: [], lat: [], lon: [], speedMps: [], heading: [], accuracyM: [] },
    });
    expect(r.stats.eventsPer10Mi).toBe(0);
    expect(r.stats.pctTimeSpeeding).toBe(0);
    expect(r.score).not.toBeNull();
  });
});
