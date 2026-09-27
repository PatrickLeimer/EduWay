/**
 * The one map component every screen uses (react-native-maps, §8 "Display").
 *
 * Android: Google Maps SDK. iOS: Apple Maps, because Expo Go's iOS binary has
 * no Google Maps key and PROVIDER_GOOGLE draws a blank view there (same choice
 * as ui/dev/Ws2Map.tsx). Browser: MapCanvas.web.tsx.
 * OpenStreetMap supplies street and limit text elsewhere; it is not the basemap.
 */
import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

import { regionFor } from '../lib/geo';
import { colors, font } from '../theme';
import type { MapCanvasProps } from './mapTypes';

const GOOGLE = Platform.OS === 'android';

/** Google Maps night style for driving mode (Android; iOS uses userInterfaceStyle). */
const DARK_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1d2126' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a9099' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1d2126' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2e343c' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c434d' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1318' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

const FOLLOW_DELTA = 0.01;

export function MapCanvas({
  style,
  route,
  pins,
  car,
  follow,
  fitTo,
  interactive = true,
  dark = false,
  lite = false,
}: MapCanvasProps) {
  const map = useRef<MapView | null>(null);

  // MapView reads initialRegion only on mount; after that, follow animates the camera.
  const initialRegion =
    regionFor(fitTo ?? []) ??
    (follow ? { ...follow, latitudeDelta: FOLLOW_DELTA, longitudeDelta: FOLLOW_DELTA } : null);

  const followLat = follow?.latitude;
  const followLon = follow?.longitude;
  useEffect(() => {
    if (followLat == null || followLon == null) return;
    map.current?.animateCamera(
      { center: { latitude: followLat, longitude: followLon } },
      { duration: 500 },
    );
  }, [followLat, followLon]);

  if (!initialRegion) {
    return (
      <View style={[styles.empty, dark && styles.emptyDark, style]}>
        <Text style={[styles.emptyText, dark && styles.emptyTextDark]}>Waiting for GPS…</Text>
      </View>
    );
  }

  return (
    <View style={style} pointerEvents={interactive ? 'auto' : 'none'}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        provider={GOOGLE ? PROVIDER_GOOGLE : undefined}
        googleRenderer={GOOGLE ? 'LEGACY' : undefined}
        initialRegion={initialRegion}
        customMapStyle={GOOGLE && dark ? DARK_STYLE : undefined}
        userInterfaceStyle={dark ? 'dark' : 'light'}
        liteMode={GOOGLE && lite}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={interactive}
        pitchEnabled={interactive}
        toolbarEnabled={false}
        showsPointsOfInterests={!dark}
        showsCompass={false}
      >
        {route && route.length > 1 ? (
          <Polyline coordinates={route} strokeColor={colors.route} strokeWidth={5} />
        ) : null}
        {pins?.map((p) => (
          <Marker
            key={p.id}
            coordinate={p}
            pinColor={p.color}
            title={p.title}
            description={p.description}
            tracksViewChanges={false}
          />
        ))}
        {car ? (
          <Marker coordinate={car} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={styles.carOuter}>
              <View style={styles.carInner} />
            </View>
          </Marker>
        ) : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  emptyDark: { backgroundColor: colors.driveBg },
  emptyText: { color: colors.textMuted, fontSize: font.body },
  emptyTextDark: { color: colors.textOnDarkMuted },
  carOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carInner: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.location },
});
