import { G, type GpsFix, type MotionSample } from '@eduway/shared';
import { describe, expect, it } from 'vitest';

import { createGpsTracker, lateralAccel, longitudinalAccel, motionFrame } from './level1';
import { vec } from './vector';

const sample = (over: Partial<MotionSample>): MotionSample => ({
  t: 0,
  acc: vec(0, 0, 0),
  accG: vec(0, 0, -G),
  rot: vec(0, 0, 0),
  ...over,
});

const fix = (t: number, speedMps: number | null, accuracyM: number | null = 5): GpsFix => ({
  t,
  lat: 25.76,
  lon: -80.19,
  speedMps,
  heading: 0,
  accuracyM,
});

describe('motionFrame', () => {
  it('takes the gravity axis from accG (pointing toward the ground)', () => {
    expect(motionFrame(sample({})).up).toEqual(vec(0, 0, -1));
  });

  it('measures yaw as rotation about gravity, for a phone lying flat', () => {
    expect(motionFrame(sample({ rot: vec(0.1, 0.2, 0.5) })).yaw).toBeCloseTo(-0.5);
  });

  it('measures yaw for a phone tilted in a mount', () => {
    // Phone upright, tilted back 30°: gravity lies in the y–z plane.
    const a = (30 * Math.PI) / 180;
    const accG = vec(0, -G * Math.cos(a), -G * Math.sin(a));
    const up = vec(0, -Math.cos(a), -Math.sin(a));
    // The car turns at 0.4 rad/s about the vertical; add a pure off-axis roll that must not count.
    const rot = vec(0.3, up.y * 0.4, up.z * 0.4);
    expect(motionFrame(sample({ accG, rot })).yaw).toBeCloseTo(0.4);
  });

  it('removes the vertical part of acc to get |h|', () => {
    // Flat phone: 3 m/s² forward, 4 m/s² horizontal sideways, 2 m/s² bump.
    expect(motionFrame(sample({ acc: vec(3, 4, 2) })).horiz).toBeCloseTo(5);
  });
});

describe('lateral and longitudinal acceleration', () => {
  it('lateral = speed × yaw', () => {
    expect(lateralAccel(10, 0.3)).toBeCloseTo(3);
    expect(lateralAccel(10, -0.3)).toBeCloseTo(-3);
  });

  it('longitudinal takes its sign from dv/dt', () => {
    expect(longitudinalAccel(3, 0, -2)).toBe(-3);
    expect(longitudinalAccel(3, 0, 1)).toBe(3);
    expect(longitudinalAccel(3, 0, 0)).toBe(0);
  });

  it('longitudinal leaves out the cornering force', () => {
    expect(longitudinalAccel(5, 3, -1)).toBeCloseTo(-4);
    expect(longitudinalAccel(5, -3, 1)).toBeCloseTo(4);
    // A pure turn (all of |h| is lateral) is neither braking nor accelerating.
    expect(longitudinalAccel(5.5, 5.5, -1)).toBeCloseTo(0);
    expect(longitudinalAccel(3, 4, 1)).toBeCloseTo(0);
  });
});

describe('createGpsTracker', () => {
  it('reports speed and dv/dt from consecutive fixes', () => {
    const gps = createGpsTracker();
    expect(gps.latest()).toBeNull();
    gps.update(fix(0, 15));
    expect(gps.latest()).toEqual({ t: 0, speedMps: 15, dvdt: 0 });
    gps.update(fix(1000, 12));
    expect(gps.latest()).toEqual({ t: 1000, speedMps: 12, dvdt: -3 });
  });

  it('ignores inaccurate fixes, fixes without speed, and out-of-order fixes', () => {
    const gps = createGpsTracker();
    gps.update(fix(0, 10));
    expect(gps.update(fix(1000, 30, 50))).toBe(false);
    expect(gps.update(fix(2000, null))).toBe(false);
    expect(gps.update(fix(0, 11))).toBe(false);
    expect(gps.latest()).toEqual({ t: 0, speedMps: 10, dvdt: 0 });
    // dv/dt spans the gap back to the last usable fix.
    gps.update(fix(2000, 14));
    expect(gps.latest()?.dvdt).toBeCloseTo(2);
  });

  it('ignores the −1 speed iOS reports when speed is unknown', () => {
    const gps = createGpsTracker();
    gps.update(fix(0, 10));
    expect(gps.update(fix(1000, -1))).toBe(false);
    expect(gps.latest()?.speedMps).toBe(10);
  });

  it('uses fixes with unknown accuracy', () => {
    const gps = createGpsTracker();
    expect(gps.update(fix(0, 10, null))).toBe(true);
  });

  it('reset clears state', () => {
    const gps = createGpsTracker();
    gps.update(fix(0, 10));
    gps.reset();
    expect(gps.latest()).toBeNull();
  });
});
