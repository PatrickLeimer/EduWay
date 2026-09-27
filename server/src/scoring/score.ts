/**
 * Trip scoring (WS3). Master doc §7 "Scoring".
 *
 * Score is computed in code, never by Gemini, so it is consistent and
 * explainable: start at SCORING.base, subtract SCORING.penalty[type][tier] per
 * event, normalized per SCORING.normalizePerMi miles, clamp to [0, 100].
 * Pure: no I/O, so it is tested with fixtures.
 */
import {
  COUNT_KEY_BY_EVENT,
  SCORING,
  type RecordedEvent,
  type TraceUpload,
  type TripCounts,
  type TripStats,
} from '@edudriver/shared';

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

const round1 = (n: number) => Math.round(n * 10) / 10;

export const scoreTrip: ScoreTrip = ({ events, distanceMi, passenger, trace }) => {
  const counts: TripCounts = {
    brake: 0,
    accel: 0,
    turn: 0,
    swerve: 0,
    speeding: 0,
    rollingStop: 0,
    phoneUse: 0,
  };
  let penalty = 0;
  let speedingS = 0;
  let phoneUseSeconds = 0;
  for (const e of events) {
    counts[COUNT_KEY_BY_EVENT[e.type]] += 1;
    penalty += SCORING.penalty[e.type][e.tier];
    if (e.type === 'speeding') speedingS += e.durationS;
    if (e.type === 'phone_use') phoneUseSeconds += e.durationS;
  }

  // Stats use the real distance; only the score gets the short-trip floor.
  const eventsPer10Mi = distanceMi > 0 ? (events.length / distanceMi) * SCORING.normalizePerMi : 0;
  const tripS = trace.t.length > 1 ? trace.t[trace.t.length - 1]! - trace.t[0]! : 0;
  const pctTimeSpeeding = tripS > 0 ? Math.min(100, (speedingS / tripS) * 100) : 0;

  const normalizeMi = Math.max(distanceMi, SCORING.minNormalizeMi);
  const raw = SCORING.base - penalty * (SCORING.normalizePerMi / normalizeMi);

  return {
    score: passenger ? null : Math.round(Math.min(100, Math.max(0, raw))),
    counts,
    stats: {
      eventsPer10Mi: round1(eventsPer10Mi),
      pctTimeSpeeding: round1(pctTimeSpeeding),
      phoneUseSeconds: round1(phoneUseSeconds),
    },
  };
};
