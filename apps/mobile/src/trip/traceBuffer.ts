/**
 * Columnar GPS trace recorder (master doc §9 "Route traces"). Pure.
 *
 * Every GPS fix of the trip is appended here at ~1 Hz and uploaded once at
 * trip end. Columnar arrays keep the upload small and match the `traces`
 * collection shape exactly.
 */
import type { GpsFix, TraceUpload } from '@edudriver/shared';

export interface TraceBuffer {
  append(fix: GpsFix): void;
  readonly length: number;
  /** Snapshot as the TraceUpload shape (copies the arrays). */
  toUpload(): TraceUpload;
}

export function createTraceBuffer(startedAtMs: number): TraceBuffer {
  const cols = {
    t: [] as number[],
    lat: [] as number[],
    lon: [] as number[],
    speedMps: [] as (number | null)[],
    heading: [] as (number | null)[],
    accuracyM: [] as (number | null)[],
  };
  return {
    append(fix) {
      cols.t.push(Math.round((fix.t - startedAtMs) / 100) / 10); // seconds, 0.1 s precision
      cols.lat.push(fix.lat);
      cols.lon.push(fix.lon);
      cols.speedMps.push(fix.speedMps);
      cols.heading.push(fix.heading);
      cols.accuracyM.push(fix.accuracyM);
    },
    get length() {
      return cols.t.length;
    },
    toUpload() {
      return {
        startedAt: new Date(startedAtMs).toISOString(),
        hz: 1,
        t: [...cols.t],
        lat: [...cols.lat],
        lon: [...cols.lon],
        speedMps: [...cols.speedMps],
        heading: [...cols.heading],
        accuracyM: [...cols.accuracyM],
      };
    },
  };
}
