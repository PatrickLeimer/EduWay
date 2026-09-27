/**
 * Overpass API types, query builder, and maxspeed parsing (master doc §8). Pure.
 *
 * Only the fields we use are typed. Response comes from `[out:json]` + `out geom`,
 * see fixtures/overpass.response.json for a sample.
 */
import type { StopSign } from '../contracts';

export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

/** km/h (OSM's default maxspeed unit) → mph. 50 km/h → 31 mph. */
const KMH_TO_MPH = 0.621371192;

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

/** A drivable way kept in the road cache. */
export interface CachedWay {
  id: number;
  geometry: { lat: number; lon: number }[];
  name: string | null;
  highway: string | null;
  /** OSM `oneway` tag: "yes", "-1" / "reverse", or null when two-way. */
  oneway: string | null;
  maxspeed: string | null;
}

const HIGHWAY_RE =
  '^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service)(_link)?$';

/**
 * Query for drivable ways and stop signs within `radiusM` of a point (§8).
 */
export function buildOverpassQuery(lat: number, lon: number, radiusM: number): string {
  const r = Math.round(radiusM);
  return `[out:json][timeout:25];
(
  way(around:${r},${lat},${lon})[highway~"${HIGHWAY_RE}"];
  node(around:${r},${lat},${lon})[highway=stop];
);
out geom;`;
}

const NON_NUMERIC_MAXSPEED = new Set(['none', 'signals', 'walk', 'variable', 'unlimited']);

/**
 * Parse an OSM `maxspeed` value to mph.
 * "40 mph" → 40, "50" or "50 km/h" → 31, "none" / "signals" → null.
 * A bare number is km/h, which is OSM's default. Unknown units return null.
 */
export function parseMaxspeedMph(value: string | undefined): number | null {
  if (value == null) return null;
  const first = value.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!first || NON_NUMERIC_MAXSPEED.has(first)) return null;
  const match = /^(\d+(?:\.\d+)?)\s*(mph|km\/h|kmh|kph)?$/.exec(first);
  if (!match) return null;
  const n = Number(match[1]);
  if (!Number.isFinite(n)) return null;
  const unit = match[2];
  const mph = unit === 'mph' ? n : n * KMH_TO_MPH;
  return Math.round(mph);
}

/** Split an Overpass JSON document into cacheable ways and stop signs. */
export function parseOverpass(data: OverpassResponse): { ways: CachedWay[]; stops: StopSign[] } {
  const ways: CachedWay[] = [];
  const stops: StopSign[] = [];
  for (const el of data.elements) {
    if (el.type === 'way') {
      if (!el.geometry || el.geometry.length < 2) continue;
      const oneway = el.tags?.oneway ?? null;
      ways.push({
        id: el.id,
        geometry: el.geometry,
        name: el.tags?.name ?? null,
        highway: el.tags?.highway ?? null,
        oneway: oneway === 'no' ? null : oneway,
        maxspeed: el.tags?.maxspeed ?? null,
      });
    } else if (el.type === 'node' && el.tags?.highway === 'stop') {
      stops.push({
        nodeId: el.id,
        location: { type: 'Point', coordinates: [el.lon, el.lat] },
        direction: el.tags.direction ?? null,
      });
    }
  }
  return { ways, stops };
}
