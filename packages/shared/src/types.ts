/**
 * Domain types shared by the phone and the server.
 *
 * PROTECTED CONTRACT (see root CLAUDE.md): changes need team agreement and go in
 * their own commit.
 *
 * Every type is defined as a zod schema first and the TypeScript type is inferred
 * from it, so runtime validation (server, fixtures, tests) and compile-time types
 * can never drift apart. Section numbers (§) refer to docs/driving-coach-master.md.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enums (§7, §8)
// ---------------------------------------------------------------------------

/** Every event the detectors can emit. §7 "Thresholds" table. */
export const EventTypeSchema = z.enum([
  'hard_brake',
  'hard_accel',
  'rough_turn',
  'swerve',
  'speeding',
  'rolling_stop',
  'phone_use',
]);
export type EventType = z.infer<typeof EventTypeSchema>;
export const EVENT_TYPES = EventTypeSchema.options;

/** coach = debrief only; harsh = may trigger a live alert. §7. */
export const TierSchema = z.enum(['coach', 'harsh']);
export type Tier = z.infer<typeof TierSchema>;

/**
 * Where a speed limit came from. §8 "Speed limits".
 * posted   = OSM maxspeed tag (live alerts + scoring)
 * inferred = road-class default (scoring + debrief only, never live alerts)
 * unknown  = no way matched (no speeding check)
 */
export const LimitConfidenceSchema = z.enum(['posted', 'inferred', 'unknown']);
export type LimitConfidence = z.infer<typeof LimitConfidenceSchema>;

/** Events that get a live ElevenLabs voice alert. §7 "Live ElevenLabs alerts". */
export const LiveAlertTypeSchema = z.enum([
  'hard_brake',
  'rough_turn',
  'swerve',
  'speeding',
  'phone_use',
]);
export type LiveAlertType = z.infer<typeof LiveAlertTypeSchema>;

// ---------------------------------------------------------------------------
// Sensor inputs (§5, §6). These live only on the phone and are NEVER uploaded
// or stored (§3, §9). They are here so detectors and fixtures share one shape.
// ---------------------------------------------------------------------------

export const Vec3Schema = z.object({ x: z.number(), y: z.number(), z: z.number() });
export type Vec3 = z.infer<typeof Vec3Schema>;

/**
 * One DeviceMotion reading at ~50 Hz. §5.
 * Units are normalized by the WS1 adapter:
 * - acc / accG in m/s² (Expo already reports m/s² for DeviceMotion)
 * - rot in rad/s. NOTE: Expo SDK 57 reports rotationRate in deg/s; the adapter
 *   must convert so the §6/§7 formulas (lateral = speed × yaw rate) hold.
 */
export const MotionSampleSchema = z.object({
  /** Epoch ms. */
  t: z.number(),
  /** Acceleration with gravity removed, m/s². */
  acc: Vec3Schema,
  /** Acceleration including gravity, m/s². Used for the gravity vector ĝ (§6). */
  accG: Vec3Schema,
  /** Rotation rate, rad/s (converted from Expo deg/s). */
  rot: Vec3Schema,
});
export type MotionSample = z.infer<typeof MotionSampleSchema>;

/** One GPS fix at ~1 Hz from expo-location. §5. Null fields = platform did not report. */
export const GpsFixSchema = z.object({
  /** Epoch ms. */
  t: z.number(),
  lat: z.number(),
  lon: z.number(),
  speedMps: z.number().nullable(),
  /** Degrees clockwise from true north. */
  heading: z.number().nullable(),
  accuracyM: z.number().nullable(),
});
export type GpsFix = z.infer<typeof GpsFixSchema>;

// ---------------------------------------------------------------------------
// GeoJSON (§9: 2dsphere index on events.location, routePreview LineString)
// ---------------------------------------------------------------------------

/** [lon, lat] order, as GeoJSON and MongoDB require. */
export const LonLatSchema = z.tuple([z.number(), z.number()]);

export const GeoPointSchema = z.object({
  type: z.literal('Point'),
  coordinates: LonLatSchema,
});
export type GeoPoint = z.infer<typeof GeoPointSchema>;

export const GeoLineStringSchema = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(LonLatSchema),
});
export type GeoLineString = z.infer<typeof GeoLineStringSchema>;

