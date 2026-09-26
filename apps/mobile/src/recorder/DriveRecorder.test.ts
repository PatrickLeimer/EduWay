import type { DraftEvent, GpsFix, MotionSample } from '@edudriver/shared';
import { describe, expect, it } from 'vitest';

import type { MotionDetector, RoadCache, RoadEventDetector, RoadMatch } from '../contracts';

import { createDriveRecorder, type OverpassFetch } from './DriveRecorder';
import { parseRecording } from './format';

const START = 1_700_000_000_000;

const match: RoadMatch = {
  wayId: 7,
  street: 'SW 8th St',
  roadClass: 'primary',
  limitMph: 40,
  limitConfidence: 'posted',
};

function sample(t: number): MotionSample {
  return {
    t,
    acc: { x: 1.23456, y: 0, z: 0 },
    accG: { x: 0, y: 0, z: -9.81 },
    rot: { x: 0, y: 0, z: 0.1 },
  };
}

function fix(t: number): GpsFix {
  return { t, lat: 25.76, lon: -80.37, speedMps: 10, heading: 90, accuracyM: 5 };
}

const brake: DraftEvent = {
  type: 'hard_brake',
  tier: 'harsh',
  peak: 4,
  durationS: 0.6,
  speedMph: 20,
  at: new Date(START + 1500).toISOString(),
  location: { type: 'Point', coordinates: [-80.37, 25.76] },
};

