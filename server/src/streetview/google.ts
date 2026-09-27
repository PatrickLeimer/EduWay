/**
 * Google Street View, server side only (master doc §12 "Street View callout").
 * - Metadata endpoint (free): is there outdoor imagery near the event?
 * - Static API: the thumbnail, fetched on demand and streamed through, never stored.
 * - Maps JavaScript API: a small page with a StreetViewPanorama for the app's
 *   WebView. That key is restricted by HTTP referrer to our backend's domain.
 * Keys never reach the app; it only gets our /streetview URLs.
 */
import { STREET_VIEW } from '@edudriver/shared';

export interface StreetViewService {
  /** Free metadata check: outdoor imagery within STREET_VIEW.metadataRadiusM. Errors count as "no". */
  hasCoverage(lat: number, lng: number): Promise<boolean>;
  /** The Static API image, or null when Google has none (or the call failed). */
  fetchThumbnail(
    lat: number,
    lng: number,
    heading: number,
  ): Promise<{ bytes: Buffer; contentType: string } | null>;
  /** The panorama page for the WebView, or null without a Maps JavaScript key. */
  panoramaHtml(lat: number, lng: number, heading: number): string | null;
}

export interface GoogleStreetViewOptions {
  /** GOOGLE_STREETVIEW_KEY: Static API + metadata. */
  staticKey: string;
  /** GOOGLE_MAPS_JS_KEY: Maps JavaScript API, referrer-restricted. */
  mapsJsKey?: string;
  /** Tests pass a fake. */
  fetch?: typeof fetch;
}

const BASE = 'https://maps.googleapis.com/maps/api/streetview';

export function metadataUrl(lat: number, lng: number, key: string): string {
  const q = new URLSearchParams({
    location: `${lat},${lng}`,
    radius: String(STREET_VIEW.metadataRadiusM),
    source: 'outdoor',
    key,
  });
  return `${BASE}/metadata?${q}`;
}

export function imageUrl(lat: number, lng: number, heading: number, key: string): string {
  const q = new URLSearchParams({
    size: `${STREET_VIEW.imageWidthPx}x${STREET_VIEW.imageHeightPx}`,
    location: `${lat},${lng}`,
    heading: String(heading),
    pitch: String(STREET_VIEW.pitchDeg),
    fov: String(STREET_VIEW.fovDeg),
    radius: String(STREET_VIEW.metadataRadiusM),
    source: 'outdoor',
    // A 404 instead of Google's gray "no imagery" picture, so the app can fall back.
    return_error_code: 'true',
    key,
  });
  return `${BASE}?${q}`;
}

/**
 * Full-screen StreetViewPanorama. The address overlay and extra controls are
 * off; Google's attribution stays (the API draws it and it must not be hidden).
 * Finds the nearest outdoor panorama within STREET_VIEW.metadataRadiusM (like
 * the thumbnail), and shows a short message instead of a black screen when
 * there is none or Google rejects the key (gm_authFailure).
 */
export function panoramaPage(lat: number, lng: number, heading: number, mapsJsKey: string): string {
  const where = JSON.stringify({ lat: Number(lat), lng: Number(lng) });
  const options = JSON.stringify({
    pov: { heading: Number(heading), pitch: STREET_VIEW.pitchDeg },
    zoom: 0,
    addressControl: false,
    fullscreenControl: false,
    motionTracking: false,
    motionTrackingControl: false,
    panControl: false,
    zoomControl: false,
    enableCloseButton: false,
    showRoadLabels: false,
  });
  const src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(mapsJsKey)}&callback=initPano&loading=async`;
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>Street View</title>
<style>
html, body, #pano { height: 100%; margin: 0; background: #000; }
#msg { display: none; position: absolute; inset: 0; align-items: center; justify-content: center;
  padding: 24px; color: #fff; font: 16px/1.4 -apple-system, system-ui, sans-serif; text-align: center; }
</style>
</head>
<body>
<div id="pano"></div>
<div id="msg"></div>
<script>
function showMessage(text) {
  var el = document.getElementById('msg');
  el.textContent = text;
  el.style.display = 'flex';
}
// Google calls this when it rejects the key (restrictions, API not enabled, billing).
window.gm_authFailure = function () {
  showMessage("Street View isn't available right now (Google rejected the panorama key).");
};
function initPano() {
  new google.maps.StreetViewService().getPanorama(
    { location: ${where}, radius: ${STREET_VIEW.metadataRadiusM}, source: google.maps.StreetViewSource.OUTDOOR },
    function (data, status) {
      if (status !== 'OK' || !data || !data.location) {
        showMessage("There's no Street View imagery here.");
        return;
      }
      var options = ${options};
      options.pano = data.location.pano;
      new google.maps.StreetViewPanorama(document.getElementById('pano'), options);
    }
  );
}
</script>
<script async src="${src}" onerror="showMessage('Could not load Google Maps. Check the connection.')"></script>
</body>
</html>`;
}

export function createGoogleStreetView(opts: GoogleStreetViewOptions): StreetViewService {
  const f = opts.fetch ?? fetch;
  return {
    async hasCoverage(lat, lng) {
      try {
        const res = await f(metadataUrl(lat, lng, opts.staticKey));
        if (!res.ok) return false;
        const body = (await res.json()) as { status?: string };
        return body.status === 'OK';
      } catch (e) {
        console.warn('[streetview] metadata check failed:', e);
        return false;
      }
    },
    async fetchThumbnail(lat, lng, heading) {
      try {
        const res = await f(imageUrl(lat, lng, heading, opts.staticKey));
        if (!res.ok) return null;
        return {
          bytes: Buffer.from(await res.arrayBuffer()),
          contentType: res.headers.get('content-type') ?? 'image/jpeg',
        };
      } catch (e) {
        console.warn('[streetview] thumbnail fetch failed:', e);
        return null;
      }
    },
    panoramaHtml(lat, lng, heading) {
      return opts.mapsJsKey ? panoramaPage(lat, lng, heading, opts.mapsJsKey) : null;
    },
  };
}
