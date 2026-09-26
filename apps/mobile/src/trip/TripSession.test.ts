import { coachOutputFixture, tripFixture } from '@edudriver/fixtures';
import type { CreateTripRequest, CreateTripResponse, DraftEvent, GpsFix } from '@edudriver/shared';
import { describe, expect, it, vi } from 'vitest';

import type { MotionDetector, RoadEventDetector, RoadMatch, UploadQueueStore } from '../contracts';
import { createInMemoryUploadQueue } from './uploadQueue';
import { createTripSession } from './TripSession';

const AUDIO = 'https://example.com/debrief.mp3';

function okResponse(): CreateTripResponse {
  return { trip: tripFixture, coach: coachOutputFixture, coachAudioUrl: AUDIO };
}

function fix(t: number, speedMps: number): GpsFix {
  return { t, lat: 25.76, lon: -80.37, speedMps, heading: 0, accuracyM: 5 };
}

/** A few moving fixes, then enough stopped seconds to unlock End Trip. */
function driveThenPark(): GpsFix[] {
  const fixes: GpsFix[] = [];
  for (let i = 0; i < 5; i++) fixes.push(fix(i * 1000, 10));
  for (let i = 5; i <= 35; i++) fixes.push(fix(i * 1000, 0));
  return fixes;
}

function posted(confidence: RoadMatch['limitConfidence'] = 'posted'): RoadMatch {
  return {
    wayId: 1002,
    street: 'SW 8th St',
    roadClass: 'primary',
    limitMph: 40,
    limitConfidence: confidence,
  };
}

