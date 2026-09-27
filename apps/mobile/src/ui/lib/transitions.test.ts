import { describe, expect, it } from 'vitest';

import { routeKey, transitionFor } from './transitions';

describe('transitionFor', () => {
  it('slides forward into deeper screens and back out of them', () => {
    expect(transitionFor('start', 'list')).toBe('forward');
    expect(transitionFor('list', 'replay')).toBe('forward');
    expect(transitionFor('ended', 'replay')).toBe('forward');
    expect(transitionFor('replay', 'infractions')).toBe('forward');
    expect(transitionFor('infractions', 'growth')).toBe('forward');
    expect(transitionFor('growth', 'coach')).toBe('forward');
    expect(transitionFor('coach', 'growth')).toBe('back');
    expect(transitionFor('coach', 'start')).toBe('back');
  });

  it('rises into driving mode and fades out of it', () => {
    expect(transitionFor('start', 'driving')).toBe('up');
    expect(transitionFor('driving', 'ended')).toBe('fade');
  });

  it('cross-fades between screens on the same level', () => {
    expect(transitionFor('list', 'progress')).toBe('fade');
  });
});

describe('routeKey', () => {
  it('includes the trip id so two trips animate separately', () => {
    expect(routeKey({ name: 'coach', tripId: 'a', origin: 'trip' })).toBe('coach:a');
    expect(routeKey({ name: 'list' })).toBe('list');
  });
});
