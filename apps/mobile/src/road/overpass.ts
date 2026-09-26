/**
 * Overpass API types and query builder (master doc §8). Pure.
 *
 * Only the fields we use are typed. Response comes from `[out:json]` + `out geom`,
 * see fixtures/overpass.response.json for a sample.
 */

export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

export interface OverpassNode {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

export interface OverpassWay {
  type: 'way';
  id: number;
  geometry: { lat: number; lon: number }[];
  tags?: Record<string, string>;
}

export interface OverpassResponse {
  elements: (OverpassNode | OverpassWay)[];
}

/**
 * Query for drivable ways and stop signs within `radiusM` of a point.
 * TODO(WS2, §8): write and test the real query, e.g.
 *   [out:json][timeout:25];
 *   ( way(around:R,LAT,LON)[highway~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service)(_link)?$"];
 *     node(around:R,LAT,LON)[highway=stop]; );
 *   out geom;
 */
export function buildOverpassQuery(_lat: number, _lon: number, _radiusM: number): string {
  throw new Error('TODO(WS2): buildOverpassQuery not implemented');
}

/**
 * Parse an OSM `maxspeed` value to mph ("40 mph" → 40, "50" (km/h) → 31, "none"/"signals" → null).
 * TODO(WS2, §8): implement and unit test.
 */
export function parseMaxspeedMph(_value: string | undefined): number | null {
  return null;
}
