/** What the routes need. Built by src/wiring.ts (real or mock per module). */
import type { CoachService } from '../coach';
import type { TripsRepo } from '../db';
import type { ScoreTrip } from '../scoring';

export interface RouteDeps {
  repo: TripsRepo;
  scoreTrip: ScoreTrip;
  coach: CoachService;
}
