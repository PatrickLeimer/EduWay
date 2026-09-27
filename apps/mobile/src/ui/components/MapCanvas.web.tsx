/**
 * Browser build of MapCanvas. react-native-maps does not run on web.
 * With EXPO_PUBLIC_GOOGLE_MAPS_API_KEY this draws the route polylines and
 * incident markers on the Maps JavaScript API. Without a key, it falls back
 * to a keyless embed centered on the route (that embed cannot draw a line).
 */
import { createElement, useEffect, useRef, useState, type ComponentType, type Ref } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { regionFor, type MapPoint } from '../lib/geo';
import { colors, font, fonts } from '../theme';
import type { MapCanvasProps, MapPin } from './mapTypes';

interface GoogleMaps {
  Map: new (el: object, opts: object) => GoogleMap;
  Polyline: new (opts: object) => Overlay;
  Marker: new (opts: object) => Overlay;
  LatLngBounds: new () => LatLngBounds;
  SymbolPath: { CIRCLE: number };
}

interface GoogleMap {
  fitBounds: (bounds: LatLngBounds, padding?: number) => void;
  setCenter: (c: { lat: number; lng: number }) => void;
  setZoom: (z: number) => void;
  panTo: (c: { lat: number; lng: number }) => void;
}

interface Overlay {
  setMap: (map: GoogleMap | null) => void;
}

interface LatLngBounds {
  extend: (p: { lat: number; lng: number }) => void;
}

interface Browser {
  google?: { maps?: GoogleMaps };
  gm_authFailure?: () => void;
  document: {
    createElement: (tag: string) => {
      src: string;
      async: boolean;
      onload: (() => void) | null;
      onerror: (() => void) | null;
    };
    head: { appendChild: (node: unknown) => void };
  };
}

const browser = globalThis as unknown as Browser;
const Div = 'div' as unknown as ComponentType<{
  ref: Ref<object | null>;
  style: { width: string; height: string };
}>;
const Frame = 'iframe' as unknown as ComponentType<{
  title: string;
  src: string;
  style: { width: string; height: string; borderWidth: number; pointerEvents?: string };
}>;

let loading: Promise<GoogleMaps> | null = null;
let onAuthFailure: (() => void) | null = null;