function harness(opts: { fetch?: OverpassFetch } = {}) {
  let now = START;
  let text = '';
  let onSample: ((s: MotionSample) => void) | null = null;
  let onFix: ((f: GpsFix) => void) | null = null;
  const listeners = new Set<(e: DraftEvent) => void>();
  const fed = { samples: 0, fixes: 0 };

  const detector: MotionDetector = {
    onMotion: () => void fed.samples++,
    onGps: () => void fed.fixes++,
    reset() {},
    isPaused: () => false,
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
  let fetcher: OverpassFetch | null = null;
  const cache: RoadCache = {
    async ensureAround() {
      await fetcher?.('[out:json];way(around:1500,25.76,-80.37);out geom;').catch(() => {});
      fetcher = null; // one fetch per trip in this fake
    },
    match: () => match,
    stopSignsNear: () => [],
    getStatus: () => ({
      center: null,
      radiusM: 1500,
      wayCount: 3,
      stopSignCount: 1,
      lastFetchAt: null,
      fetching: false,
      lastError: null,
    }),
    clear() {},
  };
  const roadDetector: RoadEventDetector = { onGps: () => [], reset() {} };

  const recorder = createDriveRecorder({
    motionSource: {
      async start(cb) {
        onSample = cb;
      },
      stop() {
        onSample = null;
      },
    },
    location: {
      async start(cb) {
        onFix = cb;
      },
      stop() {
        onFix = null;
      },
    },
    motionDetector: detector,
    createRoadCache: (f) => {
      fetcher = f;
      return cache;
    },
    fetchOverpass: opts.fetch ?? (async () => ({ elements: [{ type: 'node', id: 1 }] })),
    createRoadDetector: () => roadDetector,
    sink: { append: (t) => void (text += t) },
    now: () => now,
    flushEveryMs: 0,
  });

  return {
    recorder,
    fed,
    text: () => text,
    advance: (ms: number) => void (now += ms),
    now: () => now,
    sample: (t: number) => onSample?.(sample(t)),
    fix: (t: number) => onFix?.(fix(t)),
    emit: (e: DraftEvent) => listeners.forEach((l) => l(e)),
  };
}

const info = {
  platform: 'ios',
  osVersion: '18.0',
  mount: 'mounted' as const,
  thresholds: { HARD_BRAKE: { coach: { start: 2.5 } } },
};

describe('DriveRecorder', () => {
  it('writes a file that parses back to the same drive', async () => {
    const h = harness();
    await h.recorder.start(info);
    expect(h.recorder.getStatus().state).toBe('recording');

    for (let i = 0; i < 50; i++) h.sample(START + i * 20);
    h.advance(1000);
    h.fix(START + 1000);
    await Promise.resolve(); // let the background Overpass fetch settle
    await Promise.resolve();
    h.recorder.mark('hard_brake');
    h.recorder.setSegment('parking_lot');
    h.emit(brake);
    h.recorder.onAppState('background');
    h.recorder.flush();
    h.advance(500);
    h.recorder.stop();

    const rec = parseRecording(h.text());
    expect(rec.complete).toBe(true);
    expect(rec.badLines).toBe(0);
    expect(rec.header).toMatchObject({ platform: 'ios', mount: 'mounted', startMs: START });
    expect(rec.header.thresholds).toEqual(info.thresholds);
    expect(rec.samples).toHaveLength(50);
    expect(rec.samples[1]).toEqual({ ...sample(START + 20), acc: { x: 1.2346, y: 0, z: 0 } });
    expect(rec.gps).toEqual([{ k: 'gps', rt: 1000, fix: fix(START + 1000) }]);
    expect(rec.markers.map((m) => m.marker)).toEqual(['hard_brake']);
    expect(rec.segments.map((s) => s.segment)).toEqual(['parking_lot']);
    expect(rec.events).toHaveLength(1);
    expect(rec.events[0]).toMatchObject({ source: 'motion', road: match, event: brake });
    expect(rec.overpass).toHaveLength(1);
    expect(rec.overpass[0]).toMatchObject({ ok: true, response: { elements: [{ id: 1 }] } });
    expect(rec.app.map((a) => a.state)).toEqual(['background']);
    expect(rec.durationMs).toBe(1500);

    expect(h.fed).toEqual({ samples: 50, fixes: 1 });
    expect(h.recorder.getStatus()).toMatchObject({
      state: 'stopped',
      samples: 50,
      gpsFixes: 1,
      markers: 1,
      overpassOk: 1,
      segment: 'parking_lot',
    });
  });

  it('logs a failed Overpass fetch and keeps recording', async () => {
    const h = harness({
      fetch: async () => {
        throw new Error('Overpass HTTP 406');
      },
    });
    await h.recorder.start(info);
    h.fix(START);
    await Promise.resolve();
    await Promise.resolve();
    h.sample(START + 20);
    h.recorder.stop();

    const rec = parseRecording(h.text());
    expect(rec.overpass).toEqual([
      expect.objectContaining({ ok: false, error: 'Overpass HTTP 406' }),
    ]);
    expect(rec.samples).toHaveLength(1);
    expect(h.recorder.getStatus().overpassFailed).toBe(1);
  });

  it('ignores input after stop and survives a torn last line', async () => {
    const h = harness();
    await h.recorder.start(info);
    h.sample(START);
    h.recorder.stop();
    h.recorder.mark('bump');
    h.sample(START + 20);
    h.recorder.flush();

    const torn = h.text().replace(/\n$/, '') + '\n{"k":"motion","s":[[1,2';
    const rec = parseRecording(torn);
    expect(rec.samples).toHaveLength(1);
    expect(rec.markers).toHaveLength(0);
    expect(rec.badLines).toBe(1);
  });

  it('reports a sensor permission failure as an error', async () => {
    const h = harness();
    const recorder = createDriveRecorder({
      motionSource: {
        start: async () => {
          throw new Error('Motion permission denied');
        },
        stop() {},
      },
      location: { start: async () => {}, stop() {} },
      motionDetector: {
        onMotion() {},
        onGps() {},
        reset() {},
        isPaused: () => false,
        subscribe: () => () => {},
      },
      createRoadCache: () => ({}) as RoadCache,
      fetchOverpass: async () => ({}),
      createRoadDetector: () => ({ onGps: () => [], reset() {} }),
      sink: { append() {} },
      now: h.now,
      flushEveryMs: 0,
    });
    await recorder.start(info);
    expect(recorder.getStatus()).toMatchObject({
      state: 'error',
      error: 'Motion permission denied',
    });
  });
});
