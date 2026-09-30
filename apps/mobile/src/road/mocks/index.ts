/**
 * Road mocks (WS2). Realistic fake behavior backed by fixtures/overpass.response.json.
 *
 * - MockRoadCache: nearest vertex of the fixture ways; `maxspeed` "NN mph" → posted,
 *   otherwise the road-class default → inferred. Good enough for the fixture drive,
 *   NOT a reference for the real matcher.
 * - MockRoadEventDetector: replays the fixture's speeding and rolling_stop events in
 *   step with the GPS stream, and signals the live alert for a harsh posted-limit
 *   speeding event when it arrives.
 */
import { createFixtureEventReplayer, overpassFixture } from '@eduway/fixtures';
import { ROAD, type GpsFix } from '@eduway/shared';

import type {
  RoadCache,
  RoadEventDetector,
  RoadLiveAlert,
  RoadMatch,
  StopSign,
} from '../../contracts';
import { haversineM } from '../geo';
import type { OverpassResponse, OverpassWay } from '../overpass';

const data = overpassFixture as OverpassResponse;
const ways = data.elements.filter((e): e is OverpassWay => e.type === 'way');
const stopSigns: StopSign[] = data.elements.flatMap((e) =>
  e.type === 'node' && e.tags?.highway === 'stop'
    ? [
        {
          nodeId: e.id,
          location: { type: 'Point' as const, coordinates: [e.lon, e.lat] as [number, number] },
          direction: e.tags.direction ?? null,
        },
      ]
    : [],
);

function toMatch(way: OverpassWay): RoadMatch {
  const posted = way.tags?.maxspeed?.match(/^(\d+)\s*mph$/);
  const roadClass = way.tags?.highway ?? null;
  const inferred = roadClass ? ROAD.defaultLimitMphByClass[roadClass] : undefined;
  return {
    wayId: way.id,
    street: way.tags?.name ?? null,
    roadClass,
    limitMph: posted ? Number(posted[1]) : (inferred ?? null),
    limitConfidence: posted ? 'posted' : inferred !== undefined ? 'inferred' : 'unknown',
  };
}

/**
 * Distance from a fix to the closest segment of a way, using a flat local
 * projection (fine at street scale). Mock-only; no heading tie-break.
 */
function distanceToWayM(fix: GpsFix, way: OverpassWay): number {
  const mPerDegLat = 111_320;
  const mPerDegLon = mPerDegLat * Math.cos((fix.lat * Math.PI) / 180);
  const xy = (p: { lat: number; lon: number }) => ({
    x: (p.lon - fix.lon) * mPerDegLon,
    y: (p.lat - fix.lat) * mPerDegLat,
  });
  let min = Infinity;
  for (let i = 1; i < way.geometry.length; i++) {
    const a = xy(way.geometry[i - 1]!);
    const b = xy(way.geometry[i]!);
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const t = Math.max(0, Math.min(1, -(a.x * abx + a.y * aby) / (abx * abx + aby * aby || 1)));
    min = Math.min(min, Math.hypot(a.x + t * abx, a.y + t * aby));
  }
  return min;
}

export function createMockRoadCache(): RoadCache {
  let lastFetchAt: number | null = null;
  return {
    async ensureAround() {
      lastFetchAt ??= Date.now();
    },
    match(fix: GpsFix) {
      let best: { way: OverpassWay; d: number } | null = null;
      for (const way of ways) {
        // Skip the fixture's service road so a parking aisle never wins.
        if (way.tags?.highway === 'service') continue;
        const d = distanceToWayM(fix, way);
        if (!best || d < best.d) best = { way, d };
      }
      return best && best.d <= ROAD.maxMatchDistanceM ? toMatch(best.way) : null;
    },
    stopSignsNear(fix, radiusM) {
      return stopSigns.filter(
        (s) =>
          haversineM(fix.lat, fix.lon, s.location.coordinates[1], s.location.coordinates[0]) <=
          radiusM,
      );
    },
    getStatus: () => ({
      center: null,
      radiusM: ROAD.overpassRadiusM,
      wayCount: ways.length,
      stopSignCount: stopSigns.length,
      lastFetchAt,
      fetching: false,
      lastError: null,
    }),
    clear() {
      lastFetchAt = null;
    },
  };
}

export function createMockRoadEventDetector(): RoadEventDetector {
  const replayer = createFixtureEventReplayer(['speeding', 'rolling_stop']);
  return {
    onGps: (fix, match) => {
      const events = replayer.advance(fix);
      // Fixture events arrive complete, so a harsh speeding one alerts on arrival
      // (posted limits only, like the real detector).
      const alerts: RoadLiveAlert[] =
        events.some((e) => e.type === 'speeding' && e.tier === 'harsh') &&
        match?.limitConfidence === 'posted' &&
        match.limitMph != null
          ? [{ type: 'speeding', limitMph: match.limitMph }]
          : [];
      return { events, alerts };
    },
    reset: () => replayer.reset(),
  };
}
