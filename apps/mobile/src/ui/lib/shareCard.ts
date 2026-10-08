/**
 * Share card helpers (master doc §12 "Share card"): the route with a privacy
 * zone cut off each end, fitted into a box as an SVG polyline, and the stats
 * printed on the card. Pure (no React Native), tested in shareCard.test.ts.
 */
import { SHARE_CARD, type Trip } from '@eduway/shared';

import { durationText, milesText, secondsBetween } from './format';
import type { MapPoint } from './geo';

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function metersBetween(a: MapPoint, b: MapPoint): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Drops every point within `trimM` (measured along the route) of the start and
 * of the end, so the image never shows where the drive began or ended. A route
 * too short to keep anything comes back empty and the card shows no line.
 */
export function trimRoute(points: MapPoint[], trimM: number = SHARE_CARD.privacyTrimM): MapPoint[] {
  if (points.length < 2) return [];
  const along = [0];
  for (let i = 1; i < points.length; i++) {
    along.push(along[i - 1]! + metersBetween(points[i - 1]!, points[i]!));
  }
  const total = along[along.length - 1]!;
  const kept = points.filter((_, i) => along[i]! >= trimM && along[i]! <= total - trimM);
  return kept.length >= 2 ? kept : [];
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Fits the route into `box` keeping its shape (north up, longitude scaled by
 * latitude) and centers it. Returns an SVG `points` string, or '' for no route.
 */
export function routePolyline(points: MapPoint[], box: Box): string {
  if (points.length < 2) return '';
  const cosLat = Math.cos(toRad(points[0]!.latitude));
  const xs = points.map((p) => p.longitude * cosLat);
  const ys = points.map((p) => -p.latitude);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX;
  const spanY = Math.max(...ys) - minY;
  const scale = Math.min(box.width / (spanX || 1e-9), box.height / (spanY || 1e-9));
  const offX = box.x + (box.width - spanX * scale) / 2;
  const offY = box.y + (box.height - spanY * scale) / 2;
  return xs
    .map(
      (x, i) =>
        `${(offX + (x - minX) * scale).toFixed(1)},${(offY + (ys[i]! - minY) * scale).toFixed(1)}`,
    )
    .join(' ');
}

export interface ShareStat {
  label: string;
  value: string;
}

/** Distance, time and (when the drive was scored) score. */
export function shareStats(
  trip: Pick<Trip, 'distanceMi' | 'startedAt' | 'endedAt' | 'score'>,
): ShareStat[] {
  const stats = [
    { label: 'Distance', value: milesText(trip.distanceMi) },
    { label: 'Time', value: durationText(secondsBetween(trip.startedAt, trip.endedAt)) },
  ];
  if (trip.score !== null) stats.push({ label: 'Score', value: String(Math.round(trip.score)) });
  return stats;
}

/** Splits text into lines of at most `maxChars` (SVG text does not wrap), at most `maxLines`. */
export function wrapText(text: string, maxChars: number, maxLines = 3): string[] {
  const lines: string[] = [];
  for (const word of text.trim().split(/\s+/)) {
    const last = lines[lines.length - 1];
    if (last !== undefined && (last + ' ' + word).length <= maxChars)
      lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1]!.replace(/[.,!?]*$/, '')}…`;
  return kept;
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Base64 (optionally a data: URL) → bytes, for writing the PNG to a file. */
export function bytesFromBase64(input: string): Uint8Array {
  const b64 = input.replace(/^data:[^,]*,/, '').replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((b64.length * 3) / 4));
  let n = 0;
  for (let i = 0; i < b64.length; i += 4) {
    const [a, b, c, d] = [0, 1, 2, 3].map((k) => BASE64.indexOf(b64[i + k] ?? 'A'));
    const bits = (a! << 18) | (b! << 12) | (c! << 6) | d!;
    out[n++] = (bits >> 16) & 255;
    if (i + 2 < b64.length) out[n++] = (bits >> 8) & 255;
    if (i + 3 < b64.length) out[n++] = bits & 255;
  }
  return out.subarray(0, n);
}
