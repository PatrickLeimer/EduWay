/**
 * Every tunable number in the system. Never hard-code these elsewhere
 * (root CLAUDE.md "How to work").
 *
 * PROTECTED CONTRACT. Values come from docs/driving-coach-master.md; tune them
 * on real test drives and change them here in their own commit.
 *
 * Units are in the constant names or comments. Accelerations are m/s² AFTER the
 * ~2 Hz EMA filter (1 g = 9.81 m/s²).
 */
import type { EventType, Tier } from './types';

/**
 * When two event types share the highest trip count, the earlier entry wins.
 * Same safety order the coaching prompt uses: phone use, then motion events,
 * then speeding, then rolling stops.
 */
const MAIN_PROBLEM_TIE_BREAK = [
  'phone_use',
  'hard_brake',
  'hard_accel',
  'rough_turn',
  'swerve',
  'speeding',
  'rolling_stop',
] as const satisfies readonly EventType[];

export const G = 9.81;
export const MPS_TO_MPH = 2.236936;
export const KMH_TO_MPS = 1 / 3.6;
export const DEG_TO_RAD = Math.PI / 180;

// ---------------------------------------------------------------------------
// Sampling and pipeline (§5, §6, §7 "Detection pipeline", §15 pitfalls)
// ---------------------------------------------------------------------------

export const PIPELINE = {
  /** DeviceMotion.setUpdateInterval(20) → ~50 Hz. §5. */
  motionIntervalMs: 20,
  /** GPS target interval. §5. */
  gpsIntervalMs: 1000,
  /** EMA smoothing factor at 50 Hz (~2 Hz cutoff). §7 step 2. */
  emaAlpha: 0.2,
  /** Pause detection when rotation off the gravity axis exceeds this (phone picked up). §7 step 3. */
  junkRotationRadPerS: 60 * DEG_TO_RAD,
  /** Pause detection when raw acceleration exceeds this (drop / pothole). §7 step 3. */
  junkAccelMps2: 1.5 * G,
  /** Merge same-type events closer than this. §7 step 4. */
  mergeWindowS: 3,
  /** Ignore GPS fixes less accurate than this. §15. */
  maxGpsAccuracyM: 20,
  /** Skip turn and swerve logic below this speed. §15. */
  minSpeedForLateralMps: 10 * KMH_TO_MPS,
  /** Level 2 orientation: learn forward axis only when |dv/dt| exceeds this and yaw ≈ 0. §6. */
  forwardAxisMinDvDtMps2: 1.0,
  /** Motion ring buffer length, seconds. §7 step 1 ("short ring buffers"). */
  ringBufferS: 5,
} as const;

// ---------------------------------------------------------------------------
// Event thresholds (§7 "Thresholds" table)
// ---------------------------------------------------------------------------

/**
 * Hysteresis state machine thresholds (§7 step 4): fire at `start`, hold for
 * `minDurationS`, release below `release`. `release` values other than hard
 * braking's 1.5 are not in the doc; they are set 1.0 below `start` as a
 * starting point. TODO(WS1): tune on test drives.
 */
export interface HysteresisThreshold {
  start: number;
  release: number;
  minDurationS: number;
}

export const HARD_BRAKE = {
  coach: { start: 3.5, release: 1.5, minDurationS: 0.4 },
  harsh: { start: 4.5, release: 1.5, minDurationS: 0.4 },
  // Must also hold: GPS speed dropping.
} as const satisfies Record<Tier, HysteresisThreshold>;

export const HARD_ACCEL = {
  coach: { start: 3.0, release: 1.5, minDurationS: 0.4 },
  // Harsh tier exists for scoring but is debrief only (no live alert).
  harsh: { start: 4.0, release: 1.5, minDurationS: 0.4 },
  // Must also hold: GPS speed rising.
} as const satisfies Record<Tier, HysteresisThreshold>;

export const ROUGH_TURN = {
  coach: { start: 3.0, release: 2.0, minDurationS: 0.5 },
  harsh: { start: 4.0, release: 2.0, minDurationS: 0.5 },
  /** Must also hold: heading change greater than this. */
  minHeadingChangeDeg: 30,
} as const;

export const SWERVE = {
  /** Lateral must go +peak then −peak (or reverse) within windowS. */
  coach: { peakMps2: 2.5 },
  harsh: { peakMps2: 4.0 },
  windowS: 2,
  /** Net heading change must stay under this (otherwise it was a turn). */
  maxNetHeadingChangeDeg: 15,
  minSpeedMps: 25 * KMH_TO_MPS,
  /** A normal lane change stays under this; context only. */
  normalLaneChangeMps2: 1.5,
} as const;

export const SPEEDING = {
  /** mph over the limit. */
  coachOverMph: 5,
  /** Harsh tier requires a *posted* limit (§8). */
  harshOverMph: 15,
  minDurationS: 5,
  maxGpsAccuracyM: 20,
} as const;

export const ROLLING_STOP = {
  /** Log a rolling stop if min speed passing the sign stays above this. */
  maxStopSpeedMph: 4,
  /** A stop sign is "ours" when the path passes within this distance. §8. */
  signRadiusM: 15,
  /** Heading must match the sign's `direction` tag within this, when tagged. TODO(WS2): tune. */
  headingToleranceDeg: 45,
} as const;

export const PHONE_USE = {
  /** Phone use only counts while moving faster than this. */
  minSpeedMps: 10 * KMH_TO_MPS,
} as const;

// ---------------------------------------------------------------------------
// Road data (§8)
// ---------------------------------------------------------------------------

