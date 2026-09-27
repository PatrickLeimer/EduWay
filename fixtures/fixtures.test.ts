// Fixtures are parsed against the shared schemas on import (index.ts); these
// checks add the cross-file consistency the schemas can't express.
import { describe, expect, it } from 'vitest';

import {
  debriefWithoutStreetViewFixture,
  debriefWithStreetViewFixture,
  draftEventsFixture,
  eventsFixture,
  traceFixture,
  tripFixture,
  tripSummaryFixture,
} from './index';

describe('fixtures', () => {
  it('trace columns all have the same length', () => {
    const n = traceFixture.t.length;
    for (const col of [
      traceFixture.lat,
      traceFixture.lon,
      traceFixture.speedMps,
      traceFixture.heading,
      traceFixture.accuracyM,
    ]) {
      expect(col).toHaveLength(n);
    }
  });

  it('covers every event type and both tiers of the tiered ones', () => {
    const seen = new Set(eventsFixture.map((e) => `${e.type}:${e.tier}`));
    for (const type of ['hard_brake', 'hard_accel', 'rough_turn', 'swerve', 'speeding']) {
      expect(seen.has(`${type}:coach`)).toBe(true);
      expect(seen.has(`${type}:harsh`)).toBe(true);
    }
    expect(seen.has('rolling_stop:coach')).toBe(true);
    expect([...seen].some((s) => s.startsWith('phone_use:'))).toBe(true);
  });

  it('events fall inside the trace and the summary matches the events', () => {
    const duration = traceFixture.t.at(-1)!;
    for (const { offsetS } of draftEventsFixture) {
      expect(offsetS).toBeGreaterThanOrEqual(0);
      expect(offsetS).toBeLessThanOrEqual(duration);
    }
    expect(tripSummaryFixture.events).toHaveLength(eventsFixture.length);
    expect(tripFixture._id).toBe(traceFixture.tripId);
  });

  it('never marks a speeding alert against an inferred limit (§8)', () => {
    for (const e of eventsFixture) {
      if (e.type === 'speeding' && e.alerted) expect(e.limitConfidence).toBe('posted');
    }
  });

  it('points the Street View callout at a real event, with our backend URLs (§12)', () => {
    const { streetView, events, trip } = debriefWithStreetViewFixture;
    const event = events.find((e) => e._id === streetView?.eventId);
    expect(event).toBeDefined();
    expect(streetView?.eventType).toBe(event?.type);
    expect([streetView?.lng, streetView?.lat]).toEqual(event?.location.coordinates);
    expect(streetView?.street).toBe(event?.street);
    expect(streetView?.caption).toBe(trip.coach?.street_view_caption);
    for (const url of [streetView?.thumbnailUrl, streetView?.panoramaUrl]) {
      expect(url).toMatch(new RegExp(`^/streetview/${trip._id}/`));
      expect(url).not.toMatch(/google/i);
    }
  });

  it('has a debrief without a callout and without a caption', () => {
    expect(debriefWithoutStreetViewFixture.streetView).toBeNull();
    expect(debriefWithoutStreetViewFixture.trip.coach?.street_view_caption).toBeNull();
  });
});
