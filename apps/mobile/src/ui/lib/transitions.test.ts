import { describe, expect, it } from 'vitest';

import { routeKey, transitionFor } from './transitions';

describe('transitionFor', () => {
  it('slides forward into deeper screens and back out of them', () => {
    expect(transitionFor('start', 'list')).toBe('forward');
    expect(transitionFor('list', 'result')).toBe('forward');
    expect(transitionFor('result', 'replay')).toBe('forward');
    expect(transitionFor('replay', 'result')).toBe('back');
    expect(transitionFor('result', 'start')).toBe('back');
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
    expect(routeKey({ name: 'result', tripId: 'a' })).toBe('result:a');
    expect(routeKey({ name: 'result', tripId: null })).toBe('result:current');
    expect(routeKey({ name: 'list' })).toBe('list');
  });
});
