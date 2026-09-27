import { G, MPS_TO_MPH, PIPELINE, type DraftEvent, type MotionSample } from '@edudriver/shared';
import { describe, expect, it } from 'vitest';

import { createMotionDetector } from './MotionDetector';
import { vec } from './vector';

const T0 = Date.UTC(2026, 8, 26, 14, 0, 0);

const sample = (over: Partial<MotionSample>): MotionSample => ({
  t: T0,
  acc: vec(0, 0, 0),
  accG: vec(0, 0, -G),
  rot: vec(0, 0, 0),
  ...over,
});

interface Drive {
  durationS: number;
  /** GPS speed, m/s, sampled once per second. */
  speed: (tS: number) => number;
  /** Horizontal acceleration magnitude, m/s². */
  horiz?: (tS: number) => number;
  /** Car yaw rate, rad/s (sign as the detector measures it). */
  yaw?: (tS: number) => number;
  /** True while the phone is being picked up. */
  junk?: (tS: number) => boolean;
}

/** Flat phone in a mount: 50 Hz motion, 1 Hz GPS moving east. */
function drive({ durationS, speed, horiz = () => 0, yaw = () => 0, junk = () => false }: Drive) {
  const d = createMotionDetector();
  const out: DraftEvent[] = [];
  d.subscribe((e) => out.push(e));
  for (let ms = 0; ms <= durationS * 1000; ms += 20) {
    const tS = ms / 1000;
    const t = T0 + ms;
    if (ms % 1000 === 0) {
      const lon = -80.19 + tS * 1e-4;
      d.onGps({ t, lat: 25.76, lon, speedMps: speed(tS), heading: 90, accuracyM: 5 });
    }
    d.onMotion(
      sample({
        t,
        acc: vec(horiz(tS), 0, 0),
        // Flat phone: gravity axis is −z, so rotation −ω about z reads as yaw +ω.
        rot: vec(junk(tS) ? PIPELINE.junkRotationRadPerS * 2 : 0, 0, -yaw(tS)),
      }),
    );
  }
  return out;
}

const between = (from: number, to: number, v: number) => (tS: number) =>
  tS >= from && tS < to ? v : 0;
/** Speed that changes by `rate` m/s² between `from` and `to` seconds. */
const ramp = (v0: number, from: number, to: number, rate: number) => (tS: number) =>
  v0 + rate * (Math.min(Math.max(tS, from), to) - from);

