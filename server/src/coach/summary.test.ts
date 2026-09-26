// Placeholder test: summary builder and mock coach honor the shared schemas.
// WS4: once buildTripSummary is real, assert it reproduces fixtures/trip-summary.json.
import { eventsFixture, tripFixture, tripSummaryFixture } from '@edudriver/fixtures';
import { CoachOutputSchema, TripSummarySchema } from '@edudriver/shared';
import { describe, expect, it } from 'vitest';

import { createMockCoachService } from './mocks';
import { buildSystemPrompt } from './prompt';
import { buildTripSummary } from './summary';

describe('coach', () => {
  it('builds a schema-valid summary', () => {
    const events = eventsFixture.map((e, i) => ({
      ...e,
      _id: String(i),
      tripId: 't',
      userId: 'u',
    }));
    const summary = buildTripSummary(tripFixture, events, tripSummaryFixture.history);
    expect(TripSummarySchema.safeParse(summary).success).toBe(true);
  });

  it('mock coach returns schema-valid coaching', async () => {
    const res = await createMockCoachService().coachTrip(tripSummaryFixture, 'trip-1');
    expect(CoachOutputSchema.safeParse(res.coach).success).toBe(true);
    expect(res.audioUrl).toContain('trip-1');
  });

  it('system prompt includes event thresholds', () => {
    expect(buildSystemPrompt()).toContain('hard_brake');
  });
});
