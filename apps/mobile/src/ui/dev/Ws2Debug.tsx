/**
 * WS2 debug screen (owned by WS2). Google Maps shows the GPS position, the
 * route, and a heatmap of incident locations. OpenStreetMap (Overpass) supplies
 * the street, class, and speed limit printed under the map.
 */
import { useMemo } from 'react';
import { Platform, Text, View } from 'react-native';

import type { TraceUpload } from '@eduway/shared';

import { useMapGps, useTripState } from '../../trip';
import { Json } from '../Json';
import type { ScreenProps } from '../navigation';
import { Ws2Map } from './Ws2Map';
import type { HeatPoint, MapPoint } from './ws2MapTypes';

function routeFromTrace(trace: TraceUpload): MapPoint[] {
  const points: MapPoint[] = [];
  for (let i = 0; i < trace.lat.length; i++) {
    const latitude = trace.lat[i];
    const longitude = trace.lon[i];
    if (latitude == null || longitude == null) continue;
    points.push({ latitude, longitude });
  }
  return points;
}

/** Shown until the phone reports a fix, so the Google map still mounts. */
const MAP_FALLBACK = { latitude: 25.761, longitude: -80.3685 };

export function Ws2Debug({ modules }: ScreenProps) {
  const state = useTripState(modules.trip);
  const { fix, error } = useMapGps(modules.trip);
  // Memoized so the map only redraws when the trace or events actually change.
  const route = useMemo(
    () => (state.traceLength > 0 ? routeFromTrace(modules.trip.getTrace()) : []),
    [modules.trip, state.traceLength],
  );
  const heat = useMemo<HeatPoint[]>(
    () =>
      state.events.map((event) => ({
        latitude: event.location.coordinates[1],
        longitude: event.location.coordinates[0],
        weight: event.tier === 'harsh' ? 1 : 0.5,
      })),
    [state.events],
  );
  const center = fix ? { latitude: fix.lat, longitude: fix.lon } : (route[0] ?? MAP_FALLBACK);

  return (
    <View>
      <Text>WS2 Road + trip</Text>
      <Text>
        {Platform.OS === 'ios'
          ? 'Map: GPS position, route, and incident locations. Expo Go on iPhone draws Apple Maps; the Google key is used in the browser.'
          : 'Google Maps: GPS position, route, and incident heatmap.'}
      </Text>
      <Text>Road data under the map is OpenStreetMap via Overpass (street, class, limit).</Text>
      <View style={{ width: '100%' }}>
        <Ws2Map latitude={center.latitude} longitude={center.longitude} route={route} heat={heat} />
      </View>
      {!fix ? (
        <Text>{error ?? 'Waiting for GPS… the map is on the demo area until then.'}</Text>
      ) : null}
      <Text>© OpenStreetMap contributors</Text>
      <Text>
        Trip status: {state.status} · fixes: {state.traceLength} · events: {state.events.length}
      </Text>
      <Text>Latest fix:</Text>
      <Json value={fix} />
      <Text>Road match (latest fix):</Text>
      <Json value={fix ? modules.roadCache.match(fix) : null} />
      <Text>Road cache status:</Text>
      <Json value={modules.roadCache.getStatus()} />
    </View>
  );
}
