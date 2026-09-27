/**
 * The page MapCanvas.ios.tsx loads in a WebView: Google Maps JavaScript API with
 * a route polyline, pins, a car dot and camera follow/fit. React Native drives
 * it by injecting `window.applyState(state)`; the page answers with
 * postMessage({type:'ready'}) or ({type:'error', message}).
 * Pure string builder, tested in googleMapHtml.test.ts.
 */
import type { MapPoint } from './geo';

/** EXPO_PUBLIC_GOOGLE_MAPS_API_KEY from apps/mobile/.env (a public client key; restrict it in Google Cloud). */
export function googleMapsKey(): string {
  return process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
}

/** What React Native sends to the page on every change. */
export interface WebMapState {
  route: MapPoint[];
  /** Separate polylines, one per drive. Empty means draw `route` instead. */
  routes?: MapPoint[][];
  pins: (MapPoint & { id: string; color: string; title?: string })[];
  car: MapPoint | null;
  follow: MapPoint | null;
  fitTo: MapPoint[];
  interactive: boolean;
  dark: boolean;
}

/** If Google Maps isn't up after this long, the page reports an error (shown on the map area). */
export const READY_TIMEOUT_S = 20;

/** Page origin. Maps JS sees this as the referrer; allow it if the key gets referrer limits. */
export const WEB_MAP_BASE_URL = 'https://edudriver.app/';

export function googleMapHtml(
  apiKey: string,
  opts: { background: string; routeColor: string; carColor: string; darkStyle: unknown },
): string {
  return `<!doctype html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>html,body,#map{margin:0;padding:0;width:100%;height:100%;background:${opts.background};}</style>
</head><body><div id="map"></div>
<script>
var DARK = ${JSON.stringify(opts.darkStyle)};
var map, routeLines = [], car, pins = [], started = false, lastRoute = '', lastPins = '';
function send(m) { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
function ll(p) { return { lat: p.latitude, lng: p.longitude }; }
function sig(a) { var l = a[a.length - 1]; return a.length ? a.length + ':' + a[0].latitude + ',' + a[0].longitude + ':' + l.latitude + ',' + l.longitude : ''; }
function dot(color, scale) {
  return { path: google.maps.SymbolPath.CIRCLE, scale: scale, fillColor: color, fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 3 };
}
function fit(s) {
  var b = new google.maps.LatLngBounds();
  s.fitTo.forEach(function (p) { b.extend(ll(p)); });
  map.fitBounds(b, 24);
}
// Only real failures are reported as errors. Other script errors (Safari reports
// Google's cross-origin ones as "Script error.") are just logged.
window.gm_authFailure = function () {
  send({ type: 'error', message: 'Google rejected the API key (enable "Maps JavaScript API" for it)' });
};
window.onerror = function (msg) { send({ type: 'log', message: String(msg) }); };
function scriptFailed() { send({ type: 'error', message: 'Could not download Google Maps (network)' }); }
setTimeout(function () { if (!map) send({ type: 'error', message: 'Google Maps did not load within ${READY_TIMEOUT_S} s' }); }, ${READY_TIMEOUT_S * 1000});
function init() {
  try {
    map = new google.maps.Map(document.getElementById('map'), {
      center: { lat: 0, lng: 0 }, zoom: 15, disableDefaultUI: true, clickableIcons: false,
      keyboardShortcuts: false, backgroundColor: ${JSON.stringify(opts.background)}
    });
    send({ type: 'ready' });
  } catch (e) {
    send({ type: 'error', message: 'Google Maps failed to start: ' + (e && e.message) });
  }
}
window.applyState = function (s) {
  if (!map) return;
  map.setOptions({ styles: s.dark ? DARK : null, gestureHandling: s.interactive ? 'greedy' : 'none' });
  var lines = (s.routes && s.routes.length) ? s.routes : (s.route && s.route.length ? [s.route] : []);
  var r = JSON.stringify(lines);
  if (r !== lastRoute) {
    routeLines.forEach(function (line) { line.setMap(null); });
    routeLines = [];
    lines.forEach(function (path) {
      if (!path || path.length < 2) return;
      routeLines.push(new google.maps.Polyline({ map: map, path: path.map(ll), strokeColor: ${JSON.stringify(opts.routeColor)}, strokeWeight: 5, strokeOpacity: 0.95 }));
    });
    lastRoute = r;
  }
  var p = JSON.stringify(s.pins);
  if (p !== lastPins) {
    pins.forEach(function (m) { m.setMap(null); });
    pins = s.pins.map(function (pin) {
      return new google.maps.Marker({ map: map, position: ll(pin), title: pin.title || '', icon: dot(pin.color, 8) });
    });
    lastPins = p;
  }
  if (s.car) {
    if (!car) car = new google.maps.Marker({ map: map, icon: dot(${JSON.stringify(opts.carColor)}, 9), zIndex: 999 });
    car.setPosition(ll(s.car)); car.setMap(map);
  } else if (car) { car.setMap(null); }
  // Camera: fit fitTo once on first state (like initialRegion), then follow.
  if (!started) {
    if (s.fitTo.length > 1) fit(s); else if (s.follow) { map.setCenter(ll(s.follow)); map.setZoom(15); }
    started = true;
  } else if (s.follow) { map.panTo(ll(s.follow)); }
};
</script>
<script async onerror="scriptFailed()" src="https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=init&loading=async"></script>
</body></html>`;
}

/** The JS React Native injects to push a new state into the page. */
export function applyStateScript(state: WebMapState): string {
  return `window.applyState && window.applyState(${JSON.stringify(state)}); true;`;
}
