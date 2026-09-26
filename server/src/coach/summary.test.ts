import { eventsFixture, tripFixture, tripSummaryFixture } from '@edudriver/fixtures';
import { CoachOutputSchema, TripSummarySchema, type DrivingEvent } from '@edudriver/shared';
import { describe, expect, it } from 'vitest';

import { createMockCoachService } from './mocks';
import { buildSystemPrompt } from './prompt';
import { buildTripSummary } from './summary';

const events: DrivingEvent[] = eventsFixture.map((e, i) => ({
  ...e,
  _id: String(i),
  tripId: 't',
  userId: 'u',
}));
const history = tripSummaryFixture.history;

describe('buildTripSummary', () => {
  it('reproduces fixtures/trip-summary.json from the fixture trip', () => {
    const summary = buildTripSummary(tripFixture, events, history);
    expect(TripSummarySchema.safeParse(summary).success).toBe(true);
    expect(summary).toStrictEqual(tripSummaryFixture);
  });

  it('orders events by time', () => {
    const summary = buildTripSummary(tripFixture, [...events].reverse(), history);
    expect(summary.events).toStrictEqual(tripSummaryFixture.events);
  });

  it('rounds detector floats and omits a missing street', () => {
    const brake = { ...events.find((e) => e.type === 'hard_brake')!, peak: 3.8274, street: null };
    const [e] = buildTripSummary(tripFixture, [brake], history).events;
    expect(e!.peak).toBe(3.8);
    expect(e).not.toHaveProperty('street');
  });

  it('passes a null score through for passenger trips', () => {
    const summary = buildTripSummary({ ...tripFixture, score: null }, [], history);
    expect(summary.trip.score).toBeNull();
    expect(summary.events).toEqual([]);
  });
});

describe('coach', () => {
  it('mock coach returns schema-valid coaching', async () => {
    const res = await createMockCoachService().coachTrip(tripSummaryFixture, 'trip-1');
    expect(CoachOutputSchema.safeParse(res.coach).success).toBe(true);
    expect(res.audioUrl).toContain('trip-1');
  });

  it('system prompt includes event thresholds', () => {
    expect(buildSystemPrompt()).toContain('hard_brake');
  });
});
