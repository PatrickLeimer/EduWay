import type { GpsFix } from '@eduway/shared';
import { describe, expect, it } from 'vitest';

import { createGpsPath } from './gpsPath';

/** ~11.1 m of latitude per 0.0001°. */
function fix(s: number, lat: number, extra: Partial<GpsFix> = {}): GpsFix {
  return { t: s * 1000, lat, lon: -80.37, speedMps: 11, heading: 0, accuracyM: 5, ...extra };
}

describe('gpsPath', () => {
  it('keeps clean fixes and measures the path between them', () => {
    const path = createGpsPath();
    expect(path.add(fix(0, 25.76))).toBe(0);
    expect(path.add(fix(1, 25.7601))).toBeCloseTo(11.1, 0);
    expect(path.add(fix(2, 25.7602))).toBeCloseTo(11.1, 0);
  });

  it('drops inaccurate fixes, out-of-order fixes and null island', () => {
    const path = createGpsPath();
    path.add(fix(0, 25.76));
    expect(path.add(fix(1, 25.7601, { accuracyM: 65 }))).toBeNull();
    expect(path.add(fix(0, 25.7601))).toBeNull();
    expect(path.add({ ...fix(2, 0), lon: 0 })).toBeNull();
  });

  it('drops a single jump and keeps going from the last good fix', () => {
    const path = createGpsPath();
    path.add(fix(0, 25.76));
    expect(path.add(fix(1, 25.77))).toBeNull(); // ~1.1 km in 1 s
    expect(path.add(fix(2, 25.7602))).toBeCloseTo(22.2, 0);
  });

  it('moves on when the kept fix was the bad one', () => {
    const path = createGpsPath();
    path.add(fix(0, 25.8)); // stale start ~4 km away
    expect(path.add(fix(1, 25.76))).toBeNull();
    expect(path.add(fix(2, 25.7601))).toBeNull();
    expect(path.add(fix(3, 25.7602))).toBe(0); // re-anchored, no phantom distance
    expect(path.add(fix(4, 25.7603))).toBeCloseTo(11.1, 0);
  });

  it('counts no distance while stopped or across a long gap', () => {
    const path = createGpsPath();
    path.add(fix(0, 25.76));
    expect(path.add(fix(1, 25.76001, { speedMps: 0 }))).toBe(0);
    expect(path.add(fix(60, 25.765))).toBe(0);
  });
});
