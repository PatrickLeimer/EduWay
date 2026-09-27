/**
 * CoachService: the boundary between routes (WS3) and coaching (WS4).
 * Master doc §10 (Gemini) and §11 (ElevenLabs).
 *
 * Routes never call Gemini or ElevenLabs directly. Changing this interface
 * affects both WS3 and WS4: agree on it first.
 */
import type { CoachOutput, DrivingEvent, Trip, TripSummary } from '@edudriver/shared';

export interface CoachResult {
  /** Null when Gemini failed; the trip is still saved and returned. */
  coach: CoachOutput | null;
  /** ElevenLabs debrief URL, or null when voice failed or there is no script. */
  audioUrl: string | null;
}

export interface CoachService {
  /** Gemini coaching JSON + ElevenLabs debrief audio for one trip. */
  coachTrip(summary: TripSummary, tripId: string): Promise<CoachResult>;
  /**
   * "Ask the coach" (stretch, §10). `context` is what routes pulled from the db
   * for this user; Gemini must answer only from it.
   */
  ask(question: string, context: { trips: Trip[]; events: DrivingEvent[] }): Promise<string>;
}
