/**
 * Real RoadCache over the Overpass API (WS2). Master doc §8.
 *
 * Fetching (network) stays here. Parsing and matching are pure and tested
 * against fixtures/overpass.response.json.
 */
import { ROAD, type GpsFix } from '@eduway/shared';

import type { RoadCache, RoadCacheStatus, RoadMatch, StopSign } from '../contracts';
import { bindStopHeadings, clearStopHeadings, matchFix, needsRefetch } from './match';
import {
  OVERPASS_URL,
  buildOverpassQuery,
  parseOverpass,
  type CachedWay,
  type OverpassResponse,
} from './overpass';
import { haversineM } from './geo';

export type OverpassFetcher = (query: string) => Promise<OverpassResponse>;

async function fetchOverpass(query: string): Promise<OverpassResponse> {
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams({ data: query }).toString(),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  const json: unknown = await res.json();
  if (
    !json ||
    typeof json !== 'object' ||
    !('elements' in json) ||
    !Array.isArray((json as { elements: unknown }).elements)
  ) {
    throw new Error('Overpass response missing elements');
  }
  return json as OverpassResponse;
}

export function createOverpassRoadCache(fetcher: OverpassFetcher = fetchOverpass): RoadCache {
  let ways: CachedWay[] = [];
  let stops: StopSign[] = [];
  let fetchGen = 0;
  const status: RoadCacheStatus = {
    center: null,
    radiusM: ROAD.overpassRadiusM,
    wayCount: 0,
    stopSignCount: 0,
    lastFetchAt: null,
    fetching: false,
    lastError: null,
  };

  const cache: RoadCache = {
    async ensureAround(fix: GpsFix) {
      if (status.fetching) return;
      if (!needsRefetch(status.center, status.radiusM, fix)) return;
      const gen = ++fetchGen;
      status.fetching = true;
      try {
        const query = buildOverpassQuery(fix.lat, fix.lon, ROAD.overpassRadiusM);
        const json = await fetcher(query);
        if (gen !== fetchGen) return;
        const parsed = parseOverpass(json);
        ways = parsed.ways;
        stops = parsed.stops;
        bindStopHeadings(cache, stops, ways);
        status.center = { type: 'Point', coordinates: [fix.lon, fix.lat] };
        status.wayCount = ways.length;
        status.stopSignCount = stops.length;
        status.lastFetchAt = Date.now();
        status.lastError = null;
      } catch (e) {
        // Offline or Overpass down: keep the previous cache (§18 flag 1).
        if (gen === fetchGen) status.lastError = e instanceof Error ? e.message : String(e);
      } finally {
        if (gen === fetchGen) status.fetching = false;
      }
    },
    match(fix: GpsFix): RoadMatch | null {
      return matchFix(fix, ways);
    },
    stopSignsNear(fix: GpsFix, radiusM: number): StopSign[] {
      return stops.filter(
        (s) =>
          haversineM(fix.lat, fix.lon, s.location.coordinates[1], s.location.coordinates[0]) <=
          radiusM,
      );
    },
    getStatus: () => ({
      ...status,
      center: status.center
        ? { type: 'Point' as const, coordinates: [...status.center.coordinates] }
        : null,
    }),
    clear() {
      fetchGen++;
      ways = [];
      stops = [];
      clearStopHeadings(cache);
      status.center = null;
      status.wayCount = 0;
      status.stopSignCount = 0;
      status.lastFetchAt = null;
      status.fetching = false;
      status.lastError = null;
    },
  };
  return cache;
}
