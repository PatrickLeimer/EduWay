/**
 * Dev-only drive recorder core. Runs its own copy of the real detection and road
 * pipeline (same code the trip uses) and writes raw motion samples, GPS fixes,
 * Overpass responses, the events that fired live, and passenger markers to a
 * file on the phone. Nothing is uploaded (master doc §9).
 *
 * Pure: every sensor, detector and file handle is injected, so this runs under
 * Vitest. The Expo wiring lives in expo.ts.
 */
import type { DraftEvent, GpsFix, MotionSample } from '@eduway/shared';

import type {
  MotionDetector,
  MotionSource,
  RoadCache,
  RoadCacheStatus,
  RoadEventDetector,
  RoadMatch,
} from '../contracts';

import {
  RECORDING_VERSION,
  encodeSample,
  type EventLine,
  type MarkerType,
  type Mount,
  type RecordingLine,
  type Segment,
} from './format';

/** Same shape as trip/'s LocationSource. */
export interface FixSource {
  start(onFix: (fix: GpsFix) => void): Promise<void>;
  stop(): void;
}

/** Where lines go. `append` must write synchronously so a crash loses at most one flush. */
export interface RecordingSink {
  append(text: string): void;
}

export type OverpassFetch = (query: string) => Promise<unknown>;

export interface RecorderDeps {
  motionSource: MotionSource;
  location: FixSource;
  motionDetector: MotionDetector;
  /** Builds the road cache around a fetcher the recorder wraps to log every response. */
  createRoadCache: (fetcher: OverpassFetch) => RoadCache;
  fetchOverpass: OverpassFetch;
  createRoadDetector: (cache: RoadCache) => RoadEventDetector;
  sink: RecordingSink;
  now: () => number;
  /** Flush period; the screen default is 1000 ms. 0 = only flush on demand (tests). */
  flushEveryMs: number;
}

export interface RecorderStartInfo {
  platform: string;
  osVersion: string;
  mount: Mount;
  thresholds: Record<string, unknown>;
}

export interface RecordedEvent {
  rt: number;
  source: 'motion' | 'road';
  event: DraftEvent;
  road: RoadMatch | null;
}

export interface RecorderStatus {
  state: 'idle' | 'starting' | 'recording' | 'stopped' | 'error';
  error: string | null;
  elapsedS: number;
  samples: number;
  /** Motion samples per second over the last flush period. */
  motionHz: number;
  gpsFixes: number;
  lastFix: GpsFix | null;
  road: RoadCacheStatus | null;
  roadMatch: RoadMatch | null;
  overpassOk: number;
  overpassFailed: number;
  junkPaused: boolean;
  segment: Segment;
  markers: number;
  lastMarker: MarkerType | null;
  events: RecordedEvent[];
  bytesWritten: number;
}

export interface DriveRecorder {
  start(info: RecorderStartInfo): Promise<void>;
  /** Flushes, writes the end line, and stops every sensor. Safe to call twice. */
  stop(): void;
  mark(marker: MarkerType): void;
  setSegment(segment: Segment): void;
  onAppState(state: string): void;
  /** Write buffered lines now. Called on a timer while recording. */
  flush(): void;
  getStatus(): RecorderStatus;
}

