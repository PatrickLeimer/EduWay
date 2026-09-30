/** What the routes need. Built by src/wiring.ts (real or mock per module). */
import type { CoachService } from '../coach';
import type { TripsRepo } from '../db';
import type { ScoreTrip } from '../scoring';
import type { StreetViewService } from '../streetview';
import type { DebriefAudioDeps } from './audio';

export interface RouteDeps {
  repo: TripsRepo;
  scoreTrip: ScoreTrip;
  coach: CoachService;
  /** Street View (§12). Absent when GOOGLE_STREETVIEW_KEY is not set: the feature is simply off. */
  streetView?: StreetViewService;
  /**
   * Debrief mp3s from MongoDB (routes/audio.ts). Absent = the old behavior:
   * files on the server's disk (DEBRIEF_AUDIO_IN_DB=false, or no real DB).
   */
  audio?: DebriefAudioDeps;
}