describe('createMotionDetector', () => {
  it('detects a coach hard brake while GPS speed drops', () => {
    const out = drive({ durationS: 8, speed: ramp(15, 2, 5, -4), horiz: between(2, 5, 4) });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: 'hard_brake', tier: 'coach' });
    expect(out[0]!.peak).toBeCloseTo(4, 1);
    expect(out[0]!.durationS).toBeGreaterThan(1);
    expect(out[0]!.speedMph).toBeLessThan(15 * MPS_TO_MPH);
  });

  it('detects a harsh brake', () => {
    const out = drive({ durationS: 8, speed: ramp(15, 2, 5, -5), horiz: between(2, 5, 5) });
    expect(out.map((e) => [e.type, e.tier])).toEqual([['hard_brake', 'harsh']]);
  });

  it('calls the same force hard acceleration when GPS speed rises', () => {
    const out = drive({ durationS: 8, speed: ramp(5, 2, 5, 3.5), horiz: between(2, 5, 3.5) });
    expect(out.map((e) => e.type)).toEqual(['hard_accel']);
  });

  it('ignores a pothole-length spike', () => {
    const out = drive({ durationS: 6, speed: ramp(15, 2, 5, -1), horiz: between(3.1, 3.3, 5) });
    expect(out).toEqual([]);
  });

  it('merges two brakes within the merge window, keeps them apart otherwise', () => {
    const twoBrakes = (gapS: number) => {
      const end1 = 4;
      const start2 = end1 + gapS;
      return drive({
        durationS: start2 + 6,
        speed: (tS) => ramp(20, 2, end1, -4)(tS) + ramp(0, start2, start2 + 2, -4)(tS),
        horiz: (tS) => between(2, end1, 4)(tS) + between(start2, start2 + 2, 4)(tS),
      }).filter((e) => e.type === 'hard_brake');
    };
    expect(twoBrakes(1)).toHaveLength(1);
    expect(twoBrakes(PIPELINE.mergeWindowS + 3)).toHaveLength(2);
  });

  it('detects a rough turn with a large heading change', () => {
    // 12 m/s × 0.3 rad/s = 3.6 m/s² lateral for 3 s (≈ 50° of heading).
    const out = drive({ durationS: 6, speed: () => 12, yaw: between(1, 4, 0.3) });
    expect(out.map((e) => [e.type, e.tier])).toEqual([['rough_turn', 'coach']]);
    expect(out[0]!.peak).toBeCloseTo(3.6, 1);
  });

  it('detects a harsh rough turn', () => {
    const out = drive({ durationS: 6, speed: () => 12, yaw: between(1, 4, 0.4) });
    expect(out.map((e) => [e.type, e.tier])).toEqual([['rough_turn', 'harsh']]);
  });

  it('does not call a short, sharp lateral jolt a turn', () => {
    // 3.6 m/s² for 0.8 s is only ≈ 14° of heading.
    expect(drive({ durationS: 4, speed: () => 12, yaw: between(1, 1.8, 0.3) })).toEqual([]);
  });

  it('skips lateral rules below the minimum speed', () => {
    const slow = PIPELINE.minSpeedForLateralMps * 0.9;
    expect(drive({ durationS: 6, speed: () => slow, yaw: between(1, 4, 5 / slow) })).toEqual([]);
  });

  it('detects a swerve: lateral flips sign with little net heading change', () => {
    // 15 m/s: ±0.3 rad/s → ±4.5 m/s² lateral, 0.6 s each way.
    const yaw = (tS: number) => between(1, 1.6, 0.3)(tS) + between(1.6, 2.2, -0.3)(tS);
    const out = drive({ durationS: 5, speed: () => 15, yaw });
    expect(out.map((e) => [e.type, e.tier])).toEqual([['swerve', 'harsh']]);
  });

  it('does not report swerves below the swerve minimum speed', () => {
    // 6 m/s (≈ 22 km/h): above the lateral gate, below 25 km/h. ±0.5 rad/s → ±3 m/s².
    const yaw = (tS: number) => between(1, 1.6, 0.5)(tS) + between(1.6, 2.2, -0.5)(tS);
    const out = drive({ durationS: 5, speed: () => 6, yaw });
    expect(out.filter((e) => e.type === 'swerve')).toEqual([]);
  });

  it('discards an event in progress when the phone is picked up', () => {
    const out = drive({
      durationS: 8,
      speed: ramp(15, 2, 5, -4),
      horiz: between(2, 5, 4),
      junk: (tS) => tS >= 3.5 && tS < 3.6,
    });
    // The part before the pickup is dropped; the tail after it restarts from zero.
    for (const e of out) expect(new Date(e.at).getTime()).toBeGreaterThanOrEqual(T0 + 3600);
  });

  it('pauses while the phone is handled and resumes once it settles', () => {
    const d = createMotionDetector();
    d.onMotion(sample({}));
    expect(d.isPaused()).toBe(false);
    d.onMotion(sample({ rot: vec(PIPELINE.junkRotationRadPerS * 2, 0, 0) }));
    expect(d.isPaused()).toBe(true);
    d.onMotion(sample({}));
    expect(d.isPaused()).toBe(false);
  });

  it('reset clears the paused flag', () => {
    const d = createMotionDetector();
    d.onMotion(sample({ accG: vec(0, 0, -PIPELINE.junkAccelMps2 * 2) }));
    d.reset();
    expect(d.isPaused()).toBe(false);
  });
});
