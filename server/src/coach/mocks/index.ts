/**
 * Mock CoachService (WS4): the fixture coaching JSON and a fake audio URL.
 * Like the real coach, the Street View caption is only there when an event was picked (§12).
 */
import { coachOutputFixture } from '@eduway/fixtures';

import type { CoachService } from '../types';

export function createMockCoachService(): CoachService {
  return {
    async coachTrip(summary, tripId) {
      return {
        coach: summary.street_view_event
          ? coachOutputFixture
          : { ...coachOutputFixture, street_view_caption: null },
        audioUrl: `https://example.invalid/audio/${encodeURIComponent(tripId)}.mp3`,
      };
    },
    async ask(question, context) {
      return `(mock coach) Based on ${context.trips.length} trips: you asked "${question}". Your stops are improving.`;
    },
  };
}
