/**
 * Trip scoring (WS3). STUB. Master doc §7 "Scoring".
 *
 * Score is computed in code, never by Gemini, so it is consistent and
 * explainable: start at SCORING.base, subtract SCORING.penalty[type][tier] per
 * event, normalized per SCORING.normalizePerMi miles, clamp to [0, 100].
 * Pure: no I/O, so it is tested with fixtures.
 */
import type { RecordedEvent, TraceUpload, TripCounts, TripStats } from '@edudriver/shared';

export interface ScoreInput {
  events: RecordedEvent[];
  distanceMi: number;
  /** Passenger trips are not scored (§4): score is null. */
  passenger: boolean;
  /** Needed for pctTimeSpeeding (time-based). */
  trace: TraceUpload;
}

export interface ScoreResult {
  score: number | null;
  counts: TripCounts;
  stats: TripStats;
}

export type ScoreTrip = (input: ScoreInput) => ScoreResult;

export const scoreTrip: ScoreTrip = (_input) => {
  // TODO(WS3, §7): counts via COUNT_KEY_BY_EVENT; eventsPer10Mi; pctTimeSpeeding from
  //   speeding event durations over trace duration; phoneUseSeconds = Σ phone_use durationS;
  //   score from SCORING (null when passenger). Use Math.max(distanceMi, SCORING.minNormalizeMi).
  return {
    score: null,
    counts: { brake: 0, accel: 0, turn: 0, swerve: 0, speeding: 0, rollingStop: 0, phoneUse: 0 },
    stats: { eventsPer10Mi: 0, pctTimeSpeeding: 0, phoneUseSeconds: 0 },
  };
};
