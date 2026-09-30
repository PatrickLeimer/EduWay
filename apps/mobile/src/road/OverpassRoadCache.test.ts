import { overpassFixture } from '@eduway/fixtures';
import { describe, expect, it } from 'vitest';

import type { GpsFix } from '@eduway/shared';

import { createOverpassRoadCache } from './OverpassRoadCache';
import type { OverpassResponse } from './overpass';

const data = overpassFixture as OverpassResponse;

function fix(lat: number, lon: number): GpsFix {
  return { t: 1, lat, lon, speedMps: 10, heading: 90, accuracyM: 5 };
}

describe('OverpassRoadCache', () => {
  it('fetches once inside the disc, again near the edge, and keeps data when offline', async () => {
    const queries: string[] = [];
    let fail = false;
    const cache = createOverpassRoadCache(async (query) => {
      queries.push(query);
      if (fail) throw new Error('offline');
      return data;
    });

    await cache.ensureAround(fix(25.76, -80.37));
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain('25.76,-80.37');
    expect(cache.getStatus().wayCount).toBeGreaterThan(0);
    expect(cache.match(fix(25.7625, -80.36))).toMatchObject({
      street: 'SW 8th St',
      limitConfidence: 'posted',
      limitMph: 40,
    });

    await cache.ensureAround(fix(25.7601, -80.37));
    expect(queries).toHaveLength(1);

    fail = true;
    const before = cache.getStatus().wayCount;
    await cache.ensureAround(fix(25.78, -80.37));
    expect(queries).toHaveLength(2);
    expect(cache.getStatus().lastError).toBe('offline');
    expect(cache.getStatus().wayCount).toBe(before);
    expect(cache.getStatus().fetching).toBe(false);
    expect(cache.match(fix(25.7625, -80.36))?.street).toBe('SW 8th St');
  });
});
