/**
 * Real TripSession (WS2). Master doc §3 (architecture), §4 (lifecycle),
 * §7 (pipeline and live alerts), §8 (road context), §9 (trace).
 *
 * Dependencies are injected by src/wiring.ts, so each one can be the real
 * module or its mock independently.
 */
import {
  DEMO_USER_ID,
  LiveAlertTypeSchema,
  TRIP,
  type CreateTripRequest,
  type DraftEvent,
  type GpsFix,
} from '@edudriver/shared';

import type {
  AlertPlayer,
  ApiClient,
  CanEndResult,
  DebriefPlayer,
  MotionDetector,
  MotionSource,
  PhoneUseMonitor,
  RoadCache,
  RoadEventDetector,
  RoadLiveAlert,
  RoadMatch,
  StartTripOptions,
  TripSession,
  UploadQueueStore,
} from '../contracts';
import { encodeTrace } from '../api';

import { createExpoKeepAwake, type KeepAwake } from './keepAwake';
import type { LocationSource } from './locationSource';
import { createTripStateStore, INITIAL_TRIP_STATE } from './stateStore';
import { createTraceBuffer, type TraceBuffer } from './traceBuffer';

const M_PER_MI = 1609.34;

export interface TripSessionDeps {
  location: LocationSource;
  motionSource: MotionSource;
  motionDetector: MotionDetector;
  phoneUse: PhoneUseMonitor;
  roadCache: RoadCache;
  roadDetector: RoadEventDetector;
  alerts: AlertPlayer;
  debrief: DebriefPlayer;
  api: ApiClient;
  queue: UploadQueueStore;
  /** Defaults to the real expo-keep-awake tag. Tests pass a noop. */
  keepAwake?: KeepAwake;
  /** Defaults to DEMO_USER_ID (no auth in hackathon scope). */
  userId?: string;
}

