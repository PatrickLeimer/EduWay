/** What the routes need. Built by src/wiring.ts (real or mock per module). */
import type { CoachService } from '../coach';
import type { TripsRepo } from '../db';
import type { ScoreTrip } from '../scoring';
import type { StreetViewService } from '../streetview';

export interface RouteDeps {
  repo: TripsRepo;
  scoreTrip: ScoreTrip;
  coach: CoachService;
  /** Street View (§12). Absent when GOOGLE_STREETVIEW_KEY is not set: the feature is simply off. */
  streetView?: StreetViewService;
}
