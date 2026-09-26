/**
 * GPS input for the trip session (WS2). Internal to trip/, not a cross-module
 * contract: the session owns the single GPS subscription and fans fixes out to
 * detection/ and road/.
 *
 * Docs (SDK 57): https://docs.expo.dev/versions/v57.0.0/sdk/location/
 * `watchPositionAsync` is foreground-only. coords.speed is m/s; heading is
 * degrees from true north and is negative when unknown.
 */
import { PIPELINE, type GpsFix } from '@edudriver/shared';

export interface LocationSource {
  /** Resolves once permission is granted and fixes are flowing (~1 Hz). */
  start(onFix: (fix: GpsFix) => void): Promise<void>;
  stop(): void;
}

interface LocationReading {
  timestamp: number;
  coords: {
    latitude: number;
    longitude: number;
    speed: number | null;
    heading: number | null;
    accuracy: number | null;
  };
}

function toFix(loc: LocationReading): GpsFix {
  const { latitude, longitude, speed, heading, accuracy } = loc.coords;
  return {
    t: loc.timestamp,
    lat: latitude,
    lon: longitude,
    speedMps: speed == null || speed < 0 ? null : speed,
    heading: heading == null || heading < 0 ? null : heading,
    accuracyM: accuracy,
  };
}

/**
 * Real source over expo-location. The import is dynamic so this module can be
 * loaded in Node tests without initializing Expo.
 */
export function createExpoLocationSource(): LocationSource {
  let sub: { remove: () => void } | null = null;
  return {
    async start(onFix) {
      const Location = await import('expo-location');
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) throw new Error('Location permission denied');
      sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: PIPELINE.gpsIntervalMs,
          distanceInterval: 0,
        },
        (loc) => onFix(toFix(loc)),
      );
    },
    stop() {
      sub?.remove();
      sub = null;
    },
  };
}
