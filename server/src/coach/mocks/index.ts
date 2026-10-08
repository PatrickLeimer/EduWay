/**
 * Mock CoachService (WS4): the fixture coaching JSON and a fake audio URL.
 * Like the real coach, the Street View caption is only there when an event was picked,
 * and the share caption only when there is history to improve on (§12).
 */
import { coachOutputFixture } from '@eduway/fixtures';

import { applySummaryRules } from '../gemini';
import type { CoachService } from '../types';

export function createMockCoachService(): CoachService {
  return {
    async coachTrip(summary, tripId) {
      return {
        coach: applySummaryRules(coachOutputFixture, summary),
        audioUrl: `https://example.invalid/audio/${encodeURIComponent(tripId)}.mp3`,
      };
    },
    async ask(question, context) {
      return `(mock coach) Based on ${context.trips.length} trips: you asked "${question}". Your stops are improving.`;
    },
  };
}
