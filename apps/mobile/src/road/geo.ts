/**
 * Geodesy helpers for way matching and stop-sign distance (master doc §8). Pure.
 */

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in meters between two lat/lon points. */
export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/** Smallest absolute difference between two headings, in degrees (0-180). */
export function headingDiffDeg(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

const M_PER_DEG_LAT = 111_320;

/** Initial bearing in degrees clockwise from true north. */
export function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const midLat = (lat1 + lat2) / 2;
  const north = (lat2 - lat1) * M_PER_DEG_LAT;
  const east = (lon2 - lon1) * M_PER_DEG_LAT * Math.cos(toRad(midLat));
  if (north === 0 && east === 0) return 0;
  const deg = (Math.atan2(east, north) * 180) / Math.PI;
  return (deg + 360) % 360;
}

export interface SegmentHit {
  distanceM: number;
  /** Bearing along the segment from the first point to the second, degrees. */
  bearingDeg: number;
}

/**
 * Closest point on a polyline to (lat, lon), in a flat local projection.
 * Fine at street scale (master doc §8 way matching).
 */
export function closestSegment(
  lat: number,
  lon: number,
  geometry: readonly { lat: number; lon: number }[],
): SegmentHit | null {
  if (geometry.length < 2) return null;
  const mPerDegLon = M_PER_DEG_LAT * Math.cos(toRad(lat));
  const xy = (p: { lat: number; lon: number }) => ({
    x: (p.lon - lon) * mPerDegLon,
    y: (p.lat - lat) * M_PER_DEG_LAT,
  });
  let best: SegmentHit | null = null;
  for (let i = 1; i < geometry.length; i++) {
    const aPt = geometry[i - 1]!;
    const bPt = geometry[i]!;
    const a = xy(aPt);
    const b = xy(bPt);
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const denom = abx * abx + aby * aby;
    const t = denom === 0 ? 0 : Math.max(0, Math.min(1, -(a.x * abx + a.y * aby) / denom));
    const distanceM = Math.hypot(a.x + t * abx, a.y + t * aby);
    if (!best || distanceM < best.distanceM) {
      best = { distanceM, bearingDeg: bearingDeg(aPt.lat, aPt.lon, bPt.lat, bPt.lon) % 360 };
    }
  }
  return best;
}
