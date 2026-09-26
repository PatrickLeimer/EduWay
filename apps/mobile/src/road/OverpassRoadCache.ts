/**
 * Real RoadCache over the Overpass API (WS2). STUB. Master doc §8.
 *
 * Keep fetching (network) separate from parsing/matching (pure) so the pure
 * parts can be tested with fixtures/overpass.response.json.
 */
import { ROAD, type GpsFix } from '@edudriver/shared';

import type { RoadCache, RoadCacheStatus, RoadMatch, StopSign } from '../contracts';

export function createOverpassRoadCache(): RoadCache {
  const status: RoadCacheStatus = {
    center: null,
    radiusM: ROAD.overpassRadiusM,
    wayCount: 0,
    stopSignCount: 0,
    lastFetchAt: null,
    fetching: false,
    lastError: null,
  };

  return {
    async ensureAround(_fix: GpsFix) {
      // TODO(WS2, §8): if no cache, or fix is within ROAD.refetchEdgeMarginM of the cache
      //   edge, fetch buildOverpassQuery(...) from OVERPASS_URL. Never block the caller on
      //   failure: set status.lastError (offline, §18 flag 1) and keep the old cache.
    },
    match(_fix: GpsFix): RoadMatch | null {
      // TODO(WS2, §8): nearest way within ROAD.maxMatchDistanceM, heading breaks ties.
      //   limit: parseMaxspeedMph(tags.maxspeed) → 'posted'; else
      //   ROAD.defaultLimitMphByClass[tags.highway] → 'inferred'; else 'unknown'.
      return null;
    },
    stopSignsNear(_fix: GpsFix, _radiusM: number): StopSign[] {
      // TODO(WS2, §8): filter cached highway=stop nodes by haversineM.
      return [];
    },
    getStatus: () => ({ ...status }),
    clear() {
      // TODO(WS2): drop cached ways and nodes.
    },
  };
}
