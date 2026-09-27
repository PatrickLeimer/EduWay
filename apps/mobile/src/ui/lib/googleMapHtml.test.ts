import { describe, expect, it } from 'vitest';

import { applyStateScript, googleMapHtml, googleMapsKey, type WebMapState } from './googleMapHtml';

const opts = {
  background: '#0B0F14',
  routeColor: '#1A73E8',
  carColor: '#1A73E8',
  darkStyle: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }],
};

describe('googleMapHtml', () => {
  const html = googleMapHtml('KEY with/space', opts);

  it('loads the Maps JavaScript API with the encoded key and init callback', () => {
    expect(html).toContain(
      'https://maps.googleapis.com/maps/api/js?key=KEY%20with%2Fspace&callback=init&loading=async',
    );
  });

  it('defines the bridge React Native talks to', () => {
    expect(html).toContain('window.applyState = function');
    expect(html).toContain("send({ type: 'ready' })");
    expect(html).toContain('window.gm_authFailure');
  });

  it('uses the given colors, so the page never flashes white', () => {
    expect(html).toContain('background:#0B0F14');
    expect(html).toContain('strokeColor: "#1A73E8"');
  });
});

describe('applyStateScript', () => {
  it('injects the state as JSON and returns true (WebView requirement)', () => {
    const state: WebMapState = {
      route: [{ latitude: 1, longitude: 2 }],
      pins: [],
      car: null,
      follow: null,
      fitTo: [],
      interactive: false,
      dark: true,
    };
    const js = applyStateScript(state);
    expect(js).toContain('window.applyState(');
    expect(js).toContain('"route":[{"latitude":1,"longitude":2}]');
    expect(js.trim().endsWith('true;')).toBe(true);
  });
});

describe('googleMapsKey', () => {
  it('reads EXPO_PUBLIC_GOOGLE_MAPS_API_KEY, or empty when unset', () => {
    const before = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = 'abc';
    expect(googleMapsKey()).toBe('abc');
    delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    expect(googleMapsKey()).toBe('');
    if (before !== undefined) process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = before;
  });
});

describe('googleMapHtml fallback rules', () => {
  const html = googleMapHtml('KEY', opts);

  it('only logs ordinary script errors (Safari reports Google ones as "Script error.")', () => {
    expect(html).toContain("window.onerror = function (msg) { send({ type: 'log'");
    expect(html).not.toMatch(/window\.onerror[^\n]*type: 'error'/);
  });

  it('reports real failures: rejected key, script download, startup timeout', () => {
    expect(html).toContain('window.gm_authFailure');
    expect(html).toContain('onerror="scriptFailed()"');
    expect(html).toContain('did not load within 20 s');
  });
});
