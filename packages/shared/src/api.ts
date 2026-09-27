/**
 * HTTP API contract between the mobile app (WS3 api client) and the server (WS3
 * routes). One request and one response schema per endpoint from master doc §13.
 *
 * PROTECTED CONTRACT (see root CLAUDE.md).
 *
 * Both sides validate with these schemas: the server parses every request body
 * and every response it sends; the client parses every response it receives.
 */
import { z } from 'zod';
import { ProgressUpdateSchema, QualifyingTripSchema, UserProgressSchema } from './gamification';
import {
  CoachOutputSchema,
  DrivingEventSchema,
  ProgressSchema,
  RecordedEventSchema,
  StreetViewCalloutSchema,
  TraceSchema,
  TripSchema,
} from './types';

/** Hackathon scope: no auth, just a simple user id (root CLAUDE.md "Out of scope"). */
export const DEMO_USER_ID = 'demo-user';

export const UserIdSchema = z.string().min(1);

/** Every non-2xx response has this body. */
export const ErrorResponseSchema = z.object({
  error: z.string(),
  details: z.unknown().optional(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// ---------------------------------------------------------------------------
// POST /trips: upload a finished trip, get coaching back (§3, §13)
// ---------------------------------------------------------------------------

/**
 * Trip fields the phone knows at trip end. Counts, stats, score and coaching
 * are computed on the server (§7 "Scoring", §10).
 */
export const TripUploadSchema = TripSchema.pick({
  startedAt: true,
  endedAt: true,
  distanceMi: true,
  passenger: true,
  lockEnabled: true,
});
export type TripUpload = z.infer<typeof TripUploadSchema>;

export const CreateTripRequestSchema = z.object({
  userId: UserIdSchema,
  trip: TripUploadSchema,
  events: z.array(RecordedEventSchema),
  /**
   * Base64 of the gzipped JSON of a TraceUpload (types.ts). Gzipped with `pako`
   * on the phone and inflated with `zlib` on the server (§9 "Route traces").
   */
  traceGzipB64: z.string(),
});
export type CreateTripRequest = z.infer<typeof CreateTripRequestSchema>;

export const CreateTripResponseSchema = z.object({
  trip: TripSchema,
  coach: CoachOutputSchema.nullable(),
  /** ElevenLabs debrief audio (§11). Null when passenger or voice failed. */
  coachAudioUrl: z.string().nullable(),
  /** One infraction to show in Street View (§12). Null when none qualifies or there is no imagery. */
  streetView: StreetViewCalloutSchema.nullable(),
  /**
   * What this trip changed in streaks, tier and readiness (gamification.ts).
   * The server always sends it; optional only so older clients and hand-built
   * test responses still type-check.
   */
  progressUpdate: ProgressUpdateSchema.optional(),
});
export type CreateTripResponse = z.infer<typeof CreateTripResponseSchema>;

// ---------------------------------------------------------------------------
// GET /trips?userId=: trip list (never includes the trace, §9)
// ---------------------------------------------------------------------------

export const ListTripsQuerySchema = z.object({ userId: UserIdSchema });
export type ListTripsQuery = z.infer<typeof ListTripsQuerySchema>;

export const TripListItemSchema = TripSchema.pick({
  _id: true,
  startedAt: true,
  endedAt: true,
  distanceMi: true,
  passenger: true,
  score: true,
  counts: true,
  routePreview: true,
});
export type TripListItem = z.infer<typeof TripListItemSchema>;

export const ListTripsResponseSchema = z.object({ trips: z.array(TripListItemSchema) });
export type ListTripsResponse = z.infer<typeof ListTripsResponseSchema>;

// ---------------------------------------------------------------------------
// GET /trips/:id: one trip with its events (debrief screen)
// ---------------------------------------------------------------------------

export const GetTripResponseSchema = z.object({
  trip: TripSchema,
  events: z.array(DrivingEventSchema),
  /** One infraction to show in Street View (§12). Null when none qualifies or there is no imagery. */
  streetView: StreetViewCalloutSchema.nullable(),
});
export type GetTripResponse = z.infer<typeof GetTripResponseSchema>;

// ---------------------------------------------------------------------------
// GET /trips/:id/trace: route trace for map + replay (§9 "Replay")
// ---------------------------------------------------------------------------

export const GetTraceResponseSchema = TraceSchema;
export type GetTraceResponse = z.infer<typeof GetTraceResponseSchema>;

// ---------------------------------------------------------------------------
// GET /progress?userId=: progress screen (§12 screen 5)
// ---------------------------------------------------------------------------

export const GetProgressQuerySchema = z.object({ userId: UserIdSchema });
export type GetProgressQuery = z.infer<typeof GetProgressQuerySchema>;

export const GetProgressResponseSchema = ProgressSchema.extend({
  /** Streaks, rank tier and road test readiness (gamification.ts). */
  userProgress: UserProgressSchema,
  /** Every qualifying trip, oldest first; the progress chart does its own bucketing. */
  qualifyingTrips: z.array(QualifyingTripSchema),
});
export type GetProgressResponse = z.infer<typeof GetProgressResponseSchema>;

// ---------------------------------------------------------------------------
// POST /ask: "Ask the coach" (stretch, §10)
// ---------------------------------------------------------------------------

export const AskRequestSchema = z.object({
  userId: UserIdSchema,
  question: z.string().min(1).max(500),
});
export type AskRequest = z.infer<typeof AskRequestSchema>;

export const AskResponseSchema = z.object({ answer: z.string() });
export type AskResponse = z.infer<typeof AskResponseSchema>;

// ---------------------------------------------------------------------------
// Route table: single place the client and server agree on paths.
// ---------------------------------------------------------------------------

export const API_ROUTES = {
  createTrip: '/trips',
  listTrips: '/trips',
  getTrip: (id: string) => `/trips/${encodeURIComponent(id)}`,
  getTrace: (id: string) => `/trips/${encodeURIComponent(id)}/trace`,
  /** Re-run coaching for a trip that has none (Gemini was busy). Responds with GetTripResponse. */
  retryCoaching: (id: string) => `/trips/${encodeURIComponent(id)}/coach`,
  getProgress: '/progress',
  ask: '/ask',
  health: '/health',
} as const;
