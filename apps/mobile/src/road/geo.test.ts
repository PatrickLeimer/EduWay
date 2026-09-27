// Placeholder test: proves Vitest runs pure road logic. WS2 adds cache/matching tests
// against fixtures/overpass.response.json next to it.
import { describe, expect, it } from 'vitest';

import { haversineM, headingDiffDeg, bearingDeg } from './geo';

describe('geo helpers', () => {
  it('measures ~111 km per degree of latitude', () => {
    expect(haversineM(25, -80, 26, -80)).toBeGreaterThan(110_000);
    expect(haversineM(25, -80, 26, -80)).toBeLessThan(112_000);
  });

  it('wraps heading differences', () => {
    expect(headingDiffDeg(350, 10)).toBe(20);
    expect(headingDiffDeg(90, 270)).toBe(180);
  });

  it('measures bearing clockwise from north', () => {
    expect(bearingDeg(25, -80, 26, -80)).toBeCloseTo(0, 5);
    expect(bearingDeg(25, -80, 25, -79)).toBeCloseTo(90, 5);
    expect(bearingDeg(25, -80, 25, -81)).toBeCloseTo(270, 5);
  });
});
