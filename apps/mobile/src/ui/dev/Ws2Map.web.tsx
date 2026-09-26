/**
 * Browser build of the WS2 map.
 *
 * With EXPO_PUBLIC_GOOGLE_MAPS_API_KEY this loads the Maps JavaScript API
 * (roadmap, polyline, visualization.HeatmapLayer).
 * Without a key, Expo web cannot call that API, so the same screen shows the
 * Google Maps embed centered on the GPS fix. Phones use Ws2Map.tsx (Maps SDK).
 * Like the phone map, it follows GPS until dragged; "Follow GPS" resumes.
 */
import { createElement, useEffect, useRef, useState, type ComponentType, type Ref } from 'react';
import { Button, Text, View } from 'react-native';

import type { Ws2MapProps } from './ws2MapTypes';

interface GoogleMaps {
  Map: new (el: object, opts: object) => GoogleMap;
  Polyline: new (opts: object) => Polyline;
  Marker: new (opts: object) => Marker;
  LatLng: new (lat: number, lng: number) => object;
  visualization: { HeatmapLayer: new (opts: object) => HeatmapLayer };
}

interface GoogleMap {
  setCenter: (c: { lat: number; lng: number }) => void;
  addListener: (event: string, handler: () => void) => { remove: () => void };
}

interface Polyline {
  setPath: (path: { lat: number; lng: number }[]) => void;
}

interface Marker {
  setPosition: (p: { lat: number; lng: number }) => void;
}

interface HeatmapLayer {
  setData: (data: { location: object; weight: number }[]) => void;
}

interface Browser {
  google?: { maps?: GoogleMaps };
  /** Google calls this when the API key is rejected (the script itself still loads). */
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
  style: { width: string; height: number };
}>;
const Frame = 'iframe' as unknown as ComponentType<{
  title: string;
  src: string;
  style: { width: string; height: number; borderWidth: number };
}>;

let loading: Promise<GoogleMaps> | null = null;
let onAuthFailure: (() => void) | null = null;

function loadGoogleMaps(key: string): Promise<GoogleMaps> {
  if (browser.google?.maps?.visualization) return Promise.resolve(browser.google.maps);
  loading ??= new Promise<GoogleMaps>((resolve, reject) => {
    browser.gm_authFailure = () => onAuthFailure?.();
    const script = browser.document.createElement('script');
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=visualization`;
    script.onload = () => {
      if (browser.google?.maps?.visualization) resolve(browser.google.maps);
      else reject(new Error('Google Maps JavaScript API failed to load'));
    };
    script.onerror = () => reject(new Error('Google Maps JavaScript API failed to load'));
    browser.document.head.appendChild(script);
  }).catch((e: unknown) => {
    // Let the next mount try again instead of caching the failure.
    loading = null;
    throw e;
  });
  return loading;
}

function GoogleMapsEmbed({ latitude, longitude }: Ws2MapProps) {
  const q = `${latitude},${longitude}`;
  const src = `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=15&output=embed`;
  return createElement(Frame, {
    title: 'Google Maps',
    src,
    style: { width: '100%', height: 360, borderWidth: 0 },
  });
}

interface MapObjects {
  maps: GoogleMaps;
  map: GoogleMap;
  route: Polyline;
  marker: Marker;
  heat: HeatmapLayer;
}

function GoogleMapsJs({ latitude, longitude, route, heat }: Ws2MapProps) {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
  const host = useRef<object | null>(null);
  const start = useRef({ lat: latitude, lng: longitude });
  const [objects, setObjects] = useState<MapObjects | null>(null);
  const [follow, setFollow] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create the map and its overlays once; later effects update them in place.
  useEffect(() => {
    let cancelled = false;
    let drag: { remove: () => void } | null = null;
    onAuthFailure = () => setError('Google Maps rejected EXPO_PUBLIC_GOOGLE_MAPS_API_KEY');
    loadGoogleMaps(apiKey)
      .then((maps) => {
        if (cancelled || !host.current) return;
        const map = new maps.Map(host.current, {
          center: start.current,
          zoom: 15,
          mapTypeId: 'roadmap',
        });
        drag = map.addListener('dragstart', () => setFollow(false));
        setObjects({
          maps,
          map,
          route: new maps.Polyline({ map, strokeColor: '#1a73e8', strokeWeight: 4 }),
          marker: new maps.Marker({ map, position: start.current, title: 'GPS' }),
          heat: new maps.visualization.HeatmapLayer({ map, radius: 30 }),
        });
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Google Maps failed to load');
      });
    return () => {
      cancelled = true;
      drag?.remove();
      onAuthFailure = null;
    };
  }, [apiKey]);

  useEffect(() => {
    if (!objects) return;
    const position = { lat: latitude, lng: longitude };
    objects.marker.setPosition(position);
    if (follow) objects.map.setCenter(position);
  }, [objects, follow, latitude, longitude]);

  useEffect(() => {
    objects?.route.setPath(route.map((p) => ({ lat: p.latitude, lng: p.longitude })));
  }, [objects, route]);

  useEffect(() => {
    if (!objects) return;
    const { maps } = objects;
    objects.heat.setData(
      heat.map((p) => ({ location: new maps.LatLng(p.latitude, p.longitude), weight: p.weight })),
    );
  }, [objects, heat]);

  if (error) return <Text>{error}</Text>;
  return (
    <View>
      {createElement(Div, { ref: host, style: { width: '100%', height: 360 } })}
      {!follow ? <Button title="Follow GPS" onPress={() => setFollow(true)} /> : null}
    </View>
  );
}

export function Ws2Map(props: Ws2MapProps) {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
  if (!apiKey) {
    return (
      <View>
        <GoogleMapsEmbed {...props} />
        <Text>
          Route line and incident heatmap use the Maps JavaScript API. Set
          EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to turn those on in the browser. Expo Go uses the Maps SDK
          directly.
        </Text>
      </View>
    );
  }
  return <GoogleMapsJs {...props} />;
}
