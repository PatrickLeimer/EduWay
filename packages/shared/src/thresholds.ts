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
 * TODO(team): the doc only fixes the ordering (harsh > coach, phone use heaviest).
 * These numbers are placeholders until tuned.
 */
export const SCORING = {
  base: 100,
  normalizePerMi: 10,
  /** Trips shorter than this are normalized as if they were this long, so a 0.2 mi trip isn't wrecked by one event. */
  minNormalizeMi: 1,
  penalty: {
    hard_brake: { coach: 3, harsh: 6 },
    hard_accel: { coach: 2, harsh: 4 },
    rough_turn: { coach: 3, harsh: 6 },
    swerve: { coach: 4, harsh: 8 },
    speeding: { coach: 3, harsh: 8 },
    rolling_stop: { coach: 4, harsh: 4 },
    phone_use: { coach: 15, harsh: 15 },
  } satisfies Record<EventType, Record<Tier, number>>,
} as const;

// ---------------------------------------------------------------------------
// Coaching (§10)
// ---------------------------------------------------------------------------

export const COACH = {
  maxFocusAreas: 2,
  maxDebriefWords: 60,
  historyScores: 5,
  /** Same type within this radius on ≥ minCount trips = recurring spot. TODO(WS3): tune. */
  recurringSpotRadiusM: 50,
  recurringSpotMinCount: 2,
} as const;
