/**
 * Upload-time Street View step (master doc §12): pick the event, check coverage,
 * compute the heading. Walks the ranked candidates and stops at the first with
 * imagery, trying at most STREET_VIEW.maxCandidates to limit API calls.
 */
import {
  STREET_VIEW,
  type DrivingEvent,
  type RecurringSpot,
  type StreetViewCallout,
} from '@eduway/shared';

import type { StoredStreetView } from '../db';

import { headingBefore, isRecurringSpot, rankStreetViewCandidates, type PickTrace } from './pick';

export interface StreetViewChoice {
  event: DrivingEvent;
  heading: number;
  recurringSpot: boolean;
}

export async function pickStreetView(
  events: DrivingEvent[],
  trace: PickTrace,
  spots: RecurringSpot[],
  hasCoverage: (lat: number, lng: number) => Promise<boolean>,
): Promise<StreetViewChoice | null> {
  const candidates = rankStreetViewCandidates(events, trace, spots).slice(
    0,
    STREET_VIEW.maxCandidates,
  );
  for (const event of candidates) {
    const [lng, lat] = event.location.coordinates;
    if (await hasCoverage(lat, lng)) {
      return {
        event,
        heading: headingBefore(trace, event),
        recurringSpot: isRecurringSpot(event, spots),
      };
    }
  }
  return null;
}

/** The debrief's callout from what we stored (§12): our own data plus our own URLs. */
export function toCallout(
  tripId: string,
  stored: StoredStreetView,
  events: DrivingEvent[],
): StreetViewCallout | null {
  const event = events.find((e) => e._id === stored.eventId);
  if (!event) return null;
  const [lng, lat] = event.location.coordinates;
  const base = `/streetview/${encodeURIComponent(tripId)}`;
  return {
    eventId: event._id,
    eventType: event.type,
    street: event.street,
    lat,
    lng,
    heading: stored.heading,
    caption: stored.caption,
    thumbnailUrl: `${base}/thumbnail`,
    panoramaUrl: `${base}/panorama`,
  };
}
