/**
 * Trip mocks (WS2).
 *
 * - createFixtureLocationSource: replays fixtures/trace.short-drive.json as live
 *   GPS fixes (re-timed to "now"), optionally sped up. Useful for the real
 *   TripSession too, e.g. testing the pipeline at a desk.
 * - createMockTripSession: a self-contained fake drive. Replays the fixture trace
 *   and fixture events (with road context) in time, plays live alerts through the
 *   injected AlertPlayer, and uploads through the injected ApiClient on end().
 *   The fixture ends with 35 s stopped, so End Trip unlocks near the end (§4).
 *   Road context (latestRoad) is not simulated per fix; the events carry their own.
 */
import { eventsFixture, offsetFromTripStartS, traceFixture } from '@eduway/fixtures';
import {
  DEMO_USER_ID,
  LiveAlertTypeSchema,
  TRIP,
  type GpsFix,
  type RecordedEvent,
} from '@eduway/shared';

import type { AlertPlayer, ApiClient, TripSession } from '../../contracts';
import { encodeTrace } from '../../api';
import type { LocationSource } from '../locationSource';
import { createTripStateStore, INITIAL_TRIP_STATE } from '../stateStore';
import { createTraceBuffer, type TraceBuffer } from '../traceBuffer';

const FIXTURE_LENGTH = traceFixture.t.length;

/** Fixture fix i, re-timed as if the trip started at `startMs`. */
function fixtureFix(i: number, startMs: number): GpsFix {
  return {
    t: startMs + traceFixture.t[i]! * 1000,
    lat: traceFixture.lat[i]!,
    lon: traceFixture.lon[i]!,
    speedMps: traceFixture.speedMps[i] ?? null,
    heading: traceFixture.heading[i] ?? null,
    accuracyM: traceFixture.accuracyM[i] ?? null,
  };
}

/**
 * GPS source replaying the fixture trace. `speedup` 5 = 5 fixes per real second.
 * After the last fix it keeps repeating it (car parked), so stop timers keep running.
 */
export function createFixtureLocationSource(speedup = 1): LocationSource {
  let timer: ReturnType<typeof setInterval> | null = null;
  return {
    async start(onFix) {
      const startMs = Date.now();
      let i = 0;
      timer = setInterval(() => {
        const idx = Math.min(i, FIXTURE_LENGTH - 1);
        // Past the end of the fixture, keep advancing time at the parked position.
        const fix = { ...fixtureFix(idx, startMs), t: startMs + i * 1000 };
        onFix(fix);
        i++;
      }, 1000 / speedup);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}

export interface MockTripSessionDeps {
  api: ApiClient;
  alerts: AlertPlayer;
  /** Fixes per real second. Default 5, so the ~3 minute fixture drive takes ~40 s. */
  speedup?: number;
  userId?: string;
}

export function createMockTripSession(deps: MockTripSessionDeps): TripSession {
  const store = createTripStateStore();
  const location = createFixtureLocationSource(deps.speedup ?? 5);
  let trace: TraceBuffer = createTraceBuffer(Date.now());
  let startMs = 0;
  let pending: { offsetS: number; event: RecordedEvent }[] = [];

  const onFix = (fix: GpsFix) => {
    trace.append(fix);
    const s = store.get();
    const elapsedS = (fix.t - startMs) / 1000;
    const stopped = (fix.speedMps ?? 0) < TRIP.stoppedSpeedMps;

    // Release fixture events that are due, re-stamped to this fix.
    const due = pending.filter((p) => p.offsetS <= elapsedS);
    pending = pending.filter((p) => p.offsetS > elapsedS);
    const released = due.map(({ event }): RecordedEvent => {
      const live = LiveAlertTypeSchema.safeParse(event.type);
      const wantsAlert =
        live.success &&
        event.tier === 'harsh' &&
        !s.options?.passenger &&
        (event.type !== 'speeding' || event.limitConfidence === 'posted');
      const alerted = wantsAlert
        ? deps.alerts.play(live.data, { limitMph: event.limitMph })
        : false;
      return {
        ...event,
        alerted,
        at: new Date(fix.t).toISOString(),
        location: { type: 'Point', coordinates: [fix.lon, fix.lat] },
      };
    });

    store.set({
      latestFix: fix,
      traceLength: trace.length,
      distanceMi: s.distanceMi + ((fix.speedMps ?? 0) * 1) / 1609.34,
      stoppedForS: stopped ? s.stoppedForS + 1 : 0,
      events: released.length ? [...s.events, ...released] : s.events,
    });
  };

  const session: TripSession = {
    async start(opts) {
      startMs = Date.now();
      trace = createTraceBuffer(startMs);
      pending = eventsFixture.map((event) => ({ offsetS: offsetFromTripStartS(event.at), event }));
      deps.alerts.reset();
      await deps.alerts.preload();
      store.set({
        ...INITIAL_TRIP_STATE,
        status: 'driving',
        options: opts,
        tripStartedAt: new Date(startMs).toISOString(),
      });
      await location.start(onFix);
    },
    canEnd() {
      const s = store.get();
      if (s.status !== 'driving') return { ok: false, reason: 'No trip in progress' };
      const left = Math.ceil(TRIP.minStoppedToEndS - s.stoppedForS);
      return left <= 0 ? { ok: true } : { ok: false, reason: `Stop for ${left} more seconds` };
    },
    async end() {
      const s = store.get();
      if (!session.canEnd().ok || !s.options || !s.tripStartedAt) return null;
      location.stop();
      store.set({ status: 'uploading' });
      try {
        const result = await deps.api.createTrip({
          userId: deps.userId ?? DEMO_USER_ID,
          trip: {
            startedAt: s.tripStartedAt,
            // Simulated clock: the last fix time, not wall time (the replay may be sped up).
            endedAt: new Date(s.latestFix?.t ?? Date.now()).toISOString(),
            distanceMi: Number(s.distanceMi.toFixed(2)),
            passenger: s.options.passenger,
            lockEnabled: s.options.lockEnabled,
          },
          events: s.events,
          traceGzipB64: encodeTrace(trace.toUpload()),
        });
        store.set({ status: 'done', result });
        return result;
      } catch (e) {
        store.set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
        return null;
      }
    },
    reset() {
      location.stop();
      store.set(INITIAL_TRIP_STATE);
    },
    getState: () => store.get(),
    getTrace: () => trace.toUpload(),
    reportTouch() {
      // The mock ignores touches; phone use comes from the fixture event.
    },
    reportSafeExit() {
      // Nothing to excuse: the mock does not watch AppState.
    },
    subscribe: (l) => store.subscribe(l),
  };
  return session;
}