function harness(opts: {
  fixes: GpsFix[];
  createTrip?: (req: CreateTripRequest) => Promise<CreateTripResponse>;
  road?: RoadMatch;
  onGps?: RoadEventDetector['onGps'];
  ensureAround?: () => Promise<void>;
  motionOnGps?: MotionDetector['onGps'];
}) {
  const play = vi.fn(() => true);
  const debriefPlay = vi.fn(async (_url: string) => {});
  const activate = vi.fn(async () => {});
  const createTrip = vi.fn(opts.createTrip ?? (async () => okResponse()));
  const listeners = new Set<(e: DraftEvent) => void>();
  const motion: MotionDetector = {
    onMotion() {},
    onGps: opts.motionOnGps ?? (() => {}),
    reset() {},
    isPaused: () => false,
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
  const queue: UploadQueueStore = createInMemoryUploadQueue();
  const session = createTripSession({
    location: {
      async start(onFix) {
        for (const f of opts.fixes) onFix(f);
      },
      stop() {},
    },
    motionSource: { start: async () => {}, stop() {} },
    motionDetector: motion,
    phoneUse: { start() {}, stop() {}, reportTouch() {}, subscribe: () => () => {} },
    roadCache: {
      ensureAround: opts.ensureAround ?? (async () => {}),
      match: () => opts.road ?? posted(),
      stopSignsNear: () => [],
      getStatus: () => ({
        center: null,
        radiusM: 1500,
        wayCount: 1,
        stopSignCount: 0,
        lastFetchAt: null,
        fetching: false,
        lastError: null,
      }),
      clear() {},
    },
    roadDetector: { onGps: opts.onGps ?? (() => []), reset() {} },
    alerts: { preload: async () => {}, play, reset() {} },
    debrief: { play: debriefPlay, stop() {} },
    api: {
      createTrip,
      listTrips: async () => ({ trips: [] }),
      getTrip: async () => {
        throw new Error('unused');
      },
      getTrace: async () => {
        throw new Error('unused');
      },
      getProgress: async () => {
        throw new Error('unused');
      },
      ask: async () => {
        throw new Error('unused');
      },
    },
    queue,
    keepAwake: { activate, deactivate: async () => {} },
  });
  return {
    session,
    play,
    debriefPlay,
    activate,
    createTrip,
    queue,
    emit: (e: DraftEvent) => {
      for (const l of listeners) l(e);
    },
  };
}

const brake: DraftEvent = {
  type: 'hard_brake',
  tier: 'harsh',
  peak: 4,
  durationS: 0.5,
  speedMph: 30,
  at: new Date(0).toISOString(),
  location: { type: 'Point', coordinates: [-80.37, 25.76] },
};

describe('TripSession', () => {
  it('refuses End Trip until the car has been stopped for 30 s', async () => {
    const { session } = harness({ fixes: [fix(0, 10), fix(1000, 0)] });
    await session.start({ passenger: false, lockEnabled: true });
    expect(session.canEnd().ok).toBe(false);
    expect(session.canEnd().reason).toMatch(/more seconds/);
    expect(await session.end()).toBeNull();
    expect(session.getState().status).toBe('driving');
  });

  it('uploads the trace, alerts on a harsh brake, and plays the debrief', async () => {
    const h = harness({ fixes: driveThenPark() });
    await h.session.start({ passenger: false, lockEnabled: true });
    expect(h.activate).toHaveBeenCalledOnce();
    expect(h.session.canEnd()).toEqual({ ok: true });
    expect(h.session.getTrace().lat.length).toBe(36);
    h.emit(brake);

    const result = await h.session.end();
    expect(result?.coachAudioUrl).toBe(AUDIO);
    expect(h.session.getState().status).toBe('done');
    expect(h.play).toHaveBeenCalledWith('hard_brake', { limitMph: 40 });
    expect(h.debriefPlay).toHaveBeenCalledWith(AUDIO);
    const body = h.createTrip.mock.calls[0]?.[0];
    expect(body?.trip.passenger).toBe(false);
    expect(body?.events.some((e) => e.type === 'hard_brake' && e.alerted)).toBe(true);
    expect(body?.traceGzipB64.length).toBeGreaterThan(10);
    expect(body?.trip.distanceMi).toBeGreaterThan(0);
  });

  it('records a passenger trip without live alerts or a debrief', async () => {
    const h = harness({ fixes: driveThenPark() });
    await h.session.start({ passenger: true, lockEnabled: false });
    h.emit(brake);
    await h.session.end();
    expect(h.play).not.toHaveBeenCalled();
    expect(h.debriefPlay).not.toHaveBeenCalled();
    const body = h.createTrip.mock.calls[0]?.[0];
    expect(body?.trip.passenger).toBe(true);
    expect(body?.events[0]?.alerted).toBe(false);
  });

  it('does not voice speeding against an inferred limit', async () => {
    const h = harness({
      fixes: driveThenPark(),
      road: posted('inferred'),
      onGps: (fix) => [
        {
          type: 'speeding',
          tier: 'harsh',
          peak: 20,
          overMph: 20,
          durationS: 6,
          speedMph: 45,
          at: new Date(fix.t).toISOString(),
          location: { type: 'Point', coordinates: [fix.lon, fix.lat] },
        },
      ],
    });
    await h.session.start({ passenger: false, lockEnabled: true });
    expect(h.play).not.toHaveBeenCalled();
    expect(h.session.getState().events[0]).toMatchObject({
      type: 'speeding',
      alerted: false,
      limitConfidence: 'inferred',
    });
  });

  it('keeps processing fixes while the road fetch hangs', async () => {
    const motionOnGps = vi.fn();
    const h = harness({
      fixes: driveThenPark(),
      ensureAround: () => new Promise(() => {}),
      motionOnGps,
    });
    await h.session.start({ passenger: false, lockEnabled: true });
    expect(motionOnGps).toHaveBeenCalledTimes(36);
    expect(h.session.getState().traceLength).toBe(36);
    expect(h.session.canEnd()).toEqual({ ok: true });
  });

  it('queues a failed upload and retries it on the next start', async () => {
    let offline = true;
    const h = harness({
      fixes: driveThenPark(),
      createTrip: async () => {
        if (offline) {
          offline = false;
          throw new Error('offline');
        }
        return okResponse();
      },
    });
    await h.session.start({ passenger: false, lockEnabled: true });
    expect(await h.session.end()).toBeNull();
    expect(h.session.getState().status).toBe('queued');
    expect(await h.queue.peekAll()).toHaveLength(1);

    await h.session.start({ passenger: false, lockEnabled: true });
    expect(await h.queue.peekAll()).toHaveLength(0);
    expect(h.createTrip).toHaveBeenCalledTimes(2);
  });
});