export function createTripSession(deps: TripSessionDeps): TripSession {
  const store = createTripStateStore();
  const keepAwake = deps.keepAwake ?? createExpoKeepAwake();
  let trace: TraceBuffer = createTraceBuffer(Date.now());
  let unsubs: Array<() => void> = [];
  let gpsChain: Promise<void> = Promise.resolve();
  let ending = false;
  /** Whether the open speeding episode's live alert played (§7); its event arrives when the episode ends. */
  let speedingAlerted = false;

  /** `alerted` given: the live alert was already decided while the event was open. */
  const record = (draft: DraftEvent, match: RoadMatch | null, alertedAlready?: boolean) => {
    const s = store.get();
    if (s.status !== 'driving' && s.status !== 'starting') return;
    const road = {
      street: match?.street ?? null,
      roadClass: match?.roadClass ?? null,
      limitMph: match?.limitMph ?? null,
      limitConfidence: match?.limitConfidence ?? ('unknown' as const),
    };
    const live = LiveAlertTypeSchema.safeParse(draft.type);
    let alerted = alertedAlready ?? false;
    if (
      alertedAlready === undefined &&
      !s.options?.passenger &&
      live.success &&
      draft.tier === 'harsh' &&
      (draft.type !== 'speeding' || road.limitConfidence === 'posted')
    ) {
      alerted = deps.alerts.play(live.data, { limitMph: road.limitMph });
    }
    store.set({ events: [...store.get().events, { ...draft, ...road, alerted }] });
  };

  const onDraft = (draft: DraftEvent) => record(draft, store.get().latestRoad);

  /** Road events: a speeding event carries the live alert decided while it was open. */
  const recordRoad = (ev: DraftEvent, match: RoadMatch | null) => {
    if (ev.type !== 'speeding') return record(ev, match);
    record(ev, match, speedingAlerted);
    speedingAlerted = false;
  };

  /** Live alert for an episode still in progress (harsh speeding vs a posted limit). */
  const playRoadAlert = (alert: RoadLiveAlert) => {
    const s = store.get();
    if (s.status !== 'driving' && s.status !== 'starting') return;
    if (s.options?.passenger) return;
    speedingAlerted = deps.alerts.play(alert.type, { limitMph: alert.limitMph });
  };

  async function ingest(fix: GpsFix) {
    const status = store.get().status;
    if (status !== 'driving' && status !== 'starting') return;
    trace.append(fix);
    // Fire and forget: a slow or offline Overpass fetch must not stall motion,
    // phone use, or stop timing (§18 flag 1). The cache ignores overlapping calls.
    void deps.roadCache.ensureAround(fix);
    const match = deps.roadCache.match(fix);
    const prev = store.get();
    const dt = prev.latestFix ? Math.max(0, (fix.t - prev.latestFix.t) / 1000) : 0;
    const isStopped = fix.speedMps != null && fix.speedMps < TRIP.stoppedSpeedMps;
    store.set({
      latestFix: fix,
      latestRoad: match,
      traceLength: trace.length,
      distanceMi: prev.distanceMi + ((fix.speedMps ?? 0) * dt) / M_PER_MI,
      stoppedForS: isStopped ? prev.stoppedForS + dt : 0,
    });
    deps.motionDetector.onGps(fix);
    const road = deps.roadDetector.onGps(fix, match);
    // Alerts first: one that arrives with its own finished event (mock replay) is
    // counted on it. The real detector never alerts on the fix that closes an episode.
    for (const alert of road.alerts) playRoadAlert(alert);
    for (const ev of road.events) {
      const [lon, lat] = ev.location.coordinates;
      const pinnedHere = lat === fix.lat && lon === fix.lon;
      recordRoad(ev, pinnedHere ? match : prev.latestRoad);
    }
  }

  const onFix = (fix: GpsFix) => {
    gpsChain = gpsChain
      .then(() => ingest(fix))
      .catch((e: unknown) => {
        if (store.get().status === 'driving') {
          store.set({ error: e instanceof Error ? e.message : String(e) });
        }
      });
  };

  async function flushQueue() {
    const items = await deps.queue.peekAll();
    for (const item of items) {
      try {
        await deps.api.createTrip(item.body);
        await deps.queue.remove(item.id);
      } catch {
        return;
      }
    }
  }

  function haltSensors() {
    deps.location.stop();
    deps.motionSource.stop();
    deps.phoneUse.stop();
    for (const u of unsubs) u();
    unsubs = [];
    void keepAwake.deactivate();
  }

  /** A fix past the stop-sign radius with speed 0, so open road episodes close. Not recorded. */
  function closeRoadEpisodes() {
    const last = store.get().latestFix;
    if (!last) return;
    const closing: GpsFix = {
      ...last,
      t: last.t + 1,
      speedMps: 0,
      lat: last.lat + 0.002,
      accuracyM: 5,
    };
    const prevMatch = store.get().latestRoad;
    const extra = deps.roadDetector.onGps(closing, deps.roadCache.match(closing));
    for (const ev of extra.events) recordRoad(ev, prevMatch);
  }

  const session: TripSession = {
    async start(opts: StartTripOptions) {
      const status = store.get().status;
      if (status === 'driving' || status === 'starting' || status === 'uploading') return;
      ending = false;
      speedingAlerted = false;
      haltSensors();
      const now = Date.now();
      trace = createTraceBuffer(now);
      gpsChain = Promise.resolve();
      store.set({
        ...INITIAL_TRIP_STATE,
        status: 'starting',
        options: opts,
        tripStartedAt: new Date(now).toISOString(),
      });
      try {
        await keepAwake.activate();
        deps.motionDetector.reset();
        deps.roadDetector.reset();
        deps.alerts.reset();
        await deps.alerts.preload();
        await flushQueue();
        unsubs.push(deps.motionDetector.subscribe(onDraft));
        unsubs.push(deps.phoneUse.subscribe(onDraft));
        deps.phoneUse.start({
          lockEnabled: opts.lockEnabled,
          getLatestFix: () => store.get().latestFix,
        });
        await deps.motionSource.start((sample) => deps.motionDetector.onMotion(sample));
        store.set({ status: 'driving' });
        await deps.location.start(onFix);
        await gpsChain;
      } catch (e) {
        haltSensors();
        store.set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
      }
    },
    canEnd(): CanEndResult {
      const s = store.get();
      if (s.status !== 'driving') return { ok: false, reason: 'No trip in progress' };
      const left = Math.ceil(TRIP.minStoppedToEndS - s.stoppedForS);
      return left <= 0 ? { ok: true } : { ok: false, reason: `Stop for ${left} more seconds` };
    },
    async end() {
      if (ending || !session.canEnd().ok) return null;
      const started = store.get();
      if (!started.options || !started.tripStartedAt) return null;
      ending = true;
      deps.location.stop();
      await gpsChain;
      if (!session.canEnd().ok) {
        ending = false;
        await deps.location.start(onFix);
        return null;
      }
      deps.motionSource.stop();
      deps.phoneUse.stop();
      closeRoadEpisodes();
      for (const u of unsubs) u();
      unsubs = [];
      const s = store.get();
      const options = started.options;
      const startedAt = started.tripStartedAt;
      store.set({ status: 'uploading', error: null });
      try {
        await keepAwake.deactivate();
      } catch {
        // The trip still uploads if the screen lock is already released.
      }
      const body: CreateTripRequest = {
        userId: deps.userId ?? DEMO_USER_ID,
        trip: {
          startedAt,
          endedAt: new Date(s.latestFix?.t ?? Date.now()).toISOString(),
          distanceMi: Number(s.distanceMi.toFixed(2)),
          passenger: options.passenger,
          lockEnabled: options.lockEnabled,
        },
        events: s.events,
        traceGzipB64: encodeTrace(trace.toUpload()),
      };
      try {
        await flushQueue();
        const result = await deps.api.createTrip(body);
        store.set({ status: 'done', result, error: null });
        // The voice debrief plays on the coaching screen, the last post-trip step (§4, §12).
        return result;
      } catch (e) {
        const id = globalThis.crypto?.randomUUID?.() ?? `queue-${Date.now()}`;
        await deps.queue.enqueue({ id, createdAt: new Date().toISOString(), body });
        store.set({
          status: 'queued',
          error: e instanceof Error ? e.message : 'Upload failed; queued for retry',
        });
        return null;
      }
    },
    reset() {
      ending = false;
      speedingAlerted = false;
      haltSensors();
      deps.motionDetector.reset();
      deps.roadDetector.reset();
      gpsChain = Promise.resolve();
      store.set(INITIAL_TRIP_STATE);
    },
    getState: () => store.get(),
    getTrace: () => trace.toUpload(),
    reportTouch: () => deps.phoneUse.reportTouch(),
    reportSafeExit: () => deps.phoneUse.reportSafeExit(),
    subscribe: (l) => store.subscribe(l),
  };
  return session;
}
