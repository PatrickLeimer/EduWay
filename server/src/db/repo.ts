/**
 * TripsRepo: the only way the rest of the server touches storage (WS3).
 * Master doc §9. Routes depend on this interface; wiring picks Mongo or in-memory.
 */
import type {
  CoachOutput,
  DrivingEvent,
  GetProgressResponse,
  RecordedEvent,
  Trace,
  TraceUpload,
  Trip,
  TripListItem,
  TripSummary,
} from '@edudriver/shared';

import type { GamificationTrip } from '../gamification';

export interface NewTripInput {
  /** Everything except the id and the coaching, which is added after Gemini runs. */
  trip: Omit<Trip, '_id' | 'coach' | 'coachAudioUrl'>;
  events: RecordedEvent[];
  trace: TraceUpload;
}

/**
 * The Street View callout as stored on the trip (§12): only our own data, which
 * event, the camera heading and Gemini's caption. Never the image.
 */
export interface StoredStreetView {
  eventId: string;
  heading: number;
  caption: string | null;
}

export interface TripsRepo {
  /** Insert trip, events and trace (one document per trip, §9). */
  insertTrip(input: NewTripInput): Promise<{ trip: Trip; events: DrivingEvent[] }>;
  setCoaching(tripId: string, coach: CoachOutput | null, audioUrl: string | null): Promise<void>;
  /** Save (or clear) the trip's Street View callout (§12). */
  setStreetView(tripId: string, streetView: StoredStreetView | null): Promise<void>;
  getStreetView(tripId: string): Promise<StoredStreetView | null>;
  /** Newest first. Never loads traces (§9). */
  listTrips(userId: string): Promise<TripListItem[]>;
  getTrip(tripId: string): Promise<{ trip: Trip; events: DrivingEvent[] } | null>;
  getTrace(tripId: string): Promise<Trace | null>;
  /**
   * History block of the Gemini summary (§10): last scores before this trip,
   * recurring spots from the 2dsphere index, and main_problem across every
   * saved trip including this one.
   */
  getHistory(userId: string, excludeTripId: string): Promise<TripSummary['history']>;
  /** GET /progress: trend, skills, spots, readiness and gamification. Never loads traces (§9). */
  getProgress(userId: string): Promise<GetProgressResponse>;
  /** Every trip of the user as gamification input (for POST /trips progressUpdate). */
  listGamificationTrips(userId: string): Promise<GamificationTrip[]>;
}
