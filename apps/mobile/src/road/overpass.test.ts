import { describe, expect, it } from 'vitest';

import { ROAD } from '@edudriver/shared';

import {
  buildOverpassQuery,
  parseMaxspeedMph,
  parseOverpass,
  type OverpassResponse,
} from './overpass';

describe('buildOverpassQuery', () => {
  it('asks for drivable ways and stop signs around a point', () => {
    const q = buildOverpassQuery(25.76, -80.37, ROAD.overpassRadiusM);
    expect(q).toContain('[out:json]');
    expect(q).toContain('out geom;');
    expect(q).toContain(`way(around:${ROAD.overpassRadiusM},25.76,-80.37)`);
    expect(q).toContain(`node(around:${ROAD.overpassRadiusM},25.76,-80.37)[highway=stop]`);
    expect(q).toContain('residential');
    expect(q).toContain('motorway');
  });
});

describe('parseMaxspeedMph', () => {
  it('parses mph, default km/h, and non-numeric tags', () => {
    expect(parseMaxspeedMph('40 mph')).toBe(40);
    expect(parseMaxspeedMph('40mph')).toBe(40);
    expect(parseMaxspeedMph('50')).toBe(31);
    expect(parseMaxspeedMph('50 km/h')).toBe(31);
    expect(parseMaxspeedMph('80 km/h')).toBe(50);
    expect(parseMaxspeedMph('none')).toBeNull();
    expect(parseMaxspeedMph('signals')).toBeNull();
    expect(parseMaxspeedMph(undefined)).toBeNull();
    expect(parseMaxspeedMph('10 knots')).toBeNull();
  });
});

describe('parseOverpass', () => {
  it('keeps ways with geometry and highway=stop nodes', () => {
    const data: OverpassResponse = {
      elements: [
        {
          type: 'way',
          id: 1,
          geometry: [
            { lat: 1, lon: 2 },
            { lat: 1, lon: 3 },
          ],
          tags: { highway: 'residential', name: 'Main', maxspeed: '25 mph', oneway: 'yes' },
        },
        { type: 'node', id: 9, lat: 1, lon: 2, tags: { highway: 'stop', direction: 'forward' } },
        { type: 'node', id: 8, lat: 1, lon: 2, tags: { highway: 'traffic_signals' } },
      ],
    };
    const parsed = parseOverpass(data);
    expect(parsed.ways).toEqual([
      {
        id: 1,
        geometry: [
          { lat: 1, lon: 2 },
          { lat: 1, lon: 3 },
        ],
        name: 'Main',
        highway: 'residential',
        oneway: 'yes',
        maxspeed: '25 mph',
      },
    ]);
    expect(parsed.stops).toHaveLength(1);
    expect(parsed.stops[0]).toMatchObject({ nodeId: 9, direction: 'forward' });
  });
});
