import { DEG_TO_RAD, SWERVE } from '@edudriver/shared';
import { describe, expect, it } from 'vitest';

import type { Episode } from './hysteresis';
import { createSwerveDetector } from './swerve';

/** Feeds lateral `lat(tS)` at 50 Hz with heading `heading(tS)` (rad). */
function run(lat: (tS: number) => number, durationS: number, heading = (_tS: number) => 0) {
  const d = createSwerveDetector();
  const out: Episode[] = [];
  for (let ms = 0; ms <= durationS * 1000; ms += 20) {
    const e = d.update(lat(ms / 1000), ms, heading(ms / 1000));
    if (e) out.push(e);
  }
  return out;
}

/** +a for `lobeS` from 1 s, then `gapS` of zero, then −a for `lobeS`. */
const flip =
  (a: number, lobeS: number, gapS = 0) =>
  (tS: number): number => {
    if (tS >= 1 && tS < 1 + lobeS) return a;
    const second = 1 + lobeS + gapS;
    return tS >= second && tS < second + lobeS ? -a : 0;
  };

describe('createSwerveDetector', () => {
  it('detects a quick left-right flip', () => {
    const out = run(flip(3, 0.5), 4);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ tier: 'coach', peak: 3, startT: 1000, endT: 2000 });
  });

  it('is harsh only when both lobes reach the harsh peak', () => {
    expect(run(flip(4.2, 0.5), 4)[0]?.tier).toBe('harsh');
    const lopsided = (tS: number) => (tS >= 1 && tS < 1.5 ? 4.5 : tS >= 1.5 && tS < 2 ? -2.8 : 0);
    expect(run(lopsided, 4)[0]?.tier).toBe('coach');
  });

  it('ignores a single lobe (a normal lane change or curve)', () => {
    expect(run((tS) => (tS >= 1 && tS < 2 ? 3 : 0), 4)).toHaveLength(0);
  });

  it('ignores flips whose peaks are further apart than the window', () => {
    expect(run(flip(3, 0.5, SWERVE.windowS), 6)).toHaveLength(0);
  });

  it('ignores flips below the coach peak', () => {
    expect(run(flip(SWERVE.coach.peakMps2 * 0.9, 0.5), 4)).toHaveLength(0);
  });

  it('ignores flips with a large net heading change (that was a turn)', () => {
    const turning = (tS: number) => tS * 20 * DEG_TO_RAD;
    expect(run(flip(3, 0.5), 4, turning)).toHaveLength(0);
  });
});