export function createDriveRecorder(deps: RecorderDeps): DriveRecorder {
  let startMs = 0;
  let lines: RecordingLine[] = [];
  let pendingSamples: number[][] = [];
  let timer: ReturnType<typeof setInterval> | null = null;
  let lastFlushAt = 0;
  let samplesAtLastFlush = 0;
  let unsubscribe: (() => void) | null = null;
  let roadCache: RoadCache | null = null;
  let roadDetector: RoadEventDetector | null = null;

  const status: RecorderStatus = {
    state: 'idle',
    error: null,
    elapsedS: 0,
    samples: 0,
    motionHz: 0,
    gpsFixes: 0,
    lastFix: null,
    road: null,
    roadMatch: null,
    overpassOk: 0,
    overpassFailed: 0,
    junkPaused: false,
    segment: 'baseline',
    markers: 0,
    lastMarker: null,
    events: [],
    bytesWritten: 0,
  };

  const rt = () => deps.now() - startMs;
  const active = () => status.state === 'starting' || status.state === 'recording';

  function write(text: string) {
    try {
      deps.sink.append(text);
      status.bytesWritten += text.length;
    } catch (e) {
      fail(`Could not write the recording file: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  function flush() {
    if (pendingSamples.length > 0) {
      lines.push({ k: 'motion', s: pendingSamples });
      pendingSamples = [];
    }
    if (lines.length > 0) {
      const text = lines.map((l) => JSON.stringify(l)).join('\n') + '\n';
      lines = [];
      write(text);
    }
    const now = deps.now();
    if (lastFlushAt > 0 && now > lastFlushAt) {
      status.motionHz = ((status.samples - samplesAtLastFlush) * 1000) / (now - lastFlushAt);
    }
    lastFlushAt = now;
    samplesAtLastFlush = status.samples;
    if (startMs > 0) status.elapsedS = rt() / 1000;
  }

  function halt() {
    if (timer) clearInterval(timer);
    timer = null;
    deps.motionSource.stop();
    deps.location.stop();
    unsubscribe?.();
    unsubscribe = null;
  }

  function fail(message: string) {
    halt();
    status.state = 'error';
    status.error = message;
  }

  function recordEvent(source: EventLine['source'], event: DraftEvent) {
    const line: EventLine = { k: 'event', rt: rt(), source, event, road: status.roadMatch };
    lines.push(line);
    status.events = [
      { rt: line.rt, source, event, road: line.road },
      ...status.events.slice(0, 19),
    ];
  }

  const loggedFetch: OverpassFetch = async (query) => {
    try {
      const response = await deps.fetchOverpass(query);
      if (active()) lines.push({ k: 'overpass', rt: rt(), query, ok: true, response });
      status.overpassOk++;
      return response;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      if (active()) lines.push({ k: 'overpass', rt: rt(), query, ok: false, error });
      status.overpassFailed++;
      throw e;
    }
  };

  function onSample(sample: MotionSample) {
    if (!active()) return;
    pendingSamples.push(encodeSample(sample, startMs));
    status.samples++;
    deps.motionDetector.onMotion(sample);
    status.junkPaused = deps.motionDetector.isPaused();
  }

  function onFix(fix: GpsFix) {
    if (!active() || !roadCache || !roadDetector) return;
    lines.push({ k: 'gps', rt: rt(), fix });
    status.gpsFixes++;
    status.lastFix = fix;
    // Same order as TripSession: fetch in the background, match from what is cached.
    void roadCache.ensureAround(fix);
    const match = roadCache.match(fix);
    status.road = roadCache.getStatus();
    deps.motionDetector.onGps(fix);
    for (const ev of roadDetector.onGps(fix, match).events) recordEvent('road', ev);
    status.roadMatch = match;
  }

  return {
    async start(info) {
      if (active()) return;
      startMs = deps.now();
      lines = [];
      pendingSamples = [];
      lastFlushAt = 0;
      samplesAtLastFlush = 0;
      Object.assign(status, {
        state: 'starting',
        error: null,
        elapsedS: 0,
        samples: 0,
        motionHz: 0,
        gpsFixes: 0,
        lastFix: null,
        road: null,
        roadMatch: null,
        overpassOk: 0,
        overpassFailed: 0,
        junkPaused: false,
        segment: 'baseline',
        markers: 0,
        lastMarker: null,
        events: [],
        bytesWritten: 0,
      } satisfies RecorderStatus);

      lines.push({
        k: 'header',
        v: RECORDING_VERSION,
        startedAt: new Date(startMs).toISOString(),
        startMs,
        platform: info.platform,
        osVersion: info.osVersion,
        mount: info.mount,
        thresholds: info.thresholds,
      });
      flush();

      deps.motionDetector.reset();
      roadCache = deps.createRoadCache(loggedFetch);
      roadDetector = deps.createRoadDetector(roadCache);
      unsubscribe = deps.motionDetector.subscribe((ev) => {
        if (active()) recordEvent('motion', ev);
      });
      try {
        await deps.motionSource.start(onSample);
        await deps.location.start(onFix);
      } catch (e) {
        fail(e instanceof Error ? e.message : String(e));
        return;
      }
      if (status.state !== 'starting') return;
      status.state = 'recording';
      if (deps.flushEveryMs > 0) timer = setInterval(flush, deps.flushEveryMs);
    },
    stop() {
      if (!active()) return;
      halt();
      lines.push({ k: 'end', rt: rt() });
      flush();
      status.state = 'stopped';
    },
    mark(marker) {
      if (!active()) return;
      lines.push({ k: 'marker', rt: rt(), marker });
      status.markers++;
      status.lastMarker = marker;
    },
    setSegment(segment) {
      if (!active()) return;
      lines.push({ k: 'segment', rt: rt(), segment });
      status.segment = segment;
    },
    onAppState(state) {
      if (active()) lines.push({ k: 'app', rt: rt(), state });
    },
    flush,
    getStatus: () => ({ ...status, events: [...status.events] }),
  };
}
