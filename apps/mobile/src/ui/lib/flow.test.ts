import { describe, expect, it } from 'vitest';

import { FLOW_STEPS, nextRoute, prevRoute, stepNumber } from './flow';

describe('post-trip flow', () => {
  it('walks replay → infractions → growth → coach', () => {
    expect(nextRoute('replay', 't', 'trip')).toEqual({
      name: 'infractions',
      tripId: 't',
      origin: 'trip',
    });
    expect(nextRoute('infractions', 't', 'trip').name).toBe('growth');
    expect(nextRoute('growth', 't', 'trip').name).toBe('coach');
  });

  it('ends on Home for the trip that just ended, Past drives for an old one', () => {
    expect(nextRoute('coach', 't', 'trip')).toEqual({ name: 'start' });
    expect(nextRoute('coach', 't', 'history')).toEqual({ name: 'list' });
  });

  it('goes back step by step, then to where the flow came from', () => {
    expect(prevRoute('coach', 't', 'history')).toEqual({
      name: 'growth',
      tripId: 't',
      origin: 'history',
    });
    expect(prevRoute('replay', 't', 'trip')).toEqual({ name: 'ended' });
    expect(prevRoute('replay', 't', 'history')).toEqual({ name: 'ended', tripId: 't' });
  });

  it('numbers the steps from 1', () => {
    expect(FLOW_STEPS.map(stepNumber)).toEqual([1, 2, 3, 4]);
  });
});
