import { MPS_TO_MPH, type GpsFix } from '@edudriver/shared';
import { describe, expect, it } from 'vitest';

import type { RoadCache, RoadMatch, StopSign } from '../contracts';
import { haversineM } from './geo';
import { bindStopHeadings } from './match';
import { createRoadEventDetector } from './RoadEventDetector';
import type { CachedWay } from './overpass';

function mps(mph: number): number {
  return mph / MPS_TO_MPH;
}

function fix(p: Partial<GpsFix> & Pick<GpsFix, 't' | 'speedMps'>): GpsFix {
  return { lat: 25.76, lon: -80.37, heading: 0, accuracyM: 5, ...p };
}

function match(p: Partial<RoadMatch> = {}): RoadMatch {
  return {
    wayId: 1,
    street: 'SW 8th St',
    roadClass: 'primary',
    limitMph: 40,
    limitConfidence: 'posted',
    ...p,
  };
}

function emptyCache(signs: StopSign[] = []): RoadCache {
  return {
    async ensureAround() {},
    match: () => null,
    stopSignsNear(fix, radiusM) {
      return signs.filter(
        (s) =>
          haversineM(fix.lat, fix.lon, s.location.coordinates[1], s.location.coordinates[0]) <=
          radiusM,
      );
    },
    getStatus: () => ({
      center: null,
      radiusM: 1500,
      wayCount: 0,
      stopSignCount: signs.length,
      lastFetchAt: null,
      fetching: false,
      lastError: null,
    }),
    clear() {},
  };
}

describe('speeding', () => {
  const posted = match();

  function run(speedsMph: number[], road: RoadMatch = posted, accuracyM: number | null = 5) {
    const det = createRoadEventDetector(emptyCache());
    const events = [];
    for (let i = 0; i < speedsMph.length; i++) {
      events.push(
        ...det.onGps(fix({ t: i * 1000, speedMps: mps(speedsMph[i]!), accuracyM }), road),
      );
    }
    return events;
  }

  it('emits coach after 5 s at +5 mph and harsh only on a posted limit', () => {
    const coach = run([46, 46, 46, 46, 46, 30]);
    expect(coach).toHaveLength(1);
    expect(coach[0]).toMatchObject({ type: 'speeding', tier: 'coach', overMph: 6 });
    expect(coach[0]?.durationS).toBe(5);

    const harsh = run([56, 56, 56, 56, 56, 30]);
    expect(harsh[0]).toMatchObject({ tier: 'harsh' });
    expect(harsh[0]?.overMph).toBeCloseTo(16, 5);

    const inferred = run(
      [50, 50, 50, 50, 50, 20],
      match({ limitMph: 25, limitConfidence: 'inferred' }),
    );
    expect(inferred[0]).toMatchObject({ tier: 'coach' });
  });

  it('does not emit before 5 s or with a poor fix', () => {
    expect(run([60, 60, 60, 60, 30])).toHaveLength(0);
    expect(run([60, 60, 60, 60, 60, 60], posted, 25)).toHaveLength(0);
    expect(run([60, 60, 60, 60, 60, 60], posted, null)).toHaveLength(0);
  });
});

describe('rolling stops', () => {
  const sign: StopSign = {
    nodeId: 42,
    location: { type: 'Point', coordinates: [-80.37, 25.76] },
    direction: null,
  };

  function pass(speedsMph: number[], heading: number | null = 0, direction: string | null = null) {
    const stops = [{ ...sign, direction }];
    const cache = emptyCache(stops);
    const det = createRoadEventDetector(cache);
    const events = [];
    const lats = [25.7603, 25.76, 25.76, 25.7603];
    for (let i = 0; i < lats.length; i++) {
      const speed = speedsMph[Math.min(i, speedsMph.length - 1)]!;
      events.push(
        ...det.onGps(fix({ t: i * 1000, lat: lats[i]!, speedMps: mps(speed), heading }), null),
      );
    }
    return events;
  }

  it('logs a coach rolling stop when the minimum stays above 2 mph', () => {
    const events = pass([10, 5, 5, 10]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'rolling_stop', tier: 'coach' });
    expect(events[0]?.minSpeedMph).toBeCloseTo(5, 5);
  });

  it('does not log a stop that reaches 2 mph, or a sign faced the wrong way', () => {
    expect(pass([10, 2, 5, 10])).toHaveLength(0);
    expect(pass([10, 8, 8, 10], 0, '180')).toHaveLength(0);
    expect(pass([10, 8, 8, 10], 0, '0')).toHaveLength(1);
  });

  it('matches forward and backward against the way the sign sits on', () => {
    const way: CachedWay = {
      id: 1,
      geometry: [
        { lat: 25.759, lon: -80.37 },
        { lat: 25.761, lon: -80.37 },
      ],
      name: null,
      highway: 'residential',
      oneway: null,
      maxspeed: null,
    };
    const stops = [{ ...sign, direction: 'forward' }];
    const cache = emptyCache(stops);
    bindStopHeadings(cache, stops, [way]);
    const det = createRoadEventDetector(cache);
    const step = (heading: number, lat: number, t: number) =>
      det.onGps(fix({ t, lat, speedMps: mps(8), heading }), null);

    expect(step(0, 25.7603, 0)).toHaveLength(0);
    expect(step(0, 25.76, 1000)).toHaveLength(0);
    expect(step(0, 25.7603, 2000)).toHaveLength(1);

    det.reset();
    expect(step(180, 25.7603, 3000)).toHaveLength(0);
    expect(step(180, 25.76, 4000)).toHaveLength(0);
    expect(step(180, 25.7603, 5000)).toHaveLength(0);
  });
});