export const ROAD = {
  /** Overpass query radius around the car. §8 says 1 to 2 km. */
  overpassRadiusM: 1500,
  /** Refetch when the car gets within this distance of the cached area's edge. TODO(WS2): tune. */
  refetchEdgeMarginM: 400,
  /** Max distance from a way for a GPS fix to match it. TODO(WS2): tune. */
  maxMatchDistanceM: 25,
  /**
   * Road-class default limits in mph (OSM `highway` → mph). Marked `inferred`
   * and never used for live alerts. §8 "Speed limits" ("adjust as needed").
   */
  defaultLimitMphByClass: {
    motorway: 65,
    motorway_link: 45,
    trunk: 55,
    trunk_link: 45,
    primary: 45,
    primary_link: 35,
    secondary: 40,
    secondary_link: 35,
    tertiary: 35,
    tertiary_link: 30,
    unclassified: 30,
    residential: 25,
    living_street: 15,
    service: 15,
  } as Readonly<Record<string, number>>,
} as const;

// ---------------------------------------------------------------------------
// Trip lifecycle (§4)
// ---------------------------------------------------------------------------

export const TRIP = {
  /** End Trip only allowed after being stopped at least this long. */
  minStoppedToEndS: 30,
  /** "Stopped" means GPS speed below this. TODO(WS2): tune. */
  stoppedSpeedMps: 0.5,
  /** Route trace: a fix implying more than this speed from the last kept fix is a GPS jump. */
  maxPlausibleSpeedMps: 70,
  /** Route trace: this many jumps in a row means the last kept fix was the bad one. */
  maxGpsJumps: 3,
  /** Route trace: no distance is counted across a GPS gap longer than this. */
  maxGpsGapS: 30,
} as const;

// ---------------------------------------------------------------------------
// Live alerts (§7 "Live ElevenLabs alerts")
// ---------------------------------------------------------------------------

export const ALERTS = {
  /** Cooldown between alerts of the same type [Proposed]. */
  cooldownS: 60,
  /** Types exempt from cooldown. */
  cooldownExempt: ['phone_use'] as readonly EventType[],
} as const;

// ---------------------------------------------------------------------------
// Scoring (§7 "Scoring" [Proposed])
// ---------------------------------------------------------------------------

/**
 * Score = 100 − Σ penalties, normalized per 10 miles, clamped to [0, 100].
 * The doc only fixes the ordering (harsh > coach, phone use heaviest). These
 * numbers were fitted to the 2026-09-26 test drive (4.5 mi, 2 hard brakes,
 * 4 rough turns, 1 speeding), which should score in the low 60s. Brake-led:
 * brakes carry the most weight of the driving events. Re-tune on more drives.
 */
export const SCORING = {
  base: 100,
  normalizePerMi: 10,
  /** Trips shorter than this are normalized as if they were this long, so a 0.2 mi trip isn't wrecked by one event. */
  minNormalizeMi: 3,
  penalty: {
    hard_brake: { coach: 3, harsh: 6 },
    hard_accel: { coach: 1.5, harsh: 3 },
    rough_turn: { coach: 1, harsh: 2 },
    swerve: { coach: 3, harsh: 6 },
    speeding: { coach: 2, harsh: 4 },
    rolling_stop: { coach: 2, harsh: 2 },
    phone_use: { coach: 10, harsh: 10 },
  } satisfies Record<EventType, Record<Tier, number>>,
} as const;

// ---------------------------------------------------------------------------
// Coaching (§10)
// ---------------------------------------------------------------------------

export const COACH = {
  maxFocusAreas: 2,
  /** Written summary (debrief_script). */
  maxDebriefWords: 60,
  /** Coaching chat (§10 "Output"): message count and total spoken words. ~900 ElevenLabs characters per trip. */
  chatMinMessages: 6,
  chatMaxMessages: 10,
  maxChatWords: 160,
  historyScores: 5,
  /** Same type within this radius on ≥ minCount trips = recurring spot. TODO(WS3): tune. */
  recurringSpotRadiusM: 50,
  recurringSpotMinCount: 2,
  /** Distinct trips with one event type before it is history.main_problem. */
  mainProblemMinTrips: 3,
  /** Distinct trips on one street before main_problem names that street. */
  mainProblemStreetMinTrips: 2,
  mainProblemTieBreak: MAIN_PROBLEM_TIE_BREAK,
  /** Street View caption (street_view_caption), §12. */
  maxStreetViewCaptionWords: 30,
} as const;

// ---------------------------------------------------------------------------
// Street View callout (§12 "Street View callout")
// ---------------------------------------------------------------------------

export const STREET_VIEW = {
  /**
   * Event types that can be shown, most useful first (ranking rule 3). Types not
   * listed never qualify: phone use and hard acceleration teach nothing from a
   * location view.
   */
  typePriority: [
    'rolling_stop',
    'speeding',
    'hard_brake',
    'rough_turn',
    'swerve',
  ] as readonly EventType[],
  /** Coverage checks per trip, to limit API calls. */
  maxCandidates: 3,
  /** Camera faces the driving direction this long before the event (what the student saw on approach). */
  headingLookbackS: 3,
  /** A trace fix counts for a moment when it is within this many seconds of it. */
  headingMatchWindowS: 1.5,
  /** Street View metadata search radius around the event. */
  metadataRadiusM: 50,
  /** Static thumbnail: size (the Static API maximum is 640), pitch, field of view. */
  imageWidthPx: 640,
  imageHeightPx: 400,
  pitchDeg: 0,
  fovDeg: 90,
  /** Short browser cache for the thumbnail (Google's terms: no long-term storage). */
  thumbnailCacheS: 300,
} as const;
