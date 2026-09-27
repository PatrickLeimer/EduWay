import { describe, expect, it, vi } from 'vitest';

import { createGoogleStreetView, imageUrl, metadataUrl, panoramaPage } from './google';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('Street View URLs', () => {
  it('checks outdoor coverage within the search radius', () => {
    const u = new URL(metadataUrl(25.7625, -80.35, 'KEY'));
    expect(u.pathname).toBe('/maps/api/streetview/metadata');
    expect(Object.fromEntries(u.searchParams)).toEqual({
      location: '25.7625,-80.35',
      radius: '50',
      source: 'outdoor',
      key: 'KEY',
    });
  });

  it('asks for a sharp image facing the heading, and a 404 instead of the gray placeholder', () => {
    const q = new URL(imageUrl(25.7625, -80.35, 90, 'KEY')).searchParams;
    expect(q.get('size')).toBe('640x400');
    expect(q.get('heading')).toBe('90');
    expect(q.get('pitch')).toBe('0');
    expect(q.get('fov')).toBe('90');
    expect(q.get('source')).toBe('outdoor');
    expect(q.get('return_error_code')).toBe('true');
  });
});

describe('panoramaPage', () => {
  const html = panoramaPage(25.7625, -80.35, 90, 'JS_KEY');

  it('loads the Maps JavaScript API with the panorama key', () => {
    expect(html).toContain('https://maps.googleapis.com/maps/api/js?key=JS_KEY');
    expect(html).toContain('StreetViewPanorama');
  });

  it('faces the heading and hides the address overlay and clutter controls', () => {
    expect(html).toContain('"heading":90');
    expect(html).toContain('"addressControl":false');
    expect(html).toContain('"fullscreenControl":false');
    expect(html).toContain('"zoomControl":false');
  });
});

describe('createGoogleStreetView', () => {
  it('reports coverage only for status OK', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({ status: 'OK' }))
      .mockResolvedValueOnce(json({ status: 'ZERO_RESULTS' }))
      .mockRejectedValueOnce(new Error('offline'));
    const g = createGoogleStreetView({ staticKey: 'KEY', fetch });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await g.hasCoverage(1, 2)).toBe(true);
    expect(await g.hasCoverage(1, 2)).toBe(false);
    expect(await g.hasCoverage(1, 2)).toBe(false);
  });

  it('passes the image through, or null when Google has none', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/jpeg' } }),
      )
      .mockResolvedValueOnce(new Response('', { status: 404 }));
    const g = createGoogleStreetView({ staticKey: 'KEY', fetch });
    const image = await g.fetchThumbnail(1, 2, 90);
    expect(image?.contentType).toBe('image/jpeg');
    expect([...image!.bytes]).toEqual([1, 2, 3]);
    expect(await g.fetchThumbnail(1, 2, 90)).toBeNull();
  });

  it('has no panorama without a Maps JavaScript key', () => {
    expect(createGoogleStreetView({ staticKey: 'KEY' }).panoramaHtml(1, 2, 3)).toBeNull();
  });
});
