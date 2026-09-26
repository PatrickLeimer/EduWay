import { G, PIPELINE, type MotionSample } from '@edudriver/shared';
import { describe, expect, it } from 'vitest';

import { createMotionDetector } from './MotionDetector';
import { vec } from './vector';

const sample = (over: Partial<MotionSample>): MotionSample => ({
  t: 0,
  acc: vec(0, 0, 0),
  accG: vec(0, 0, -G),
  rot: vec(0, 0, 0),
  ...over,
});

describe('createMotionDetector junk rejection', () => {
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
