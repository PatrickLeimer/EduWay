/**
 * Real TripSession (WS2). STUB: state plumbing only, no sensors or detection.
 * Master doc §3 (architecture), §4 (lifecycle), §7 (pipeline), §9 (trace).
 *
 * Dependencies are injected by src/wiring.ts, so each one can be the real
 * module or its mock independently.
 */
import type { CreateTripResponse } from '@edudriver/shared';

import type {
  AlertPlayer,
  ApiClient,
  CanEndResult,
  MotionDetector,
  MotionSource,
  PhoneUseMonitor,
  RoadCache,
  RoadEventDetector,
  StartTripOptions,
  TripSession,
  UploadQueueStore,
} from '../contracts';

import type { LocationSource } from './locationSource';
import { createTripStateStore, INITIAL_TRIP_STATE } from './stateStore';
import { createTraceBuffer, type TraceBuffer } from './traceBuffer';

export interface TripSessionDeps {
  location: LocationSource;
  motionSource: MotionSource;
  motionDetector: MotionDetector;
  phoneUse: PhoneUseMonitor;
  roadCache: RoadCache;
  roadDetector: RoadEventDetector;
  alerts: AlertPlayer;
  api: ApiClient;
  queue: UploadQueueStore;
  /** Defaults to DEMO_USER_ID (no auth in hackathon scope). */
  userId?: string;
}

export function createTripSession(deps: TripSessionDeps): TripSession {
  const store = createTripStateStore();
  let trace: TraceBuffer = createTraceBuffer(Date.now());

  return {
    async start(opts: StartTripOptions) {
      const now = Date.now();
      trace = createTraceBuffer(now);
      store.set({ status: 'starting', options: opts, tripStartedAt: new Date(now).toISOString() });
      // TODO(WS2, §4): expo-keep-awake activateKeepAwakeAsync().
      // TODO(WS2): reset + start: motionDetector, roadDetector, alerts.preload(), phoneUse.start().
      // TODO(WS2, §3): motionSource.start(s => motionDetector.onMotion(s)).
      // TODO(WS2, §3/§8): location.start(fix => { trace.append(fix); roadCache.ensureAround(fix);
      //   match = roadCache.match(fix); motionDetector.onGps(fix); roadDetector.onGps(fix, match);
      //   update distanceMi, stoppedForS (TRIP.stoppedSpeedMps), latestFix, latestRoad }).
      // TODO(WS2, §7): on every DraftEvent from motionDetector / phoneUse / roadDetector: add road
      //   context from roadCache.match, decide live alert (harsh tier of a LiveAlertType;
      //   speeding only with limitConfidence 'posted'), alerted = alerts.play(...), append.
      //   Skip all of this scoring-wise when opts.passenger (§4).
      store.set({ status: 'driving' });
    },
    canEnd(): CanEndResult {
      // TODO(WS2, §4): ok only when stoppedForS >= TRIP.minStoppedToEndS.
      return { ok: false, reason: 'TODO(WS2): trip end rule not implemented' };
    },
    async end(): Promise<CreateTripResponse | null> {
      // TODO(WS2, §4/§13): stop all sources, build CreateTripRequest
      //   { userId: deps.userId ?? DEMO_USER_ID, trip, events, traceGzipB64: encodeTrace(trace.toUpload()) } via api/,
      //   status 'uploading' → deps.api.createTrip → 'done' with result; on failure
      //   deps.queue.enqueue(...) and status 'queued'.
      return null;
    },
    reset() {
      store.set(INITIAL_TRIP_STATE);
    },
    getState: () => store.get(),
    getTrace: () => trace.toUpload(),
    reportTouch: () => deps.phoneUse.reportTouch(),
    subscribe: (l) => store.subscribe(l),
  };
}
