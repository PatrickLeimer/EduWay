/**
 * WS2 Road data boundary. Master doc §8.
 * PROTECTED CONTRACT (see root CLAUDE.md).
 *
 * One Overpass cache provides street names, speed limits, road class and stop
 * signs. It is refreshed ahead of the car, never queried per GPS update.
 */
import type { DraftEvent, GeoPoint, GpsFix, LimitConfidence } from '@edudriver/shared';

/** Result of matching one GPS fix to the nearest OSM way (heading breaks ties). */
export interface RoadMatch {
  wayId: number;
  street: string | null;
  /** OSM `highway` value. */
  roadClass: string | null;
  limitMph: number | null;
  /** posted = OSM maxspeed tag; inferred = road-class default (§8). */
  limitConfidence: LimitConfidence;
}

/** OSM `highway=stop` node. */
export interface StopSign {
  nodeId: number;
  location: GeoPoint;
  /** OSM `direction` tag if present ("forward" | "backward" | degrees). Often missing (§8). */
  direction: string | null;
}

export interface RoadCacheStatus {
  /** Center of the cached area, or null before the first fetch. */
  center: GeoPoint | null;
  radiusM: number;
  wayCount: number;
  stopSignCount: number;
  lastFetchAt: number | null;
  /** True while a fetch is in flight. */
  fetching: boolean;
  /** Last fetch error, e.g. offline (§18 flag 1). Motion detection keeps working without road data. */
  lastError: string | null;
}

export interface RoadCache {
  /**
   * Make sure the area around `fix` is cached. Cheap to call on every fix:
   * only hits Overpass at trip start or near the cache edge (§8).
   */
  ensureAround(fix: GpsFix): Promise<void>;
  /** Match a fix to a way using cached data only. Null when nothing is near. */
  match(fix: GpsFix): RoadMatch | null;
  /** Stop signs within `radiusM` of the fix, from cache. */
  stopSignsNear(fix: GpsFix, radiusM: number): StopSign[];
  getStatus(): RoadCacheStatus;
  clear(): void;
}

/**
 * Speeding and rolling stop detectors (§7, §8). Pure logic over GPS + RoadCache.
 * Harsh speeding only against posted limits; rolling stops are coach tier
 * (debrief only).
 */
export interface RoadEventDetector {
  /** Returns events completed by this fix (usually empty). */
  onGps(fix: GpsFix, match: RoadMatch | null): DraftEvent[];
  reset(): void;
}
