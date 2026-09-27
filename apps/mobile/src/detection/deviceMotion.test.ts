import { describe, expect, it } from 'vitest';

import { toMotionSample, type DeviceMotionReading } from './deviceMotion';

const still: DeviceMotionReading = {
  acceleration: { x: 0, y: 0, z: 0 },
  accelerationIncludingGravity: { x: 0, y: 0, z: -9.81 },
  rotationRate: { alpha: 0, beta: 0, gamma: 0 },
};

describe('toMotionSample', () => {
  it('passes accelerations through in m/s²', () => {
    const s = toMotionSample({ ...still, acceleration: { x: 1, y: 2, z: 3 } }, 'android', 1234);
    expect(s).toEqual({
      t: 1234,
      acc: { x: 1, y: 2, z: 3 },
      accG: { x: 0, y: 0, z: -9.81 },
      rot: { x: 0, y: 0, z: 0 },
    });
  });

  it('maps Android rotationRate alpha/beta/gamma to x/y/z and converts deg/s to rad/s', () => {
    const s = toMotionSample(
      { ...still, rotationRate: { alpha: 180, beta: 90, gamma: 45 } },
      'android',
      0,
    );
    expect(s?.rot.x).toBeCloseTo(Math.PI);
    expect(s?.rot.y).toBeCloseTo(Math.PI / 2);
    expect(s?.rot.z).toBeCloseTo(Math.PI / 4);
  });

  it('maps iOS rotationRate alpha → z, gamma → x', () => {
    const s = toMotionSample(
      { ...still, rotationRate: { alpha: 180, beta: 90, gamma: 45 } },
      'ios',
      0,
    );
    expect(s?.rot.x).toBeCloseTo(Math.PI / 4);
    expect(s?.rot.y).toBeCloseTo(Math.PI / 2);
    expect(s?.rot.z).toBeCloseTo(Math.PI);
  });

  it('drops readings where a sensor has not reported yet', () => {
    expect(toMotionSample({ ...still, rotationRate: null }, 'android', 0)).toBeNull();
    expect(toMotionSample({ ...still, acceleration: null }, 'android', 0)).toBeNull();
    expect(
      toMotionSample({ ...still, accelerationIncludingGravity: undefined }, 'android', 0),
    ).toBeNull();
  });
});
