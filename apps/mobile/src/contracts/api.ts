/**
 * WS3 API client boundary. One method per endpoint in master doc §13.
 * PROTECTED CONTRACT (see root CLAUDE.md).
 *
 * Request/response types come from @edudriver/shared so the server and the
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
} from '@edudriver/shared';

export interface ApiClient {
  /** POST /trips: upload events + trip fields + gzipped trace; returns coaching + audio URL. */
  createTrip(req: CreateTripRequest): Promise<CreateTripResponse>;
  /** GET /trips?userId= */
  listTrips(userId: string): Promise<ListTripsResponse>;
  /** GET /trips/:id */
  getTrip(tripId: string): Promise<GetTripResponse>;
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
