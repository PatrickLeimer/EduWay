/**
 * Map for the WS2 debug screen.
 *
 * Android (Expo Go): Google Maps SDK, route polyline, and the Maps heatmap.
 * iOS (Expo Go): Apple Maps. Expo Go's iOS binary does not include this
 * project's Google Maps key, and PROVIDER_GOOGLE draws a blank view there.
 * Incident locations are circles on iOS. The browser build is Ws2Map.web.tsx.
 * OpenStreetMap still supplies street and limit text; it is not the basemap.
 *
 * The camera follows GPS (keeping the user's zoom) until the map is dragged;
 * "Follow GPS" turns following back on.
 */
import { useEffect, useRef, useState } from 'react';
import { Button, Dimensions, Platform, View } from 'react-native';
import MapView, { Circle, Heatmap, Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

import type { Ws2MapProps } from './ws2MapTypes';

const HEAT_GRADIENT = {
  colors: ['#c8e6c9', '#ffeb3b', '#ff9800', '#f44336'],
  startPoints: [0.1, 0.4, 0.7, 1],
  colorMapSize: 256,
};

const GOOGLE = Platform.OS === 'android';

export function Ws2Map({ latitude, longitude, route, heat }: Ws2MapProps) {
  const width = Dimensions.get('window').width;
  const map = useRef<MapView | null>(null);
  const [follow, setFollow] = useState(true);
  const [initialRegion] = useState({
    latitude,
    longitude,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  });

  useEffect(() => {
    if (follow) map.current?.animateCamera({ center: { latitude, longitude } }, { duration: 300 });
  }, [follow, latitude, longitude]);

  return (
    <View>
      <MapView
        ref={map}
        provider={GOOGLE ? PROVIDER_GOOGLE : undefined}
        googleRenderer={GOOGLE ? 'LEGACY' : undefined}
        style={{ width, height: 360 }}
        initialRegion={initialRegion}
        onPanDrag={() => setFollow(false)}
        mapType="standard"
      >
        {route.length > 1 ? (
          <Polyline coordinates={route} strokeColor="#1a73e8" strokeWidth={4} />
        ) : null}
        {GOOGLE && heat.length > 0 ? (
          <Heatmap points={heat} radius={40} opacity={0.75} gradient={HEAT_GRADIENT} />
        ) : null}
        {!GOOGLE
          ? heat.map((point, index) => (
              <Circle
                key={`${point.latitude},${point.longitude},${index}`}
                center={point}
                radius={point.weight >= 1 ? 70 : 45}
                fillColor={point.weight >= 1 ? 'rgba(244,67,54,0.45)' : 'rgba(255,152,0,0.4)'}
                strokeColor="rgba(183,28,28,0.9)"
                strokeWidth={1}
              />
            ))
          : null}
        <Marker coordinate={{ latitude, longitude }} title="GPS" />
      </MapView>
      {!follow ? <Button title="Follow GPS" onPress={() => setFollow(true)} /> : null}
    </View>
  );
}
