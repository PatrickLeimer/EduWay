import { MPS_TO_MPH, type DrivingEvent } from '@edudriver/shared';
import { describe, expect, it } from 'vitest';

import { positionAt, speedBuckets, timeEvents, traceDurationS } from './replay';

const trace = {
  t: [0, 1, 2, 3],
  lat: [0, 1, 2, 3],
  lon: [10, 11, 12, 13],
  speedMps: [0, 10, null, 20],
};

describe('positionAt', () => {
  it('interpolates between fixes', () => {
    const p = positionAt(trace, 1.5);
    expect(p?.latitude).toBeCloseTo(1.5);
    expect(p?.longitude).toBeCloseTo(11.5);
  });
  it('clamps before the start and after the end', () => {
    expect(positionAt(trace, -5)).toEqual({ latitude: 0, longitude: 10 });
    expect(positionAt(trace, 99)).toEqual({ latitude: 3, longitude: 13 });
  });
  it('returns null for an empty trace', () => {
    expect(positionAt({ t: [], lat: [], lon: [], speedMps: [] }, 0)).toBeNull();
  });
});

describe('traceDurationS', () => {
  it('is the last timestamp', () => {
    expect(traceDurationS(trace)).toBe(3);
  });
});

describe('timeEvents', () => {
  const ev = (at: string) => ({ at }) as DrivingEvent;
  it('offsets events from the trip start and sorts them', () => {
    const out = timeEvents(
      [ev('2026-09-26T10:00:30.000Z'), ev('2026-09-26T10:00:05.000Z')],
      '2026-09-26T10:00:00.000Z',
    );
    expect(out.map((e) => e.offsetS)).toEqual([5, 30]);
  });
});

describe('speedBuckets', () => {
  it('keeps the max speed per bucket and treats null as 0', () => {
    const out = speedBuckets(trace, 2);
    expect(out).toHaveLength(2);
    expect(out[0]!.maxMph).toBeCloseTo(10 * MPS_TO_MPH);
    expect(out[1]!.maxMph).toBeCloseTo(20 * MPS_TO_MPH);
  });
  it('returns nothing for an empty trace', () => {
    expect(speedBuckets({ t: [], lat: [], lon: [], speedMps: [] }, 10)).toEqual([]);
  });
  it('does not crash on fixes before the start or bad timestamps', () => {
    const odd = {
      t: [-2, Number.NaN, 0, 10],
      lat: [0, 0, 0, 0],
      lon: [0, 0, 0, 0],
      speedMps: [5, 50, 1, 2],
    };
    const out = speedBuckets(odd, 2);
    expect(out[0]!.maxMph).toBeCloseTo(5 * MPS_TO_MPH);
  });
});