// ---------------------------------------------------------------------------
// Events (§7 step 5 "Record the event", §9 events collection)
// ---------------------------------------------------------------------------

/**
 * What a detector emits (WS1 motion detectors, WS2 road detectors), before the
 * trip session adds road context and alert status. §7 detection pipeline step 5.
 */
export const DraftEventSchema = z.object({
  type: EventTypeSchema,
  tier: TierSchema,
  /** Peak filtered signal in m/s² (brake/accel/turn/swerve); mph over limit for speeding; null otherwise. */
  peak: z.number().nullable(),
  durationS: z.number().nonnegative(),
  speedMph: z.number().nonnegative(),
  /** ISO timestamp of the peak. Lines events up with the trace by time (§9). */
  at: z.iso.datetime(),
  /** GPS fix nearest the peak. */
  location: GeoPointSchema,
  /** Speeding only: mph over the limit at peak. Feeds the §10 summary. */
  overMph: z.number().optional(),
  /** Rolling stop only: minimum speed passing the sign. Feeds the §10 summary. */
  minSpeedMph: z.number().optional(),
});
export type DraftEvent = z.infer<typeof DraftEventSchema>;

/** Road context added by the trip session from the road cache (§8). */
export const RoadContextSchema = z.object({
  street: z.string().nullable(),
  /** OSM `highway` tag value, e.g. "residential", "primary". */
  roadClass: z.string().nullable(),
  limitMph: z.number().nullable(),
  limitConfidence: LimitConfidenceSchema,
});
export type RoadContext = z.infer<typeof RoadContextSchema>;

/** An event as recorded on the phone and uploaded at trip end (no ids yet). */
export const RecordedEventSchema = DraftEventSchema.extend(RoadContextSchema.shape).extend({
  /** True when a live voice alert was actually played for this event. */
  alerted: z.boolean(),
});
export type RecordedEvent = z.infer<typeof RecordedEventSchema>;

/** events collection document. §9. */
export const DrivingEventSchema = RecordedEventSchema.extend({
  _id: z.string(),
  tripId: z.string(),
  userId: z.string(),
});
export type DrivingEvent = z.infer<typeof DrivingEventSchema>;

// ---------------------------------------------------------------------------
// Trips (§9 trips collection)
// ---------------------------------------------------------------------------

/** Per-type event counts. Keys follow §9 exactly. */
export const TripCountsSchema = z.object({
  brake: z.number().int().nonnegative(),
  accel: z.number().int().nonnegative(),
  turn: z.number().int().nonnegative(),
  swerve: z.number().int().nonnegative(),
  speeding: z.number().int().nonnegative(),
  rollingStop: z.number().int().nonnegative(),
  phoneUse: z.number().int().nonnegative(),
});
export type TripCounts = z.infer<typeof TripCountsSchema>;

/** Maps an EventType to its TripCounts key. */
export const COUNT_KEY_BY_EVENT: Record<EventType, keyof TripCounts> = {
  hard_brake: 'brake',
  hard_accel: 'accel',
  rough_turn: 'turn',
  swerve: 'swerve',
  speeding: 'speeding',
  rolling_stop: 'rollingStop',
  phone_use: 'phoneUse',
};

export const TripStatsSchema = z.object({
  eventsPer10Mi: z.number().nonnegative(),
  /** 0-100. */
  pctTimeSpeeding: z.number().min(0).max(100),
  phoneUseSeconds: z.number().nonnegative(),
});
export type TripStats = z.infer<typeof TripStatsSchema>;

// ---------------------------------------------------------------------------
// Coaching (§10)
// ---------------------------------------------------------------------------

/** Structured Gemini output (JSON mode). §10 "Output". */
export const CoachOutputSchema = z.object({
  strengths: z.array(z.string()),
  /** 1 to 2 most important areas (§10 prompt guidelines). */
  focus_areas: z.array(z.object({ skill: z.string(), why: z.string(), tip: z.string() })),
  /** Spoken by ElevenLabs; keep under ~60 words. */
  debrief_script: z.string(),
});
export type CoachOutput = z.infer<typeof CoachOutputSchema>;

