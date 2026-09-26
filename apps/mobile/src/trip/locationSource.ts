/**
 * GPS input for the trip session (WS2). Internal to trip/, not a cross-module
 * contract: the session owns the single GPS subscription and fans fixes out to
 * detection/ and road/.
 */
import type { GpsFix } from '@edudriver/shared';

export interface LocationSource {
  /** Resolves once permission is granted and fixes are flowing (~1 Hz). */
  start(onFix: (fix: GpsFix) => void): Promise<void>;
  stop(): void;
}

/**
 * Real source over expo-location. STUB.
 * Docs (SDK 57): https://docs.expo.dev/versions/v57.0.0/sdk/location/
 */
export function createExpoLocationSource(): LocationSource {
  return {
    async start(_onFix) {
      // TODO(WS2, §5): requestForegroundPermissionsAsync(); watchPositionAsync(
      //   { accuracy: BestForNavigation, timeInterval: PIPELINE.gpsIntervalMs, distanceInterval: 0 },
      //   loc => onFix({ t: loc.timestamp, lat, lon, speedMps: coords.speed, heading, accuracyM })).
      //   coords.speed is m/s and heading is degrees from north (may be null / -1: map to null).
      console.warn('[trip] expoLocationSource is a stub; no fixes will be produced');
    },
    stop() {
      // TODO(WS2): subscription.remove().
    },
  };
}
