/**
 * Browser build of the WS2 map.
 *
 * With EXPO_PUBLIC_GOOGLE_MAPS_API_KEY this loads the Maps JavaScript API
 * (roadmap, polyline, visualization.HeatmapLayer).
 * Without a key, Expo web cannot call that API, so the same screen shows the
 * Google Maps embed centered on the GPS fix. Phones use Ws2Map.tsx (Maps SDK).
 */
import { createElement, useEffect, useRef, useState, type ComponentType, type Ref } from 'react';
import { Text, View } from 'react-native';

import type { Ws2MapProps } from './ws2MapTypes';

interface GoogleMaps {
  Map: new (el: object, opts: object) => GoogleMap;
  Polyline: new (opts: object) => Overlay;
  Marker: new (opts: object) => Overlay;
  LatLng: new (lat: number, lng: number) => object;
  visualization: { HeatmapLayer: new (opts: object) => Overlay };
}

interface GoogleMap {
  setCenter: (c: { lat: number; lng: number }) => void;
}

interface Overlay {
  setMap: (map: GoogleMap | null) => void;
}

interface Browser {
  google?: { maps?: GoogleMaps };
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

function loadGoogleMaps(key: string): Promise<GoogleMaps> {
  if (browser.google?.maps?.visualization) return Promise.resolve(browser.google.maps);
  loading ??= new Promise((resolve, reject) => {
    const script = browser.document.createElement('script');
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=visualization`;
    script.onload = () => {
      if (browser.google?.maps?.visualization) resolve(browser.google.maps);
      else reject(new Error('Google Maps JavaScript API failed to load'));
    };
    script.onerror = () => reject(new Error('Google Maps JavaScript API failed to load'));
    browser.document.head.appendChild(script);
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

function GoogleMapsJs({ latitude, longitude, route, heat }: Ws2MapProps) {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
  const host = useRef<object | null>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const overlays = useRef<Overlay[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadGoogleMaps(apiKey)
      .then((maps) => {
        if (cancelled || !host.current) return;
        const map =
          mapRef.current ??
          new maps.Map(host.current, {
            center: { lat: latitude, lng: longitude },
            zoom: 15,
            mapTypeId: 'roadmap',
          });
        mapRef.current = map;
        map.setCenter({ lat: latitude, lng: longitude });
        for (const overlay of overlays.current) overlay.setMap(null);
        const next: Overlay[] = [
          new maps.Polyline({
            map,
            path: route.map((p) => ({ lat: p.latitude, lng: p.longitude })),
            strokeColor: '#1a73e8',
            strokeWeight: 4,
          }),
          new maps.Marker({ map, position: { lat: latitude, lng: longitude }, title: 'GPS' }),
        ];
        if (heat.length > 0) {
          next.push(
            new maps.visualization.HeatmapLayer({
              map,
              radius: 30,
              data: heat.map((p) => ({
                location: new maps.LatLng(p.latitude, p.longitude),
                weight: p.weight,
              })),
            }),
          );
        }
        overlays.current = next;
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Google Maps failed to load');
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey, latitude, longitude, route, heat]);

  if (error) return <Text>{error}</Text>;
  return createElement(Div, { ref: host, style: { width: '100%', height: 360 } });
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
