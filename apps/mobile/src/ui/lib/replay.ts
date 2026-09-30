/**
 * Replay playback math (§9 "Replay"): where the car is at time t, which events
 * have happened by then, and a downsampled speed timeline. Replay only shows
 * what was recorded; it never re-runs detection. Pure, tested in replay.test.ts.
 */
import { MPS_TO_MPH, type DrivingEvent, type Trace } from '@edudriver/shared';

import type { MapPoint } from './geo';

export const REPLAY_SPEEDS = [1, 4, 10] as const;
export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number];

export type ReplayTrace = Pick<Trace, 't' | 'lat' | 'lon' | 'speedMps'>;

export function traceDurationS(trace: ReplayTrace): number {
  return trace.t[trace.t.length - 1] ?? 0;
}

/** Linear interpolation between the two fixes around `tS` (seconds since start). */
export function positionAt(trace: ReplayTrace, tS: number): MapPoint | null {
  const n = trace.t.length;
  if (n === 0) return null;
  if (tS <= trace.t[0]!) return { latitude: trace.lat[0]!, longitude: trace.lon[0]! };
  if (tS >= trace.t[n - 1]!) return { latitude: trace.lat[n - 1]!, longitude: trace.lon[n - 1]! };
  // Binary search for the last index with t <= tS.
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (trace.t[mid]! <= tS) lo = mid;
    else hi = mid;
  }
  const t0 = trace.t[lo]!;
  const t1 = trace.t[hi]!;
  const f = t1 > t0 ? (tS - t0) / (t1 - t0) : 0;
  return {
    latitude: trace.lat[lo]! + (trace.lat[hi]! - trace.lat[lo]!) * f,
    longitude: trace.lon[lo]! + (trace.lon[hi]! - trace.lon[lo]!) * f,
  };
}

export interface TimedEvent {
  event: DrivingEvent;
  /** Seconds since trip start. */
  offsetS: number;
}

/** Events with their offset from the trace start, oldest first. */
export function timeEvents(events: DrivingEvent[], startedAtIso: string): TimedEvent[] {
  const start = Date.parse(startedAtIso);
  return events
    .map((event) => ({ event, offsetS: (Date.parse(event.at) - start) / 1000 }))
    .sort((a, b) => a.offsetS - b.offsetS);
}

export interface SpeedBucket {
  /** Bucket start, seconds since trip start. */
  startS: number;
  /** Highest speed in the bucket, mph (0 when no speed was reported). */
  maxMph: number;
}

/** Downsamples the speed trace to at most `buckets` bars for the timeline. */
export function speedBuckets(trace: ReplayTrace, buckets: number): SpeedBucket[] {
  const duration = traceDurationS(trace);
  if (trace.t.length === 0 || buckets <= 0) return [];
  const width = Number.isFinite(duration) ? Math.max(duration / buckets, 1) : 1;
  const count = Math.max(1, Math.ceil(duration / width));
  const out: SpeedBucket[] = Array.from({ length: count }, (_, i) => ({
    startS: i * width,
    maxMph: 0,
  }));
  for (let i = 0; i < trace.t.length; i++) {
    const t = trace.t[i]!;
    // Skip bad timestamps; clamp fixes just before the start into the first bar.
    if (!Number.isFinite(t)) continue;
    const idx = Math.min(count - 1, Math.max(0, Math.floor(t / width)));
    const mph = (trace.speedMps[i] ?? 0) * MPS_TO_MPH;
    if (mph > out[idx]!.maxMph) out[idx]!.maxMph = mph;
  }
  return out;
}
