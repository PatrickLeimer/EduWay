/**
 * Pure way matching and cache-edge checks (master doc §8, §15).
 * Fetching lives in OverpassRoadCache; this file stays free of network and Expo.
 */
import { ROAD, type GeoPoint, type GpsFix } from '@edudriver/shared';

import type { RoadMatch, StopSign } from '../contracts';
import { closestSegment, haversineM, headingDiffDeg } from './geo';
import { parseMaxspeedMph, type CachedWay } from './overpass';

/**
 * Two ways this close count as a tie, and heading picks the winner (§8, §15).
 * Not a §7 event threshold — it is only the matcher's tie band.
 */
export const HEADING_TIE_MARGIN_M = 12;

/** True when `fix` is inside the margin of the cached disc's edge, or there is no cache (§8). */
export function needsRefetch(center: GeoPoint | null, radiusM: number, fix: GpsFix): boolean {
  if (!center) return true;
  const [lon, lat] = center.coordinates;
  const d = haversineM(lat, lon, fix.lat, fix.lon);
  return d >= radiusM - ROAD.refetchEdgeMarginM;
}

export function limitForWay(way: CachedWay): Pick<RoadMatch, 'limitMph' | 'limitConfidence'> {
  const posted = parseMaxspeedMph(way.maxspeed ?? undefined);
  if (posted != null) return { limitMph: posted, limitConfidence: 'posted' };
  const inferred = way.highway ? ROAD.defaultLimitMphByClass[way.highway] : undefined;
  if (inferred !== undefined) return { limitMph: inferred, limitConfidence: 'inferred' };
  return { limitMph: null, limitConfidence: 'unknown' };
}

function toMatch(way: CachedWay): RoadMatch {
  return {
    wayId: way.id,
    street: way.name,
    roadClass: way.highway,
    ...limitForWay(way),
  };
}

interface Candidate {
  way: CachedWay;
  distanceM: number;
  bearingDeg: number;
}

/**
 * Heading error of a way, degrees. Two-way roads match either direction.
 * `oneway=yes` only matches the geometry direction; `-1` / `reverse` only the opposite.
 */
function headingPenalty(carHeading: number, bearing: number, oneway: string | null): number {
  const forward = headingDiffDeg(carHeading, bearing);
  const backward = headingDiffDeg(carHeading, (bearing + 180) % 360);
  if (oneway === 'yes') return forward;
  if (oneway === '-1' || oneway === 'reverse') return backward;
  return Math.min(forward, backward);
}

/**
 * Nearest cached way within `ROAD.maxMatchDistanceM`. When several ways are
 * within `HEADING_TIE_MARGIN_M` of the nearest, the car's heading breaks the tie.
 */
export function matchFix(fix: GpsFix, ways: readonly CachedWay[]): RoadMatch | null {
  const candidates: Candidate[] = [];
  for (const way of ways) {
    const hit = closestSegment(fix.lat, fix.lon, way.geometry);
    if (!hit || hit.distanceM > ROAD.maxMatchDistanceM) continue;
    candidates.push({ way, distanceM: hit.distanceM, bearingDeg: hit.bearingDeg });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.distanceM - b.distanceM || a.way.id - b.way.id);
  const nearest = candidates[0]!;
  if (fix.heading == null) return toMatch(nearest.way);
  const band = candidates.filter((c) => c.distanceM <= nearest.distanceM + HEADING_TIE_MARGIN_M);
  band.sort(
    (a, b) =>
      headingPenalty(fix.heading!, a.bearingDeg, a.way.oneway) -
        headingPenalty(fix.heading!, b.bearingDeg, b.way.oneway) ||
      a.distanceM - b.distanceM ||
      a.way.id - b.way.id,
  );
  return toMatch(band[0]!.way);
}

/**
 * Compass heading a stop sign applies to, or null when it applies to every heading.
 * Numeric `direction` is used as degrees. `forward` / `backward` follow the nearest way.
 */
export function resolveStopHeadingDeg(sign: StopSign, ways: readonly CachedWay[]): number | null {
  if (!sign.direction) return null;
  const text = sign.direction.trim().toLowerCase();
  const asNum = Number(text);
  if (text !== '' && Number.isFinite(asNum)) return ((asNum % 360) + 360) % 360;
  if (text !== 'forward' && text !== 'backward') return null;
  const [lon, lat] = sign.location.coordinates;
  let best: { id: number; d: number; bearing: number } | null = null;
  for (const way of ways) {
    const hit = closestSegment(lat, lon, way.geometry);
    if (!hit) continue;
    if (
      !best ||
      hit.distanceM < best.d - 0.5 ||
      (Math.abs(hit.distanceM - best.d) <= 0.5 && way.id < best.id)
    ) {
      best = { id: way.id, d: hit.distanceM, bearing: hit.bearingDeg };
    }
  }
  if (!best) return null;
  return text === 'forward' ? best.bearing % 360 : (best.bearing + 180) % 360;
}

const headings = new WeakMap<object, Map<number, number>>();

/** Remember resolved stop headings for a cache object. The detector reads them back. */
export function bindStopHeadings(
  cache: object,
  stops: readonly StopSign[],
  ways: readonly CachedWay[],
): void {
  const map = new Map<number, number>();
  for (const stop of stops) {
    const deg = resolveStopHeadingDeg(stop, ways);
    if (deg != null && stop.direction) map.set(stop.nodeId, deg);
  }
  headings.set(cache, map);
}

export function clearStopHeadings(cache: object): void {
  headings.delete(cache);
}

/** Resolved compass heading for a tagged stop, if the cache computed one. */
export function stopHeadingDeg(cache: object, nodeId: number): number | undefined {
  return headings.get(cache)?.get(nodeId);
}
