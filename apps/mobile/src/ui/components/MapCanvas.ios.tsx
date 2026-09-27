/**
 * iPhone map: real Google Maps (Maps JavaScript API) inside a WebView, because
 * Expo Go's iOS binary can't show the native Google Maps SDK. Same props and
 * behavior as NativeMapCanvas: route line, pins, car dot, follow, fit, dark.
 *
 * Google Maps only, never Apple Maps. If there is no
 * EXPO_PUBLIC_GOOGLE_MAPS_API_KEY, Google rejects the key, the Maps script
 * can't download, or the map isn't up in time, the map area says why.
 * Page + bridge: lib/googleMapHtml.ts.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import {
  applyStateScript,
  googleMapHtml,
  googleMapsKey,
  WEB_MAP_BASE_URL,
  type WebMapState,
} from '../lib/googleMapHtml';
import { colors, font, fonts, mapDarkStyle, space } from '../theme';
import type { MapCanvasProps } from './mapTypes';

export function MapCanvas(props: MapCanvasProps) {
  const key = googleMapsKey();
  const [failed, setFailed] = useState<string | null>(null);
  if (!key || failed) {
    const reason = key
      ? failed
      : 'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY missing (restart Expo with --clear)';
    return <MapMessage style={props.style} dark={props.dark} text={`Google Maps: ${reason}`} />;
  }
  return (
    <GoogleWebMap
      {...props}
      apiKey={key}
      onFail={(message) => {
        console.warn('[MapCanvas.ios] Google Maps failed:', message);
        setFailed(message);
      }}
    />
  );
}

function MapMessage({
  style,
  dark = false,
  text,
}: {
  style: MapCanvasProps['style'];
  dark?: boolean;
  text: string;
}) {
  return (
    <View
      style={[styles.empty, { backgroundColor: dark ? colors.driveBg : colors.surfaceAlt }, style]}
    >
      <Text style={[styles.emptyText, dark && styles.emptyTextDark]}>{text}</Text>
    </View>
  );
}

function GoogleWebMap({
  style,
  route,
  pins,
  car,
  follow,
  fitTo,
  interactive = true,
  dark = false,
  apiKey,
  onFail,
}: MapCanvasProps & { apiKey: string; onFail: (message: string) => void }) {
  const web = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const background = dark ? colors.driveBg : colors.surfaceAlt;

  // The page is built once per key/theme; everything else goes through applyState.
  const html = useMemo(
    () =>
      googleMapHtml(apiKey, {
        background,
        routeColor: colors.route,
        carColor: colors.location,
        darkStyle: mapDarkStyle,
      }),
    [apiKey, background],
  );

  const state: WebMapState = {
    route: route ?? [],
    pins: pins ?? [],
    car: car ?? null,
    follow: follow ?? null,
    fitTo: fitTo ?? [],
    interactive,
    dark,
  };
  const script = applyStateScript(state);
  useEffect(() => {
    if (ready) web.current?.injectJavaScript(script);
  }, [ready, script]);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as { type: string; message?: string };
      if (msg.type === 'ready') setReady(true);
      if (msg.type === 'error') onFail(msg.message ?? 'failed to load');
      if (msg.type === 'log') console.warn('[MapCanvas.ios] map page:', msg.message);
    } catch {
      // Ignore anything that isn't our bridge.
    }
  };

  // Same "Waiting for GPS" state as the native map until there is somewhere to look.
  if ((fitTo?.length ?? 0) === 0 && !follow) {
    return <MapMessage style={style} dark={dark} text="Waiting for GPS…" />;
  }

  return (
    // Non-interactive maps let touches fall through (driving mode reports them as phone use).
    <View
      style={[{ backgroundColor: background }, style]}
      pointerEvents={interactive ? 'auto' : 'none'}
    >
      <WebView
        ref={web}
        style={[StyleSheet.absoluteFill, { backgroundColor: background }]}
        source={{ html, baseUrl: WEB_MAP_BASE_URL }}
        originWhitelist={['*']}
        onMessage={onMessage}
        scrollEnabled={false}
        bounces={false}
        javaScriptEnabled
        setSupportMultipleWindows={false}
        // Links inside the map (Google logo, terms) open outside the app.
        onShouldStartLoadWithRequest={(req) => {
          if (req.isTopFrame === false || req.url.startsWith(WEB_MAP_BASE_URL)) return true;
          if (req.url.startsWith('about:')) return true;
          void Linking.openURL(req.url);
          return false;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center', padding: space.lg },
  emptyText: {
    fontFamily: fonts.regular,
    color: colors.textMuted,
    fontSize: font.body,
    textAlign: 'center',
  },
  emptyTextDark: { color: colors.textOnDarkMuted },
});