/** trips collection document. §9. */
export const TripSchema = z.object({
  _id: z.string(),
  userId: z.string(),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime(),
  distanceMi: z.number().nonnegative(),
  /** "I'm a passenger": scoring skipped (§4). */
  passenger: z.boolean(),
  lockEnabled: z.boolean(),
  /** Simplified route for lists and thumbnails. */
  routePreview: GeoLineStringSchema,
  counts: TripCountsSchema,
  stats: TripStatsSchema,
  /** 0-100, computed in code (server/scoring), never by Gemini (§7 "Scoring"). Null for passenger trips. */
  score: z.number().min(0).max(100).nullable(),
  coach: CoachOutputSchema.nullable(),
  coachAudioUrl: z.string().nullable(),
});
export type Trip = z.infer<typeof TripSchema>;

// ---------------------------------------------------------------------------
// Trace (§9 traces collection): one document per trip, columnar arrays, GPS only
// ---------------------------------------------------------------------------

export const TraceSchema = z.object({
  tripId: z.string(),
  userId: z.string(),
  startedAt: z.iso.datetime(),
  hz: z.literal(1),
  /** Seconds since trip start. All arrays have the same length. */
  t: z.array(z.number()),
  lat: z.array(z.number()),
  lon: z.array(z.number()),
  speedMps: z.array(z.number().nullable()),
  heading: z.array(z.number().nullable()),
  accuracyM: z.array(z.number().nullable()),
});
export type Trace = z.infer<typeof TraceSchema>;

/** The trace as recorded on the phone, before the server assigns tripId/userId. */
export const TraceUploadSchema = TraceSchema.omit({ tripId: true, userId: true });
export type TraceUpload = z.infer<typeof TraceUploadSchema>;

// ---------------------------------------------------------------------------
// Gemini input (§10 "Input: compact trip summary"). snake_case matches the doc
// because this object is serialized straight into the prompt.
// ---------------------------------------------------------------------------

export const SummaryEventSchema = z.object({
  type: EventTypeSchema,
  tier: TierSchema.optional(),
  peak: z.number().optional(),
  speed_mph: z.number().optional(),
  street: z.string().optional(),
  alerted: z.boolean().optional(),
  over_mph: z.number().optional(),
  limit_mph: z.number().optional(),
  limit_confidence: LimitConfidenceSchema.optional(),
  min_speed_mph: z.number().optional(),
  duration_s: z.number().optional(),
});
export type SummaryEvent = z.infer<typeof SummaryEventSchema>;

export const RecurringSpotSchema = z.object({
  type: EventTypeSchema,
  street: z.string(),
  count: z.number().int().positive(),
});
export type RecurringSpot = z.infer<typeof RecurringSpotSchema>;

export const TripSummarySchema = z.object({
  trip: z.object({
    duration_min: z.number(),
    distance_mi: z.number(),
    score: z.number().nullable(),
  }),
  events: z.array(SummaryEventSchema),
  stats: z.object({
    events_per_10mi: z.number(),
    pct_time_speeding: z.number(),
    phone_use_seconds: z.number(),
  }),
  history: z.object({
    last_5_scores: z.array(z.number()),
    recurring_spots: z.array(RecurringSpotSchema),
  }),
});
export type TripSummary = z.infer<typeof TripSummarySchema>;

// ---------------------------------------------------------------------------
// Progress (§12 screen 5: score trend, skill breakdown, recurring spots, test readiness)
// ---------------------------------------------------------------------------

export const ProgressSchema = z.object({
  /** Oldest first, for the trend chart. */
  scores: z.array(
    z.object({ tripId: z.string(), startedAt: z.iso.datetime(), score: z.number().nullable() }),
  ),
  /** Per event type totals across all trips. */
  skills: z.record(
    EventTypeSchema,
    z.object({ count: z.number().int().nonnegative(), per10Mi: z.number().nonnegative() }),
  ),
  /** From the 2dsphere query across trips (§1 differentiator 3). */
  recurringSpots: z.array(RecurringSpotSchema.extend({ location: GeoPointSchema })),
  /** §1 differentiator 4. Rule for "ready" is TBD by the team (TODO in server/routes). */
  testReadiness: z.object({ ready: z.boolean(), notes: z.array(z.string()) }),
});
export type Progress = z.infer<typeof ProgressSchema>;
