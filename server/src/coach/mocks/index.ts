/**
 * Mock CoachService (WS4): the fixture coaching JSON and a fake audio URL.
 */
import { coachOutputFixture } from '@edudriver/fixtures';

import type { CoachService } from '../types';

export function createMockCoachService(): CoachService {
  return {
    async coachTrip(_summary, tripId) {
      return {
        coach: coachOutputFixture,
        audioUrl: `https://example.invalid/audio/${encodeURIComponent(tripId)}.mp3`,
      };
    },
    async ask(question, context) {
      return `(mock coach) Based on ${context.trips.length} trips: you asked "${question}". Your stops are improving.`;
    },
  };
}
