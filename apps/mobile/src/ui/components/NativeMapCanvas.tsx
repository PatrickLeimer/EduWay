/**
 * Native map (react-native-maps, §8 "Display"). Screens use MapCanvas, which
 * picks this on Android (Google Maps SDK) and as the iPhone fallback (Apple
 * Maps: Expo Go's iOS binary has no Google Maps key, so PROVIDER_GOOGLE draws a
 * blank view there). iPhone normally uses MapCanvas.ios.tsx (Google Maps in a
 * WebView). Browser: MapCanvas.web.tsx.
 * OpenStreetMap supplies street and limit text elsewhere; it is not the basemap.
 */
import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

import { regionFor } from '../lib/geo';
import { DARK_MAP_STYLE } from '../lib/mapStyle';
import { colors, font } from '../theme';
import type { MapCanvasProps } from './mapTypes';

const GOOGLE = Platform.OS === 'android';

const FOLLOW_DELTA = 0.01;

export function NativeMapCanvas({
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
        customMapStyle={GOOGLE && dark ? DARK_MAP_STYLE : undefined}
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
