import { fixtureEventsWithIds, traceFixture, tripSummaryFixture } from '@eduway/fixtures';
import { STREET_VIEW } from '@eduway/shared';
import { describe, expect, it, vi } from 'vitest';

import { pickStreetView, toCallout } from './select';

const events = fixtureEventsWithIds('t', 'u');
const spots = tripSummaryFixture.history.recurring_spots;

describe('pickStreetView (§12)', () => {
  it('takes the best event that has imagery', async () => {
    const hasCoverage = vi.fn(async () => true);
    const choice = await pickStreetView(events, traceFixture, spots, hasCoverage);
    expect(choice?.event._id).toBe('t-evt-9');
    expect(choice?.heading).toBe(90);
    expect(choice?.recurringSpot).toBe(true);
    expect(hasCoverage).toHaveBeenCalledOnce();
    expect(hasCoverage).toHaveBeenCalledWith(25.7625, -80.354487);
  });

  it('falls back to the next candidate when coverage fails', async () => {
    const hasCoverage = vi.fn(async (_lat: number, lng: number) => lng !== -80.354487);
    const choice = await pickStreetView(events, traceFixture, spots, hasCoverage);
    expect(choice?.event._id).toBe('t-evt-5'); // harsh speeding, next in rank
    expect(choice?.recurringSpot).toBe(false);
  });

  it(`tries at most ${STREET_VIEW.maxCandidates} candidates, then gives up`, async () => {
    const hasCoverage = vi.fn(async () => false);
    expect(await pickStreetView(events, traceFixture, spots, hasCoverage)).toBeNull();
    expect(hasCoverage).toHaveBeenCalledTimes(STREET_VIEW.maxCandidates);
  });

  it('returns null without calling Google when nothing qualifies', async () => {
    const hasCoverage = vi.fn(async () => true);
    const phoneOnly = events.filter((e) => e.type === 'phone_use');
    expect(await pickStreetView(phoneOnly, traceFixture, spots, hasCoverage)).toBeNull();
    expect(hasCoverage).not.toHaveBeenCalled();
  });
});

describe('toCallout', () => {
  it('builds the callout from our stored data, with URLs to our backend', () => {
    const stored = { eventId: 't-evt-9', heading: 90, caption: 'Ease off early here.' };
    expect(toCallout('t', stored, events)).toEqual({
      eventId: 't-evt-9',
      eventType: 'hard_brake',
      street: 'SW 8th St',
      lat: 25.7625,
      lng: -80.354487,
      heading: 90,
      caption: 'Ease off early here.',
      thumbnailUrl: '/streetview/t/thumbnail',
      panoramaUrl: '/streetview/t/panorama',
    });
  });

  it('returns null when the event is gone', () => {
    expect(toCallout('t', { eventId: 'missing', heading: 0, caption: null }, events)).toBeNull();
  });
});
