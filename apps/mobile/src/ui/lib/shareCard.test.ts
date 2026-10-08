import { SHARE_CARD } from '@eduway/shared';
import { describe, expect, it } from 'vitest';

import {
  bytesFromBase64,
  metersBetween,
  routePolyline,
  shareStats,
  trimRoute,
  wrapText,
} from './shareCard';

// Points ~11.1 m apart going north: 0.0001° of latitude.
const line = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ latitude: 25.7 + i * 0.0001, longitude: -80.3 }));

describe('trimRoute (privacy zone)', () => {
  it('keeps nothing within the trim distance of either end', () => {
    const route = line(100); // ~1.1 km
    const kept = trimRoute(route);
    expect(kept.length).toBeGreaterThan(2);
    expect(metersBetween(route[0]!, kept[0]!)).toBeGreaterThanOrEqual(SHARE_CARD.privacyTrimM);
    expect(metersBetween(route[route.length - 1]!, kept[kept.length - 1]!)).toBeGreaterThanOrEqual(
      SHARE_CARD.privacyTrimM,
    );
  });

  it('measures along the route, so a loop home still hides home', () => {
    const out = line(40);
    const loop = [...out, ...[...out].reverse()];
    const kept = trimRoute(loop);
    for (const p of kept)
      expect(metersBetween(loop[0]!, p)).toBeGreaterThanOrEqual(SHARE_CARD.privacyTrimM - 12);
  });

  it('returns no line for a drive too short to trim', () => {
    expect(trimRoute(line(20))).toEqual([]);
    expect(trimRoute([])).toEqual([]);
  });
});

describe('routePolyline', () => {
  const box = { x: 100, y: 200, width: 800, height: 600 };

  it('fits the route inside the box, north up', () => {
    const pts = routePolyline(line(10), box)
      .split(' ')
      .map((p) => p.split(',').map(Number) as [number, number]);
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThanOrEqual(box.x - 0.1);
      expect(x).toBeLessThanOrEqual(box.x + box.width + 0.1);
      expect(y).toBeGreaterThanOrEqual(box.y - 0.1);
      expect(y).toBeLessThanOrEqual(box.y + box.height + 0.1);
    }
    // Going north = going up the image.
    expect(pts[pts.length - 1]![1]).toBeLessThan(pts[0]![1]);
  });

  it('is empty without a route', () => {
    expect(routePolyline([], box)).toBe('');
  });
});

describe('shareStats', () => {
  const trip = {
    distanceMi: 9.43,
    startedAt: '2026-10-01T15:00:00Z',
    endedAt: '2026-10-01T15:22:00Z',
  };

  it('shows distance, time and score', () => {
    expect(shareStats({ ...trip, score: 81.6 })).toEqual([
      { label: 'Distance', value: '9.4 mi' },
      { label: 'Time', value: '22 min' },
      { label: 'Score', value: '82' },
    ]);
  });

  it('leaves the score off a passenger drive', () => {
    expect(shareStats({ ...trip, score: null }).map((s) => s.label)).toEqual(['Distance', 'Time']);
  });
});

describe('bytesFromBase64', () => {
  it('decodes plain base64 and data URLs', () => {
    const png = [137, 80, 78, 71, 13, 10];
    expect([...bytesFromBase64(Buffer.from(png).toString('base64'))]).toEqual(png);
    expect([
      ...bytesFromBase64(`data:image/png;base64,${Buffer.from('hi!!').toString('base64')}`),
    ]).toEqual([...Buffer.from('hi!!')]);
    expect([...bytesFromBase64(Buffer.from('ab').toString('base64'))]).toEqual([
      ...Buffer.from('ab'),
    ]);
  });
});

describe('wrapText', () => {
  it('wraps on word boundaries', () => {
    expect(wrapText('Your best score in five drives, and no hard braking at all.', 24)).toEqual([
      'Your best score in five',
      'drives, and no hard',
      'braking at all.',
    ]);
  });

  it('cuts to maxLines with an ellipsis', () => {
    expect(wrapText('one two three four five six', 3, 2)).toEqual(['one', 'two…']);
  });
});
