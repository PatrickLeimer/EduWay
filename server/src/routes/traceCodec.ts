/**
 * Decodes `traceGzipB64` from POST /trips (base64 → gunzip → JSON → schema).
 * Mirror of apps/mobile/src/api/traceCodec.ts. Also builds the small
 * routePreview line stored on the trip for lists (§9).
 */
import { gunzipSync } from 'node:zlib';

import { TraceUploadSchema, type GeoLineString, type TraceUpload } from '@edudriver/shared';

import { HttpError } from './http';

export function decodeTraceUpload(b64: string): TraceUpload {
  let json: unknown;
  try {
    json = JSON.parse(gunzipSync(Buffer.from(b64, 'base64')).toString('utf8'));
  } catch (e) {
    throw new HttpError(400, 'traceGzipB64 is not valid gzip+base64 JSON', String(e));
  }
  const parsed = TraceUploadSchema.safeParse(json);
  if (!parsed.success) throw new HttpError(400, 'Invalid trace', parsed.error.issues);
  const { t, lat, lon, speedMps, heading, accuracyM } = parsed.data;
  const n = t.length;
  if ([lat, lon, speedMps, heading, accuracyM].some((col) => col.length !== n)) {
    throw new HttpError(400, 'Trace columns must all have the same length');
  }
  return parsed.data;
}

/**
 * Simplified route for trip lists and thumbnails.
 * TODO(WS3): replace every-Nth-point sampling with Douglas-Peucker if thumbnails look jagged.
 */
export function buildRoutePreview(trace: TraceUpload, maxPoints = 100): GeoLineString {
  const n = trace.t.length;
  const step = Math.max(1, Math.ceil(n / maxPoints));
  const coordinates: [number, number][] = [];
  for (let i = 0; i < n; i += step) coordinates.push([trace.lon[i]!, trace.lat[i]!]);
  if (n > 0 && (n - 1) % step !== 0) coordinates.push([trace.lon[n - 1]!, trace.lat[n - 1]!]);
  return { type: 'LineString', coordinates };
}