function loadGoogleMaps(key: string): Promise<GoogleMaps> {
  if (browser.google?.maps?.Map) return Promise.resolve(browser.google.maps);
  loading ??= new Promise<GoogleMaps>((resolve, reject) => {
    browser.gm_authFailure = () => onAuthFailure?.();
    const script = browser.document.createElement('script');
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}`;
    script.onload = () => {
      if (browser.google?.maps?.Map) resolve(browser.google.maps);
      else reject(new Error('Google Maps JavaScript API failed to load'));
    };
    script.onerror = () => reject(new Error('Google Maps JavaScript API failed to load'));
    browser.document.head.appendChild(script);
  }).catch((e: unknown) => {
    loading = null;
    throw e;
  });
  return loading;
}

function linesOf({ route, routes }: MapCanvasProps): MapPoint[][] {
  if (routes && routes.length > 0) return routes.filter((line) => line.length > 1);
  return route && route.length > 1 ? [route] : [];
}

function toLatLng(p: MapPoint): { lat: number; lng: number } {
  return { lat: p.latitude, lng: p.longitude };
}

function EmbedMap({
  style,
  interactive,
  center,
}: {
  style: MapCanvasProps['style'];
  interactive: boolean;
  center: MapPoint;
}) {
  const q = `${center.latitude},${center.longitude}`;
  return (
    <View style={style}>
      {createElement(Frame, {
        title: 'Google Maps',
        src: `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=14&output=embed`,
        style: {
          width: '100%',
          height: '100%',
          borderWidth: 0,
          pointerEvents: interactive ? 'auto' : 'none',
        },
      })}
    </View>
  );
}

function GoogleRouteMap({
  style,
  route,
  routes,
  pins,
  car,
  follow,
  fitTo,
  interactive = true,
}: MapCanvasProps) {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
  const host = useRef<object | null>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const mapsRef = useRef<GoogleMaps | null>(null);
  const overlays = useRef<Overlay[]>([]);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  const lines = linesOf({ route, routes });
  const focus = fitTo ?? [...lines.flat(), ...(pins ?? []), ...(car ? [car] : [])];
  const center = car ?? follow ?? regionFor(focus);
  const fitted = fitTo ?? lines.flat();
  const fitKey = fitted.map((p) => `${p.latitude},${p.longitude}`).join('|');
  const lineKey = lines
    .map((line) => line.map((p) => `${p.latitude},${p.longitude}`).join(';'))
    .join('#');
  const pinKey = (pins ?? [])
    .map((p) => `${p.id}:${p.latitude},${p.longitude}:${p.color}`)
    .join('|');
  const carKey = car ? `${car.latitude},${car.longitude}` : '';
  const followLat = follow?.latitude;
  const followLon = follow?.longitude;

  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;
    onAuthFailure = () => setFailed(true);
    loadGoogleMaps(apiKey)
      .then((maps) => {
        if (cancelled || !host.current || mapRef.current) return;
        const first = center ?? { latitude: 0, longitude: 0 };
        mapsRef.current = maps;
        mapRef.current = new maps.Map(host.current, {
          center: toLatLng(first),
          zoom: 14,
          disableDefaultUI: !interactive,
          gestureHandling: interactive ? 'auto' : 'none',
          clickableIcons: false,
        });
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      onAuthFailure = null;
    };
    // The map is created once. Later effects move it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, interactive]);

  useEffect(() => {
    const map = mapRef.current;
    const maps = mapsRef.current;
    if (!ready || !map || !maps) return;
    for (const overlay of overlays.current) overlay.setMap(null);
    const next: Overlay[] = lines.map(
      (path) =>
        new maps.Polyline({
          map,
          path: path.map(toLatLng),
          strokeColor: colors.route,
          strokeWeight: 5,
        }),
    );
    for (const pin of pins ?? []) next.push(marker(maps, map, pin));
    if (car) {
      next.push(
        marker(maps, map, {
          ...car,
          id: 'car',
          color: colors.location,
          title: 'You',
        }),
      );
    }
    overlays.current = next;
    // Keys stand in for the coordinate arrays, which are new objects every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, lineKey, pinKey, carKey]);

  useEffect(() => {
    const map = mapRef.current;
    const maps = mapsRef.current;
    if (!ready || !map || !maps) return;
    if (fitted.length > 1) {
      const bounds = new maps.LatLngBounds();
      for (const p of fitted) bounds.extend(toLatLng(p));
      map.fitBounds(bounds, 32);
    } else if (fitted[0]) {
      map.setCenter(toLatLng(fitted[0]));
      map.setZoom(15);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, fitKey]);

  useEffect(() => {
    if (!ready || followLat == null || followLon == null) return;
    mapRef.current?.panTo({ lat: followLat, lng: followLon });
  }, [ready, followLat, followLon]);

  if (!apiKey || failed) {
    if (!center) {
      return (
        <View style={[styles.empty, style]}>
          <Text style={styles.emptyText}>Waiting for GPS…</Text>
        </View>
      );
    }
    return <EmbedMap style={style} interactive={interactive} center={center} />;
  }

  return (
    <View style={style}>
      {createElement(Div, { ref: host, style: { width: '100%', height: '100%' } })}
    </View>
  );
}

function marker(maps: GoogleMaps, map: GoogleMap, pin: MapPin): Overlay {
  return new maps.Marker({
    map,
    position: toLatLng(pin),
    title: pin.title,
    icon: {
      path: maps.SymbolPath.CIRCLE,
      scale: 8,
      fillColor: pin.color,
      fillOpacity: 1,
      strokeColor: colors.white,
      strokeWeight: 2,
    },
  });
}

export function MapCanvas(props: MapCanvasProps) {
  const lines = linesOf(props);
  const focus = props.fitTo ?? [...lines.flat(), ...(props.pins ?? [])];
  const center = props.car ?? props.follow ?? regionFor(focus);
  if (!center && lines.length === 0) {
    return (
      <View style={[styles.empty, props.style]}>
        <Text style={styles.emptyText}>Waiting for GPS…</Text>
      </View>
    );
  }
  return <GoogleRouteMap {...props} />;
}

const styles = StyleSheet.create({
  empty: { backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: fonts.regular, color: colors.textMuted, fontSize: font.body },
});
