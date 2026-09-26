/**
 * Map helpers for screens: GeoJSON / trace → map points, and a camera region
 * that fits a route. Pure (no React Native), tested in geo.test.ts.
 */
import type { GeoLineString, GeoPoint, TraceUpload } from '@edudriver/shared';

export interface MapPoint {
  latitude: number;
  longitude: number;
}

export interface MapRegion extends MapPoint {
  latitudeDelta: number;
  longitudeDelta: number;
}

/** GeoJSON is [lon, lat]; maps want { latitude, longitude }. */
export function pointFromGeo(p: GeoPoint): MapPoint {
  return { latitude: p.coordinates[1], longitude: p.coordinates[0] };
}

export function pointsFromLine(line: GeoLineString): MapPoint[] {
  return line.coordinates.map(([lon, lat]) => ({ latitude: lat, longitude: lon }));
}

export function pointsFromTrace(trace: Pick<TraceUpload, 'lat' | 'lon'>): MapPoint[] {
  const out: MapPoint[] = [];
  const n = Math.min(trace.lat.length, trace.lon.length);
  for (let i = 0; i < n; i++) out.push({ latitude: trace.lat[i]!, longitude: trace.lon[i]! });
  return out;
}

/** Smallest region showing every point, with `pad` (fraction) of margin. Null for no points. */
export function regionFor(points: MapPoint[], pad = 0.25, minDelta = 0.005): MapRegion | null {
  const first = points[0];
  if (!first) return null;
  let minLat = first.latitude;
  let maxLat = first.latitude;
  let minLon = first.longitude;
  let maxLon = first.longitude;
  for (const p of points) {
    minLat = Math.min(minLat, p.latitude);
    maxLat = Math.max(maxLat, p.latitude);
    minLon = Math.min(minLon, p.longitude);
    maxLon = Math.max(maxLon, p.longitude);
  }
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: Math.max(minDelta, (maxLat - minLat) * (1 + pad)),
    longitudeDelta: Math.max(minDelta, (maxLon - minLon) * (1 + pad)),
  };
}
