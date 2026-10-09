/**
 * Native map (react-native-maps, §8 "Display"). Screens use MapCanvas, which
 * picks this on phones: the Google Maps SDK on Android, Apple Maps on iPhone
 * (Expo Go's iOS binary has no Google Maps SDK, and neither needs a key in the
 * app). Browser: MapCanvas.web.tsx.
 * OpenStreetMap supplies street and limit text elsewhere; it is not the basemap.
 */
import { Fragment, useEffect, useImperativeHandle, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

import { regionFor } from '../lib/geo';
import { colors, font, fonts, mapDarkStyle } from '../theme';
import type { MapCanvasProps } from './mapTypes';

const FOLLOW_DELTA = 0.01;
/** Google on Android; undefined = the platform map (Apple Maps) on iPhone. */
const PROVIDER = Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined;

export function NativeMapCanvas({
  style,
  route,
  routes,
  pins,
  car,
  follow,
  fitTo,
  interactive = true,
  dark = false,
  lite = false,
  satellite = false,
  boldRoute = false,
  onLoaded,
  snapshotRef,
}: MapCanvasProps) {
  const map = useRef<MapView | null>(null);
  useImperativeHandle(
    snapshotRef,
    () => ({
      take: async (width, height) => {
        if (!map.current) throw new Error('Map not ready');
        return map.current.takeSnapshot({
          width,
          height,
          format: 'jpg',
          quality: 0.9,
          result: 'base64',
        });
      },
    }),
    [],
  );

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
        provider={PROVIDER}
        googleRenderer="LEGACY"
        initialRegion={initialRegion}
        mapType={satellite ? 'satellite' : 'standard'}
        // Android reports tiles drawn; Apple's snapshotter waits for its own tiles.
        onMapLoaded={onLoaded}
        onMapReady={Platform.OS === 'ios' ? onLoaded : undefined}
        customMapStyle={dark ? mapDarkStyle : undefined}
        userInterfaceStyle={dark ? 'dark' : 'light'}
        liteMode={lite}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={interactive}
        pitchEnabled={interactive}
        toolbarEnabled={false}
        showsPointsOfInterests={!dark}
        showsCompass={false}
      >
        {(routes ?? (route && route.length > 1 ? [route] : [])).map((path, i) =>
          path.length > 1 ? (
            boldRoute ? (
              <Fragment key={i}>
                <Polyline coordinates={path} strokeColor={colors.onColor} strokeWidth={12} />
                <Polyline coordinates={path} strokeColor={colors.route} strokeWidth={7} />
              </Fragment>
            ) : (
              <Polyline key={i} coordinates={path} strokeColor={colors.route} strokeWidth={5} />
            )
          ) : null,
        )}
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
  emptyText: { fontFamily: fonts.regular, color: colors.textMuted, fontSize: font.body },
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
