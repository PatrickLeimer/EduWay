/**
 * Speeding and rolling-stop detector (WS2). Master doc §7, §8.
 * Pure logic: no React Native or Expo imports.
 */
import {
  MPS_TO_MPH,
  ROLLING_STOP,
  SPEEDING,
  type DraftEvent,
  type GpsFix,
} from '@edudriver/shared';

import type { RoadCache, RoadEventDetector, RoadMatch, StopSign } from '../contracts';
import { headingDiffDeg } from './geo';
import { stopHeadingDeg } from './match';

interface SpeedingEpisode {
  wayId: number;
  limitMph: number;
  startedAtMs: number;
  peakOverMph: number;
  peakSpeedMph: number;
  peakAtMs: number;
  peakLat: number;
  peakLon: number;
  /** Harsh only when the limit was posted and the peak cleared SPEEDING.harshOverMph. */
  harsh: boolean;
}

interface StopWindow {
  minSpeedMph: number;
  minAtMs: number;
  minLat: number;
  minLon: number;
  startedAtMs: number;
}

function mph(speedMps: number): number {
  return speedMps * MPS_TO_MPH;
}

/** Drop binary float noise before the value is stored on an event. Threshold checks use the raw number. */
function roundMph(n: number): number {
  return Math.round(n * 10) / 10;
}

function accurate(fix: GpsFix): boolean {
  return fix.accuracyM != null && fix.accuracyM < SPEEDING.maxGpsAccuracyM;
}

/** Mph over the limit, or null when this fix cannot count toward speeding. */
function overLimitMph(fix: GpsFix, match: RoadMatch | null): number | null {
  if (!match || match.limitMph == null || match.limitConfidence === 'unknown') return null;
  if (fix.speedMps == null || !accurate(fix)) return null;
  return mph(fix.speedMps) - match.limitMph;
}

function closeSpeeding(episode: SpeedingEpisode, endMs: number): DraftEvent | null {
  const durationS = (endMs - episode.startedAtMs) / 1000;
  if (durationS < SPEEDING.minDurationS) return null;
  return {
    type: 'speeding',
    tier: episode.harsh ? 'harsh' : 'coach',
    peak: roundMph(episode.peakOverMph),
    overMph: roundMph(episode.peakOverMph),
    durationS,
    speedMph: roundMph(episode.peakSpeedMph),
    at: new Date(episode.peakAtMs).toISOString(),
    location: { type: 'Point', coordinates: [episode.peakLon, episode.peakLat] },
  };
}

/**
 * A tagged stop applies only when the car's heading is within
 * ROLLING_STOP.headingToleranceDeg of the sign's direction (§8).
 * Untagged signs apply to every heading (debrief-only; cross-traffic risk).
 */
function signApplies(cache: RoadCache, sign: StopSign, heading: number | null): boolean {
  if (!sign.direction) return true;
  const text = sign.direction.trim();
  const asNum = Number(text);
  const target = text !== '' && Number.isFinite(asNum) ? asNum : stopHeadingDeg(cache, sign.nodeId);
  if (target == null || heading == null) return false;
  return headingDiffDeg(heading, target) <= ROLLING_STOP.headingToleranceDeg;
}

export function createRoadEventDetector(cache: RoadCache): RoadEventDetector {
  let speeding: SpeedingEpisode | null = null;
  const stops = new Map<number, StopWindow>();

  function closeStop(nodeId: number, endMs: number, out: DraftEvent[]) {
    const w = stops.get(nodeId);
    stops.delete(nodeId);
    if (!w || w.minSpeedMph <= ROLLING_STOP.maxStopSpeedMph) return;
    out.push({
      type: 'rolling_stop',
      tier: 'coach',
      peak: null,
      durationS: Math.max(0, (endMs - w.startedAtMs) / 1000),
      speedMph: roundMph(w.minSpeedMph),
      minSpeedMph: roundMph(w.minSpeedMph),
      at: new Date(w.minAtMs).toISOString(),
      location: { type: 'Point', coordinates: [w.minLon, w.minLat] },
    });
  }

  return {
    onGps(fix: GpsFix, match: RoadMatch | null): DraftEvent[] {
      const out: DraftEvent[] = [];
      const over = overLimitMph(fix, match);
      const speedMps = fix.speedMps;
      const speedingNow =
        over != null &&
        speedMps != null &&
        match != null &&
        match.limitMph != null &&
        over >= SPEEDING.coachOverMph;
      if (
        speedingNow &&
        match != null &&
        match.limitMph != null &&
        over != null &&
        speedMps != null
      ) {
        const harsh = match.limitConfidence === 'posted' && over >= SPEEDING.harshOverMph;
        if (!speeding || speeding.wayId !== match.wayId) {
          if (speeding) {
            const ev = closeSpeeding(speeding, fix.t);
            if (ev) out.push(ev);
          }
          speeding = {
            wayId: match.wayId,
            limitMph: match.limitMph,
            startedAtMs: fix.t,
            peakOverMph: over,
            peakSpeedMph: mph(speedMps),
            peakAtMs: fix.t,
            peakLat: fix.lat,
            peakLon: fix.lon,
            harsh,
          };
        } else if (over >= speeding.peakOverMph) {
          speeding.peakOverMph = over;
          speeding.peakSpeedMph = mph(speedMps);
          speeding.peakAtMs = fix.t;
          speeding.peakLat = fix.lat;
          speeding.peakLon = fix.lon;
          speeding.harsh = speeding.harsh || harsh;
        }
      } else if (speeding) {
        const ev = closeSpeeding(speeding, fix.t);
        if (ev) out.push(ev);
        speeding = null;
      }

      // A bad GPS fix must not open or close a stop window (a single jump
      // would fake a rolling stop). Speeding already ignored it above.
      if (fix.speedMps != null && accurate(fix)) {
        const speedMph = mph(fix.speedMps);
        const applicable = new Set<number>();
        for (const sign of cache.stopSignsNear(fix, ROLLING_STOP.signRadiusM)) {
          if (!signApplies(cache, sign, fix.heading)) continue;
          applicable.add(sign.nodeId);
          const existing = stops.get(sign.nodeId);
          if (!existing) {
            stops.set(sign.nodeId, {
              minSpeedMph: speedMph,
              minAtMs: fix.t,
              minLat: fix.lat,
              minLon: fix.lon,
              startedAtMs: fix.t,
            });
          } else if (speedMph < existing.minSpeedMph) {
            existing.minSpeedMph = speedMph;
            existing.minAtMs = fix.t;
            existing.minLat = fix.lat;
            existing.minLon = fix.lon;
          }
        }
        for (const nodeId of [...stops.keys()]) {
          if (!applicable.has(nodeId)) closeStop(nodeId, fix.t, out);
        }
      }

      return out;
    },
    reset() {
      speeding = null;
      stops.clear();
    },
  };
}
