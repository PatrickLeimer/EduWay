import { fixtureEventsWithIds, traceFixture, tripSummaryFixture } from '@edudriver/fixtures';
import type { DrivingEvent } from '@edudriver/shared';
import { describe, expect, it } from 'vitest';

import { headingBefore, rankStreetViewCandidates, type PickTrace } from './pick';

const events = fixtureEventsWithIds('t', 'u');
const spots = tripSummaryFixture.history.recurring_spots; // hard_brake on SW 8th St
const ids = (list: DrivingEvent[]) => list.map((e) => Number(e._id.split('-evt-')[1]));

describe('rankStreetViewCandidates (§12)', () => {
  it('ranks the fixture drive: harsh, then recurring, then type priority', () => {
    // Harsh: 9 hard brake at the recurring spot, then speeding (5), rough turn (11), swerve (7).
    // Coach: 8 hard brake at the recurring spot, then rolling stop (1), rough turn (3), swerve (6).
    expect(ids(rankStreetViewCandidates(events, traceFixture, spots))).toEqual([
      9, 5, 11, 7, 8, 1, 3, 6,
    ]);
  });

  it('never picks phone use, hard acceleration, or speeding against an estimated limit', () => {
    const picked = rankStreetViewCandidates(events, traceFixture, spots);
    expect(picked.some((e) => e.type === 'phone_use' || e.type === 'hard_accel')).toBe(false);
    expect(picked.some((e) => e.type === 'speeding' && e.limitConfidence !== 'posted')).toBe(false);
  });

  it('puts a recurring spot ahead of a higher type priority', () => {
    // Without the recurring spot, harsh speeding (priority 2) beats harsh hard braking (priority 3).
    expect(ids(rankStreetViewCandidates(events, traceFixture, [])).slice(0, 2)).toEqual([5, 9]);
  });

  it('breaks ties on the same tier and type by higher peak', () => {
    const turn = events.find((e) => e.type === 'rough_turn' && e.tier === 'harsh')!;
    const mild = { ...turn, _id: 'mild', peak: 4.1 };
    const strong = { ...turn, _id: 'strong', peak: 5.5 };
    expect(rankStreetViewCandidates([mild, strong], traceFixture, []).map((e) => e._id)).toEqual([
      'strong',
      'mild',
    ]);
  });

  it('drops events whose GPS fix is worse than 20 m', () => {
    const brake = events[9]!;
    const at = (Date.parse(brake.at) - Date.parse(traceFixture.startedAt)) / 1000;
    const fuzzy: PickTrace = {
      ...traceFixture,
      accuracyM: traceFixture.t.map((t, i) =>
        Math.abs(t - at) <= 1.5 ? 35 : traceFixture.accuracyM[i]!,
      ),
    };
    expect(ids(rankStreetViewCandidates(events, fuzzy, spots))).not.toContain(9);
  });

  it('returns nothing when no event qualifies', () => {
    const onlyPhone = events.filter((e) => e.type === 'phone_use' || e.type === 'hard_accel');
    expect(rankStreetViewCandidates(onlyPhone, traceFixture, spots)).toEqual([]);
  });
});

describe('headingBefore (§12)', () => {
  const start = '2026-09-26T15:00:00.000Z';
  const eventAt = (s: number, lon = 0, lat = 0): DrivingEvent => ({
    ...events[9]!,
    at: new Date(Date.parse(start) + s * 1000).toISOString(),
    location: { type: 'Point', coordinates: [lon, lat] },
  });
  const trace = (headings: (number | null)[], lats?: number[], lons?: number[]): PickTrace => ({
    startedAt: start,
    t: headings.map((_, i) => i),
    lat: lats ?? headings.map(() => 0),
    lon: lons ?? headings.map(() => 0),
    heading: headings,
    accuracyM: headings.map(() => 5),
  });

  it('faces the driving direction 3 s before the event, not after a turn', () => {
    // Heading 10 on approach, 100 after turning at t = 10.
    const headings = [10, 10, 10, 10, 10, 10, 10, 10, 100, 100, 100];
    expect(headingBefore(trace(headings), eventAt(10))).toBe(10);
  });

  it('falls back to the heading at the event when the trace has a gap', () => {
    const headings = [10, 10, 10, 10, null, null, null, null, null, null, 200];
    expect(headingBefore(trace(headings), eventAt(10))).toBe(200);
  });

  it('falls back to the bearing on approach when there are no headings', () => {
    const none = Array.from({ length: 11 }, () => null);
    // Driving north: latitude rising, longitude fixed.
    const lats = none.map((_, i) => i * 0.0001);
    expect(headingBefore(trace(none, lats), eventAt(10, 0, 0.001))).toBeCloseTo(0, 0);
  });

  it('uses the fixture trace heading (east on SW 8th St)', () => {
    expect(headingBefore(traceFixture, events[9]!)).toBe(90);
  });
});
