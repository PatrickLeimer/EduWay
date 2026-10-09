import { TRIP, type GpsFix } from '@eduway/shared';
import { describe, expect, it } from 'vitest';

import { createStopTimer } from './stopTimer';

const T0 = 1_700_000_000_000;
/** ~1.1 m per 0.00001° of latitude. */
const fix = (s: number, speedMps: number | null, northM = 0, accuracyM = 5): GpsFix => ({
  t: T0 + s * 1000,
  lat: 25.76 + northM / 111_000,
  lon: -80.3,
  speedMps,
  heading: null,
  accuracyM,
});

/** Feeds one fix per second; the clock matches the fix times. */
function feed(fixes: GpsFix[]) {
  const timer = createStopTimer();
  let stopped = 0;
  for (const f of fixes) stopped = timer.onFix(f, f.t);
  return { timer, stopped };
}

describe('stopTimer (§4 End Trip after 30 s stopped)', () => {
  it('counts a clean stop', () => {
    const fixes = Array.from({ length: 31 }, (_, s) => fix(s, 0));
    expect(feed(fixes).stopped).toBe(30);
  });

  it('is 0 while driving', () => {
    const fixes = Array.from({ length: 40 }, (_, s) => fix(s, 12, s * 12));
    expect(feed(fixes).stopped).toBe(0);
  });

  it('keeps counting when a parked phone reports no speed', () => {
    const fixes = Array.from({ length: 41 }, (_, s) => fix(s, s % 3 === 0 ? 0 : null, (s % 4) * 2));
    expect(feed(fixes).stopped).toBeGreaterThanOrEqual(TRIP.minStoppedToEndS);
  });

  it('ignores noisy speed while the car stays in place', () => {
    const fixes = [
      fix(0, 0),
      ...Array.from({ length: 40 }, (_, s) => fix(s + 1, 1.8, (s % 5) * 3)),
    ];
    expect(feed(fixes).stopped).toBe(40);
  });

  it('allows for poor accuracy (parking garage)', () => {
    const fixes = [fix(0, 0), ...Array.from({ length: 35 }, (_, s) => fix(s + 1, 2, 45, 40))];
    expect(feed(fixes).stopped).toBe(35);
  });

  it('keeps counting on the clock when fixes stop coming', () => {
    const timer = createStopTimer();
    timer.onFix(fix(0, 0), T0);
    timer.onFix(fix(5, 0), T0 + 5000);
    expect(timer.stoppedForS(T0 + 40_000)).toBe(40);
  });

  it('resets once the car drives off', () => {
    const fixes = [
      ...Array.from({ length: 20 }, (_, s) => fix(s, 0)),
      fix(20, 8, 10),
      fix(21, 10, 30),
      fix(22, 11, 60),
    ];
    const { timer, stopped } = feed(fixes);
    expect(stopped).toBe(0);
    expect(timer.stoppedForS(fixes[2]!.t + 60_000)).toBe(0);
  });

  it('a fresh stop after driving starts from 0', () => {
    const fixes = [
      ...Array.from({ length: 20 }, (_, s) => fix(s, 0)),
      fix(20, 12, 100),
      ...Array.from({ length: 6 }, (_, s) => fix(21 + s, 0, 200)),
    ];
    expect(feed(fixes).stopped).toBe(5);
  });

  it('reset clears the stop', () => {
    const { timer } = feed(Array.from({ length: 31 }, (_, s) => fix(s, 0)));
    timer.reset();
    expect(timer.stoppedForS(T0 + 100_000)).toBe(0);
  });
});
