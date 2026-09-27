import { describe, expect, it } from 'vitest';

import { pointFromGeo, pointsFromLine, pointsFromTrace, regionFor } from './geo';

describe('GeoJSON conversion', () => {
  it('swaps [lon, lat] into latitude/longitude', () => {
    expect(pointFromGeo({ type: 'Point', coordinates: [-80.2, 25.7] })).toEqual({
      latitude: 25.7,
      longitude: -80.2,
    });
    expect(
      pointsFromLine({
        type: 'LineString',
        coordinates: [
          [-80.2, 25.7],
          [-80.1, 25.8],
        ],
      }),
    ).toEqual([
      { latitude: 25.7, longitude: -80.2 },
      { latitude: 25.8, longitude: -80.1 },
    ]);
  });

  it('reads trace columns', () => {
    expect(pointsFromTrace({ lat: [1, 2], lon: [3, 4] })).toEqual([
      { latitude: 1, longitude: 3 },
      { latitude: 2, longitude: 4 },
    ]);
  });
});

describe('regionFor', () => {
  it('returns null for no points', () => {
    expect(regionFor([])).toBeNull();
  });

  it('centers on the bounds and pads the span', () => {
    const r = regionFor(
      [
        { latitude: 25.7, longitude: -80.3 },
        { latitude: 25.8, longitude: -80.1 },
      ],
      0.5,
    );
    expect(r?.latitude).toBeCloseTo(25.75);
    expect(r?.longitude).toBeCloseTo(-80.2);
    expect(r?.latitudeDelta).toBeCloseTo(0.15);
    expect(r?.longitudeDelta).toBeCloseTo(0.3);
  });

  it('keeps a minimum span for a single point', () => {
    const r = regionFor([{ latitude: 1, longitude: 2 }], 0.25, 0.01);
    expect(r?.latitudeDelta).toBe(0.01);
    expect(r?.longitudeDelta).toBe(0.01);
  });
});
