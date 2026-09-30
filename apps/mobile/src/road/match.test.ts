import { overpassFixture } from '@eduway/fixtures';
import { describe, expect, it } from 'vitest';

import type { GpsFix } from '@eduway/shared';

import type { StopSign } from '../contracts';
import { matchFix, needsRefetch, resolveStopHeadingDeg } from './match';
import { parseOverpass, type CachedWay, type OverpassResponse } from './overpass';

const parsed = parseOverpass(overpassFixture as OverpassResponse);

function fix(p: Partial<GpsFix> & Pick<GpsFix, 'lat' | 'lon'>): GpsFix {
  return {
    t: 0,
    speedMps: 10,
    heading: null,
    accuracyM: 5,
    ...p,
  };
}

describe('matchFix against the Overpass fixture', () => {
  it('matches the residential avenue with an inferred limit', () => {
    const match = matchFix(fix({ lat: 25.758, lon: -80.3685, heading: 0 }), parsed.ways);
    expect(match).toMatchObject({
      wayId: 1001,
      street: 'SW 107th Ave',
      roadClass: 'residential',
      limitMph: 25,
      limitConfidence: 'inferred',
    });
  });

  it('matches the posted primary road', () => {
    const match = matchFix(fix({ lat: 25.7625, lon: -80.36, heading: 90 }), parsed.ways);
    expect(match).toMatchObject({
      wayId: 1002,
      street: 'SW 8th St',
      roadClass: 'primary',
      limitMph: 40,
      limitConfidence: 'posted',
    });
  });

  it('uses heading to break the tie at the intersection', () => {
    const corner = { lat: 25.7625, lon: -80.3685 };
    expect(matchFix(fix({ ...corner, heading: 0 }), parsed.ways)?.wayId).toBe(1001);
    expect(matchFix(fix({ ...corner, heading: 90 }), parsed.ways)?.wayId).toBe(1002);
  });
});

describe('oneway heading', () => {
  const north: CachedWay = {
    id: 1,
    geometry: [
      { lat: 0, lon: 0 },
      { lat: 0.001, lon: 0 },
    ],
    name: 'Northbound',
    highway: 'primary',
    oneway: 'yes',
    maxspeed: '40 mph',
  };
  const south: CachedWay = {
    id: 2,
    geometry: [
      { lat: 0.001, lon: 0 },
      { lat: 0, lon: 0 },
    ],
    name: 'Southbound',
    highway: 'primary',
    oneway: 'yes',
    maxspeed: '40 mph',
  };

  it('picks the carriageway whose direction matches the car', () => {
    const at = { lat: 0.0005, lon: 0 };
    expect(matchFix(fix({ ...at, heading: 0 }), [north, south])?.street).toBe('Northbound');
    expect(matchFix(fix({ ...at, heading: 180 }), [north, south])?.street).toBe('Southbound');
  });
});

describe('needsRefetch', () => {
  const here = fix({ lat: 25.76, lon: -80.37 });
  const center = { type: 'Point' as const, coordinates: [-80.37, 25.76] as [number, number] };

  it('fetches with no cache, and again only near the edge', () => {
    expect(needsRefetch(null, 1500, here)).toBe(true);
    expect(needsRefetch(center, 1500, here)).toBe(false);
    expect(needsRefetch(center, 1500, { ...here, lat: here.lat + 0.02 })).toBe(true);
  });
});

describe('resolveStopHeadingDeg', () => {
  const way: CachedWay = {
    id: 1,
    geometry: [
      { lat: 0, lon: 0 },
      { lat: 0.001, lon: 0 },
    ],
    name: null,
    highway: 'residential',
    oneway: null,
    maxspeed: null,
  };
  const sign: StopSign = {
    nodeId: 7,
    location: { type: 'Point', coordinates: [0, 0.0005] },
    direction: 'forward',
  };

  it('turns forward and backward into a compass heading', () => {
    expect(resolveStopHeadingDeg(sign, [way])).toBeCloseTo(0, 5);
    expect(resolveStopHeadingDeg({ ...sign, direction: 'backward' }, [way])).toBeCloseTo(180, 5);
    expect(resolveStopHeadingDeg({ ...sign, direction: '90' }, [way])).toBe(90);
    expect(resolveStopHeadingDeg({ ...sign, direction: null }, [way])).toBeNull();
  });
});
