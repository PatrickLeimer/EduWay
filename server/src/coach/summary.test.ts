import { eventsFixture, tripFixture, tripSummaryFixture } from '@edudriver/fixtures';
import { CoachOutputSchema, TripSummarySchema, type DrivingEvent } from '@edudriver/shared';
import { describe, expect, it } from 'vitest';

import { createMockCoachService } from './mocks';
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

  it('adds the Street View event with its limit and recurring-spot flag (§12)', () => {
    const brake = events.find((e) => e.type === 'hard_brake' && e.tier === 'harsh')!;
    const summary = buildTripSummary(tripFixture, events, history, {
      event: brake,
      recurringSpot: true,
    });
    expect(summary.street_view_event).toEqual({
      type: 'hard_brake',
      tier: 'harsh',
      peak: 3.8,
      speed_mph: 9.4,
      street: 'SW 8th St',
      alerted: true,
      limit_mph: 40,
      recurring_spot: true,
    });
    expect(TripSummarySchema.safeParse(summary).success).toBe(true);
  });

  it('sets street_view_event to null when nothing qualified, and leaves it out when the picker did not run', () => {
    expect(buildTripSummary(tripFixture, events, history, null).street_view_event).toBeNull();
    expect(buildTripSummary(tripFixture, events, history)).not.toHaveProperty('street_view_event');
  });

  it('passes a null score through for passenger trips', () => {
    const summary = buildTripSummary({ ...tripFixture, score: null }, [], history);
    expect(summary.trip.score).toBeNull();
    expect(summary.events).toEqual([]);
  });
});

describe('coach', () => {
  it('mock coach only captions Street View when an event was picked', async () => {
    const mock = createMockCoachService();
    const without = await mock.coachTrip(tripSummaryFixture, 't');
    expect(without.coach?.street_view_caption).toBeNull();
    const withEvent = await mock.coachTrip(
      { ...tripSummaryFixture, street_view_event: { type: 'hard_brake', recurring_spot: true } },
      't',
    );
    expect(withEvent.coach?.street_view_caption).toBeTruthy();
  });

  it('mock coach returns schema-valid coaching', async () => {
    const res = await createMockCoachService().coachTrip(tripSummaryFixture, 'trip-1');
    expect(CoachOutputSchema.safeParse(res.coach).success).toBe(true);
    expect(res.audioUrl).toContain('trip-1');
  });
});
