import { HARD_BRAKE } from '@edudriver/shared';
import { describe, expect, it } from 'vitest';

import { createHysteresis, type Episode } from './hysteresis';

/** Feeds `value(tS)` at 50 Hz for `durationS`; returns every finished episode. */
function run(value: (tS: number) => number, durationS: number): Episode[] {
  const m = createHysteresis(HARD_BRAKE);
  const out: Episode[] = [];
  for (let ms = 0; ms <= durationS * 1000; ms += 20) {
    const e = m.update(value(ms / 1000), ms);
    if (e) out.push(e);
  }
  return out;
}

const pulse = (from: number, to: number, level: number) => (tS: number) =>
  tS >= from && tS < to ? level : 0;

describe('createHysteresis (HARD_BRAKE thresholds)', () => {
  it('reports a coach episode held above coach start', () => {
    const out = run(pulse(1, 2, 3.0), 3);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ startT: 1000, endT: 2000, peak: 3.0, tier: 'coach' });
  });

  it('reports harsh when held above harsh start', () => {
    expect(run(pulse(1, 2, 4.0), 3)[0]?.tier).toBe('harsh');
  });

  it('ignores spikes shorter than minDurationS (speed bumps)', () => {
    expect(run(pulse(1, 1 + HARD_BRAKE.coach.minDurationS / 2, 5), 3)).toHaveLength(0);
  });

  it('stays coach when the harsh level is only brief', () => {
    const v = (tS: number) => (tS >= 1 && tS < 2 ? (tS < 1.1 ? 4.0 : 3.0) : 0);
    expect(run(v, 3)[0]).toMatchObject({ tier: 'coach', peak: 4.0, peakT: 1000 });
  });

  it('holds the episode open between release and start (hysteresis)', () => {
    // 3.0 for 0.5 s, dips to 2.0 (above release 1.5), back to 3.0, then off: one episode.
    const v = (tS: number) => (tS >= 1 && tS < 2.5 ? (tS >= 1.5 && tS < 2 ? 2 : 3) : 0);
    const out = run(v, 4);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ startT: 1000, endT: 2500 });
  });

  it('reset drops an open episode', () => {
    const m = createHysteresis(HARD_BRAKE);
    for (let ms = 0; ms < 1000; ms += 20) m.update(3, ms);
    expect(m.active()).toBe(true);
    m.reset();
    expect(m.active()).toBe(false);
    expect(m.update(0, 1000)).toBeNull();
  });
});
