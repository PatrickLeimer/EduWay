import { G, PIPELINE, type MotionSample } from '@edudriver/shared';
import { describe, expect, it } from 'vitest';

import { motionFrame } from './level1';
import { createSignalFilter, isJunk } from './signals';
import { vec } from './vector';

const sample = (over: Partial<MotionSample>): MotionSample => ({
  t: 0,
  acc: vec(0, 0, 0),
  accG: vec(0, 0, -G),
  rot: vec(0, 0, 0),
  ...over,
});

const junk = (s: MotionSample) => isJunk(s, motionFrame(s));

describe('isJunk', () => {
  it('accepts a still phone', () => {
    expect(junk(sample({}))).toBe(false);
  });

  it('accepts fast rotation about the gravity axis (the car turning)', () => {
    expect(junk(sample({ rot: vec(0, 0, 2) }))).toBe(false);
  });

  it('rejects rotation off the gravity axis above the limit (phone picked up)', () => {
    const limit = PIPELINE.junkRotationRadPerS;
    expect(junk(sample({ rot: vec(limit * 0.9, 0, 0) }))).toBe(false);
    expect(junk(sample({ rot: vec(limit * 1.1, 0, 0) }))).toBe(true);
    // Two off-axis components, each under the limit, together over it.
    expect(junk(sample({ rot: vec(limit * 0.8, limit * 0.8, 0) }))).toBe(true);
  });

  it('rejects raw acceleration above the limit (dropped phone, pothole)', () => {
    const limit = PIPELINE.junkAccelMps2;
    expect(junk(sample({ accG: vec(0, 0, -limit * 0.95) }))).toBe(false);
    expect(junk(sample({ accG: vec(0, 0, -limit * 1.05) }))).toBe(true);
  });
});

describe('createSignalFilter', () => {
  const braking = { t: 0, speedMps: 15, dvdt: -3 };

  it('smooths with one EMA step per sample', () => {
    const f = createSignalFilter();
    const s = f.update(motionFrame(sample({ acc: vec(4, 0, 0) })), braking);
    expect(s.horiz).toBeCloseTo(4 * PIPELINE.emaAlpha);
    expect(s.lon).toBeCloseTo(-4 * PIPELINE.emaAlpha);
  });

  it('converges to a steady input within a second at 50 Hz', () => {
    const f = createSignalFilter();
    // Flat phone, car turning at 0.2 rad/s at 15 m/s: |lat| = 3 m/s², |h| = 5, so 4 m/s² is braking.
    const frame = motionFrame(sample({ acc: vec(5, 0, 0), rot: vec(0, 0, 0.2) }));
    let s = f.update(frame, braking);
    for (let i = 1; i < 50; i++) s = f.update(frame, braking);
    expect(Math.abs(s.lat)).toBeCloseTo(3, 3);
    expect(s.lon).toBeCloseTo(-4, 3);
  });

  it('does not read cornering as braking or acceleration', () => {
    for (const dvdt of [-3, 3]) {
      const f = createSignalFilter();
      const frame = motionFrame(sample({ acc: vec(3, 0, 0), rot: vec(0, 0, 0.2) }));
      let s = f.update(frame, { t: 0, speedMps: 15, dvdt });
      for (let i = 1; i < 50; i++) s = f.update(frame, { t: 0, speedMps: 15, dvdt });
      expect(Math.abs(s.lat)).toBeCloseTo(3, 3);
      expect(s.lon).toBeCloseTo(0, 3);
    }
  });

  it('reads zero lateral and longitudinal without GPS', () => {
    const f = createSignalFilter();
    const s = f.update(motionFrame(sample({ acc: vec(3, 0, 0), rot: vec(0, 0, 0.2) })), null);
    expect(s.lat).toBe(0);
    expect(s.lon).toBe(0);
    expect(s.horiz).toBeGreaterThan(0);
  });

  it('reset starts from zero again', () => {
    const f = createSignalFilter();
    const frame = motionFrame(sample({ acc: vec(4, 0, 0) }));
    for (let i = 0; i < 50; i++) f.update(frame, braking);
    f.reset();
    expect(f.update(frame, braking).horiz).toBeCloseTo(4 * PIPELINE.emaAlpha);
  });
});
