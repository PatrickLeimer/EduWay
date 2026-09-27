/**
 * Builds the GET /progress response from stored trip summaries (WS3). Pure.
 * The repo gathers the rows (no traces, §9); this turns them into the score
 * trend, per-skill totals, test readiness and the gamification block.
 */
import {
  COUNT_KEY_BY_EVENT,
  EVENT_TYPES,
  GAMIFICATION,
  type EventType,
  type GeoPoint,
  type GetProgressResponse,
  type Progress,
  type RecurringSpot,
  type TripCounts,
  type UserProgress,
} from '@edudriver/shared';

import { computeUserProgress, qualifyingTrips, type GamificationTrip } from './compute';

/** One stored trip, as much as progress needs (never the trace). */
export interface ProgressTrip {
  id: string;
  startedAt: string;
  endedAt: string;
  distanceMi: number;
  passenger: boolean;
  score: number | null;
  counts: TripCounts;
  /** Harsh-tier events on this trip (from the events collection). */
  harshEvents: number;
}

export type ProgressSpot = RecurringSpot & { location: GeoPoint };

export function toGamificationTrip(t: ProgressTrip): GamificationTrip {
  return {
    id: t.id,
    score: t.score,
    completedAt: t.endedAt,
    distanceMi: t.distanceMi,
    passenger: t.passenger,
    harshEvents: t.harshEvents,
    phoneUseEvents: t.counts.phoneUse,
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const label = (type: EventType) => type.replace(/_/g, ' ');

/** Totals and per-10-mile rates per event type, over driven (non-passenger) trips. */
export function skillTotals(trips: ProgressTrip[]): Progress['skills'] {
  const driven = trips.filter((t) => !t.passenger);
  const miles = driven.reduce((m, t) => m + t.distanceMi, 0);
  const skills = {} as Progress['skills'];
  for (const type of EVENT_TYPES) {
    const count = driven.reduce((n, t) => n + t.counts[COUNT_KEY_BY_EVENT[type]], 0);
    skills[type] = { count, per10Mi: miles > 0 ? round1((count / miles) * 10) : 0 };
  }
  return skills;
}

/** `ready` only at readiness 100 from a full window; notes explain where the driver stands. */
export function testReadiness(
  progress: UserProgress,
  skills: Progress['skills'],
): Progress['testReadiness'] {
  const { readiness, readinessProvisional, qualifyingTrips: n } = progress;
  const notes = [
    readinessProvisional
      ? `Road test readiness ${readiness}/100 (early estimate: ${n} of ${GAMIFICATION.readinessWindow} qualifying drives so far)`
      : `Road test readiness ${readiness}/100 from your last ${GAMIFICATION.readinessWindow} drives`,
  ];
  const ready = readiness === 100 && !readinessProvisional;
  if (!ready) {
    notes.push(
      `Reach 100 with ${GAMIFICATION.readinessWindow} drives in a row scoring ${GAMIFICATION.readinessPerfectMinScore}+ and no harsh events`,
    );
  }
  const worst = EVENT_TYPES.filter((t) => skills[t].count > 0).sort(
    (a, b) => skills[b].per10Mi - skills[a].per10Mi,
  )[0];
  if (worst) notes.push(`Most frequent: ${label(worst)} (${skills[worst].per10Mi} per 10 mi)`);
  return { ready, notes };
}

export function buildProgress(
  trips: ProgressTrip[],
  recurringSpots: ProgressSpot[],
): GetProgressResponse {
  const ordered = [...trips].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
  const gamTrips = ordered.map(toGamificationTrip);
  const userProgress = computeUserProgress(gamTrips);
  const skills = skillTotals(ordered);
  return {
    scores: ordered
      .filter((t) => !t.passenger)
      .map((t) => ({ tripId: t.id, startedAt: t.startedAt, score: t.score })),
    skills,
    recurringSpots,
    testReadiness: testReadiness(userProgress, skills),
    userProgress,
    qualifyingTrips: qualifyingTrips(gamTrips).map((t) => ({
      id: t.id,
      score: t.score,
      completedAt: t.completedAt,
    })),
  };
}
