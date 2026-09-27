/**
 * TripsRepo: the only way the rest of the server touches storage (WS3).
 * Master doc §9. Routes depend on this interface; wiring picks Mongo or in-memory.
 */
import type {
  CoachOutput,
  DrivingEvent,
  Progress,
  RecordedEvent,
  Trace,
  TraceUpload,
  Trip,
  TripListItem,
  TripSummary,
} from '@edudriver/shared';

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
   * History block of the Gemini summary (§10): last scores before this trip and
   * recurring spots from the 2dsphere index.
   */
  getHistory(userId: string, excludeTripId: string): Promise<TripSummary['history']>;
  getProgress(userId: string): Promise<Progress>;
}
