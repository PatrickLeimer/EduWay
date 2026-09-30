/**
 * WS3 API client boundary. One method per endpoint in master doc §13.
 * PROTECTED CONTRACT (see root CLAUDE.md).
 *
 * Request/response types come from @eduway/shared so the server and the
 * client cannot disagree. Implementations must validate responses with the
 * shared zod schemas and throw ApiError on failure.
 */
import type {
  AskResponse,
  CreateTripRequest,
  CreateTripResponse,
  GetProgressResponse,
  GetTraceResponse,
  GetTripResponse,
  ListTripsResponse,
} from '@eduway/shared';

export interface ApiClient {
  /** POST /trips: upload events + trip fields + gzipped trace; returns coaching + audio URL. */
  createTrip(req: CreateTripRequest): Promise<CreateTripResponse>;
  /** GET /trips?userId= */
  listTrips(userId: string): Promise<ListTripsResponse>;
  /** GET /trips/:id */
  getTrip(tripId: string): Promise<GetTripResponse>;
  /**
   * POST /trips/:id/coach: re-run coaching (Gemini + ElevenLabs) for a trip saved
   * without it, e.g. when Gemini was busy. Returns the trip as GET /trips/:id does;
   * `trip.coach` is still null if it failed again.
   */
  retryCoaching(tripId: string): Promise<GetTripResponse>;
  /** GET /trips/:id/trace */
  getTrace(tripId: string): Promise<GetTraceResponse>;
  /** GET /progress?userId= */
  getProgress(userId: string): Promise<GetProgressResponse>;
  /** POST /ask (stretch, §10 "Ask the coach") */
  ask(userId: string, question: string): Promise<AskResponse>;
}

/** Thrown by every ApiClient method on network, HTTP, or validation failure. */
export class ApiError extends Error {
  constructor(
    message: string,
    /** HTTP status, or null for network / validation errors. */
    readonly status: number | null,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
