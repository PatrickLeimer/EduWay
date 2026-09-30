/**
 * Replays a drive recording through the real detectors and scores the result
 * against the passenger's markers. Pure (no file or console access) so it is
 * tested under Vitest; replay.ts is the command line wrapper.
 *
 * Imports detector internals directly (not the modules' index.ts) because those
 * indexes also export the Expo adapters, which cannot load in Node. This is dev
 * tooling only; if WS1/WS2 rename these files, update the imports here.
 */
import {
  HARD_ACCEL,
  HARD_BRAKE,
  MPS_TO_MPH,
  PHONE_USE,
  PIPELINE,
  ROAD,
  ROLLING_STOP,
  ROUGH_TURN,
  SPEEDING,
  SWERVE,
  type DraftEvent,
  type EventType,
  type GpsFix,
} from '@eduway/shared';

import type { RoadMatch } from '../../apps/mobile/src/contracts';
import { createMotionDetector } from '../../apps/mobile/src/detection/MotionDetector';
import { createGpsTracker, motionFrame } from '../../apps/mobile/src/detection/level1';
import { createSignalFilter, isJunk } from '../../apps/mobile/src/detection/signals';
import { len } from '../../apps/mobile/src/detection/vector';
import {
  MARKERS,
  clock,
  segmentAt,
  type MarkerDef,
  type MarkerLine,
  type MarkerType,
  type Recording,
  type Segment,
} from '../../apps/mobile/src/recorder/format';
import {
  createOverpassRoadCache,
  type OverpassFetcher,
} from '../../apps/mobile/src/road/OverpassRoadCache';
import type { OverpassResponse } from '../../apps/mobile/src/road/overpass';
import { createRoadEventDetector } from '../../apps/mobile/src/road/RoadEventDetector';

// ---------------------------------------------------------------------------
// Threshold overrides (--set HARD_BRAKE.coach.start=3)
// ---------------------------------------------------------------------------

/** The tunable objects from @eduway/shared that --set may change. */
export const TUNABLES: Record<string, object> = {
  PIPELINE,
  HARD_BRAKE,
  HARD_ACCEL,
  ROUGH_TURN,
  SWERVE,
  SPEEDING,
  ROLLING_STOP,
  PHONE_USE,
  ROAD,
};

/**
 * Applies "PATH=NUMBER" overrides in place for this process only, and returns
 * a function that puts the old values back. The detectors read these objects
 * at run time, so the replay sees the new values. Nothing is written to disk.
 */
export function applyOverrides(pairs: readonly string[]): () => void {
  const undo: (() => void)[] = [];
  for (const pair of pairs) {
    const m = /^([A-Z_]+)((?:\.[A-Za-z_]+)+)=(-?\d+(?:\.\d+)?)$/.exec(pair.trim());
    if (!m) throw new Error(`Bad --set "${pair}". Use e.g. HARD_BRAKE.coach.start=3.0`);
    const [, root = '', path = '', value = ''] = m;
    let obj = TUNABLES[root] as Record<string, unknown> | undefined;
    if (!obj)
      throw new Error(
        `Unknown threshold group "${root}". Known: ${Object.keys(TUNABLES).join(', ')}`,
      );
    const keys = path.slice(1).split('.');
    const last = keys.pop()!;
    for (const k of keys) {
      const next = obj[k];
      if (!next || typeof next !== 'object') throw new Error(`No "${k}" in ${pair}`);
      obj = next as Record<string, unknown>;
    }
    if (typeof obj[last] !== 'number') throw new Error(`${root}${path} is not a number threshold`);
    const target = obj;
    const old = target[last];
    target[last] = Number(value);
    undo.push(() => (target[last] = old));
  }
  return () => undo.reverse().forEach((u) => u());
}

// ---------------------------------------------------------------------------
// Replay
// ---------------------------------------------------------------------------

export interface ReplayedEvent {
  /** ms since start when the event was emitted. */
  rt: number;
  /** ms since start of the event's peak (`event.at`). */
  peakRt: number;
  source: 'motion' | 'road';
  event: DraftEvent;
  road: RoadMatch | null;
}

/** Filtered signals at one motion sample, as the §7 state machines see them. */
interface SignalPoint {
  rt: number;
  brake: number;
  accel: number;
  lat: number;
  junk: boolean;
  accGMag: number;
}

interface FixPoint {
  rt: number;
  fix: GpsFix;
  match: RoadMatch | null;
}

export interface Replay {
  events: ReplayedEvent[];
  signals: SignalPoint[];
  fixes: FixPoint[];
}

const aroundRe = /around:(\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/;

function queryCenter(query: string): { lat: number; lon: number } | null {
  const m = aroundRe.exec(query);
  return m ? { lat: Number(m[2]), lon: Number(m[3]) } : null;
}

function roughDistanceM(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const x = (b.lon - a.lon) * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  const y = b.lat - a.lat;
  return Math.hypot(x, y) * 111_320;
}

/** Serves Overpass responses from the recording instead of the network. */
function recordedFetcher(rec: Recording): OverpassFetcher {
  const ok = rec.overpass.filter((o) => o.ok && o.response);
  return async (query: string) => {
    const want = queryCenter(query);
    let best: { d: number; response: unknown } | null = null;
    for (const o of ok) {
      const c = queryCenter(o.query);
      if (!want || !c) continue;
      const d = roughDistanceM(want, c);
      if (!best || d < best.d) best = { d, response: o.response };
    }
    if (!best || best.d > 300) throw new Error('No recorded Overpass response for this area');
    return best.response as OverpassResponse;
  };
}

export async function replay(rec: Recording): Promise<Replay> {
  const startMs = rec.header.startMs;
  const detector = createMotionDetector();
  const cache = createOverpassRoadCache(recordedFetcher(rec));
  const road = createRoadEventDetector(cache);
  const tracker = createGpsTracker();
  const filter = createSignalFilter();

  const events: ReplayedEvent[] = [];
  const signals: SignalPoint[] = [];
  const fixes: FixPoint[] = [];
  let now = 0;
  let lastMatch: RoadMatch | null = null;
  const push = (source: ReplayedEvent['source'], event: DraftEvent) =>
    events.push({
      rt: now,
      peakRt: Date.parse(event.at) - startMs,
      source,
      event,
      road: lastMatch,
    });
  detector.subscribe((e) => push('motion', e));

  // Merge motion samples and GPS fixes in the order the phone received them.
  let gi = 0;
  const gps = rec.gps;
  const feedGpsUpTo = async (rt: number) => {
    while (gi < gps.length && gps[gi]!.rt <= rt) {
      const { rt: fixRt, fix } = gps[gi++]!;
      now = fixRt;
      await cache.ensureAround(fix);
      const match = cache.match(fix);
      fixes.push({ rt: fixRt, fix, match });
      detector.onGps(fix);
      tracker.update(fix);
      for (const ev of road.onGps(fix, match).events) push('road', ev);
      lastMatch = match;
    }
  };

  for (const s of rec.samples) {
    const rt = s.t - startMs;
    await feedGpsUpTo(rt);
    now = rt;
    detector.onMotion(s);
    const frame = motionFrame(s);
    const junk = isJunk(s, frame);
    if (junk) {
      filter.reset();
      signals.push({ rt, brake: 0, accel: 0, lat: 0, junk, accGMag: len(s.accG) });
      continue;
    }
    const sig = filter.update(frame, tracker.latest());
    signals.push({
      rt,
      brake: -sig.lon,
      accel: sig.lon,
      lat: Math.abs(sig.lat),
      junk,
      accGMag: len(s.accG),
    });
  }
  await feedGpsUpTo(Number.POSITIVE_INFINITY);
  return { events, signals, fixes };
}

// ---------------------------------------------------------------------------
// Scoring against markers
// ---------------------------------------------------------------------------

export type Verdict = 'confirmed' | 'false_alarm' | 'unconfirmed';

export interface ScoredEvent extends ReplayedEvent {
  verdict: Verdict;
  /** Why it is a false alarm: a "normal ..." marker or the "App was wrong" button. */
  reason: string | null;
  segment: Segment;
}

export interface ScoredMarker {
  marker: MarkerLine;
  segment: Segment;
  /** expects: true = an expected event fired. rulesOut: true = nothing ruled out fired. */
  passed: boolean | null;
  matched: ScoredEvent[];
}

export interface Scoring {
  events: ScoredEvent[];
  markers: ScoredMarker[];
}

const def = (m: MarkerType): MarkerDef => MARKERS[m];

function inWindow(ev: ReplayedEvent, m: MarkerLine) {
  const [before, after] = def(m.marker).windowS;
  return ev.peakRt >= m.rt - before * 1000 && ev.peakRt <= m.rt + after * 1000;
}

export function score(rec: Recording, events: readonly ReplayedEvent[]): Scoring {
  const scored: ScoredEvent[] = events.map((e) => ({
    ...e,
    verdict: 'unconfirmed',
    reason: null,
    segment: segmentAt(rec.segments, e.peakRt),
  }));

  const markers: ScoredMarker[] = rec.markers.map((marker) => {
    const d = def(marker.marker);
    const segment = segmentAt(rec.segments, marker.rt);
    if (marker.marker === 'false_alarm') {
      // The most recent event emitted in the 15 s before the tap.
      const [before] = d.windowS;
      const target = [...scored]
        .reverse()
        .find((e) => e.rt <= marker.rt && e.rt >= marker.rt - before * 1000);
      if (target) {
        target.verdict = 'false_alarm';
        target.reason = `"App was wrong" at ${clock(marker.rt)}`;
      }
      return { marker, segment, passed: null, matched: target ? [target] : [] };
    }
    if (d.expects) {
      const matched = scored.filter(
        (e) => d.expects!.includes(e.event.type) && inWindow(e, marker),
      );
      for (const e of matched) if (e.verdict === 'unconfirmed') e.verdict = 'confirmed';
      return { marker, segment, passed: matched.length > 0, matched };
    }
    const matched = scored.filter((e) => d.rulesOut!.includes(e.event.type) && inWindow(e, marker));
    for (const e of matched) {
      if (e.verdict === 'confirmed') continue;
      e.verdict = 'false_alarm';
      e.reason = `"${d.label}" at ${clock(marker.rt)}`;
    }
    return { marker, segment, passed: matched.length === 0, matched };
  });

  return { events: scored, markers };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const EVENT_ORDER: EventType[] = [
  'hard_brake',
  'hard_accel',
  'rough_turn',
  'swerve',
  'speeding',
  'rolling_stop',
];

function stats(xs: number[]) {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
  return { min: s[0]!, median: q(0.5), p90: q(0.9), max: s.at(-1)! };
}

const f1 = (n: number | null | undefined) => (n == null ? '-' : n.toFixed(1));
const pct = (a: number, b: number) => (b === 0 ? '-' : `${Math.round((a / b) * 100)}%`);

/** Which signal a marker is about, and the thresholds to compare it with. */
function markerSignal(
  m: MarkerType,
): { name: string; get: (w: Window) => number | null; thresholds: string } | null {
  switch (m) {
    case 'hard_brake':
    case 'normal_brake':
      return {
        name: 'brake m/s²',
        get: (w) => w.brake,
        thresholds: `coach ≥ ${HARD_BRAKE.coach.start}, harsh ≥ ${HARD_BRAKE.harsh.start}`,
      };
    case 'hard_accel':
    case 'normal_accel':
      return {
        name: 'accel m/s²',
        get: (w) => w.accel,
        thresholds: `coach ≥ ${HARD_ACCEL.coach.start}, harsh ≥ ${HARD_ACCEL.harsh.start}`,
      };
    case 'sharp_turn':
    case 'normal_turn':
      return {
        name: 'lateral m/s²',
        get: (w) => w.lat,
        thresholds: `coach ≥ ${ROUGH_TURN.coach.start}, harsh ≥ ${ROUGH_TURN.harsh.start}`,
      };
    case 'swerve':
    case 'lane_change':
      return {
        name: 'lateral m/s²',
        get: (w) => w.lat,
        thresholds: `swerve needs ±${SWERVE.coach.peakMps2} (harsh ±${SWERVE.harsh.peakMps2}) within ${SWERVE.windowS} s, above ${Math.round(SWERVE.minSpeedMps * 3.6)} km/h`,
      };
    case 'bump':
    case 'phone_moved':
      return {
        name: 'largest signal m/s²',
        get: (w) => Math.max(w.brake, w.accel, w.lat),
        thresholds: `lowest start is ${HARD_BRAKE.coach.start}; junk pause should catch handling`,
      };
    case 'full_stop':
    case 'rolling_stop':
      return {
        name: 'min speed mph',
        get: (w) => w.minSpeedMph,
        thresholds: `rolling stop if > ${ROLLING_STOP.maxStopSpeedMph} mph within ${ROLLING_STOP.signRadiusM} m of a sign`,
      };
    case 'speeding':
      return {
        name: 'mph over limit',
        get: (w) => w.maxOverMph,
        thresholds: `coach ≥ +${SPEEDING.coachOverMph} for ${SPEEDING.minDurationS} s, harsh ≥ +${SPEEDING.harshOverMph} (posted only)`,
      };
    case 'false_alarm':
      return null;
  }
}

interface Window {
  brake: number;
  accel: number;
  lat: number;
  junkPct: number;
  speedMph: number | null;
  minSpeedMph: number | null;
  maxOverMph: number | null;
}

function windowAround(r: Replay, from: number, to: number): Window {
  let brake = 0;
  let accel = 0;
  let lat = 0;
  let n = 0;
  let junk = 0;
  for (const s of r.signals) {
    if (s.rt < from) continue;
    if (s.rt > to) break;
    n++;
    if (s.junk) {
      junk++;
      continue;
    }
    brake = Math.max(brake, s.brake);
    accel = Math.max(accel, s.accel);
    lat = Math.max(lat, s.lat);
  }
  const fixes = r.fixes.filter((x) => x.rt >= from && x.rt <= to && x.fix.speedMps != null);
  const mph = fixes.map((x) => x.fix.speedMps! * MPS_TO_MPH);
  const over = fixes
    .filter((x) => x.match?.limitMph != null)
    .map((x) => x.fix.speedMps! * MPS_TO_MPH - x.match!.limitMph!);
  return {
    brake,
    accel,
    lat,
    junkPct: n ? junk / n : 0,
    speedMph: mph.length ? mph[Math.floor(mph.length / 2)]! : null,
    minSpeedMph: mph.length ? Math.min(...mph) : null,
    maxOverMph: over.length ? Math.max(...over) : null,
  };
}

function describeEvent(e: ScoredEvent): string {
  const ev = e.event;
  const extra =
    ev.type === 'speeding'
      ? ` +${f1(ev.overMph)} over ${e.road?.limitMph ?? '?'} (${e.road?.limitConfidence ?? '?'})`
      : ev.type === 'rolling_stop'
        ? ` min ${f1(ev.minSpeedMph)} mph`
        : ` peak ${f1(ev.peak)}`;
  const where = e.road?.street ? ` · ${e.road.street}` : '';
  return `${clock(e.peakRt)}  ${ev.type.padEnd(12)} ${ev.tier.padEnd(5)}${extra} · ${ev.speedMph.toFixed(0)} mph${where}`;
}

export interface ReportInput {
  rec: Recording;
  replay: Replay;
  scoring: Scoring;
  fileName: string;
  overrides: readonly string[];
  /** Threshold groups whose value in the recording header differs from the code now. */
  thresholdDrift: string[];
}

export function thresholdDrift(rec: Recording): string[] {
  const recorded = rec.header.thresholds;
  return Object.keys(TUNABLES).filter(
    (k) => k in recorded && JSON.stringify(recorded[k]) !== JSON.stringify(TUNABLES[k]),
  );
}

export function formatReport(input: ReportInput): string {
  const { rec, replay: r, scoring, fileName, overrides } = input;
  const out: string[] = [];
  const h = (title: string) =>
    out.push('', `== ${title} ${'='.repeat(Math.max(0, 70 - title.length))}`);

  out.push(`Drive recording: ${fileName}`);
  out.push(
    `Recorded ${rec.header.startedAt} on ${rec.header.platform} ${rec.header.osVersion}, phone ${rec.header.mount}. Length ${clock(rec.durationMs)}.`,
  );
  if (overrides.length) out.push(`Replayed WITH OVERRIDES: ${overrides.join(', ')}`);
  if (input.thresholdDrift.length) {
    out.push(
      `Note: thresholds changed since this drive (${input.thresholdDrift.join(', ')}). The replay uses today's values.`,
    );
  }

  // --- Health --------------------------------------------------------------
  h('1. Recording health');
  const warn: string[] = [];
  if (!rec.complete)
    warn.push(
      'No end line: the app was closed or crashed before Stop. Data up to that point is fine.',
    );
  if (rec.badLines)
    warn.push(`${rec.badLines} unreadable line(s) (a torn last line after a crash is normal).`);

  const n = rec.samples.length;
  const spanS = n > 1 ? (rec.samples[n - 1]!.t - rec.samples[0]!.t) / 1000 : 0;
  const hz = spanS > 0 ? (n - 1) / spanS : 0;
  let gaps = 0;
  let maxGap = 0;
  for (let i = 1; i < n; i++) {
    const g = rec.samples[i]!.t - rec.samples[i - 1]!.t;
    if (g > 100) gaps++;
    maxGap = Math.max(maxGap, g);
  }
  const junk = r.signals.filter((s) => s.junk).length;
  const gMag = stats(r.signals.map((s) => s.accGMag));
  out.push(
    `Motion: ${n} samples, ${hz.toFixed(1)} Hz average (target 50), ${gaps} gaps over 100 ms (longest ${(maxGap / 1000).toFixed(1)} s).`,
  );
  out.push(`        paused as junk (phone handled/jolted): ${pct(junk, n)} of samples.`);
  out.push(
    `        gravity |accG| median ${f1(gMag?.median)} m/s² (should be ~9.8: this is the units check).`,
  );
  if (hz > 0 && hz < 40)
    warn.push(
      `Motion rate ${hz.toFixed(0)} Hz is low. Was the screen off or the app in the background?`,
    );
  if (gMag && Math.abs(gMag.median - 9.81) > 0.5)
    warn.push('Gravity is not ~9.8 m/s². Units may be wrong on this platform.');

  const fixes = rec.gps.map((g) => g.fix);
  const acc = stats(fixes.flatMap((x) => (x.accuracyM == null ? [] : [x.accuracyM])));
  const poor = fixes.filter(
    (x) => x.accuracyM == null || x.accuracyM > PIPELINE.maxGpsAccuracyM,
  ).length;
  const noSpeed = fixes.filter((x) => x.speedMps == null).length;
  const gpsSpan = rec.gps.length > 1 ? (rec.gps.at(-1)!.rt - rec.gps[0]!.rt) / 1000 : 0;
  out.push(
    `GPS:    ${fixes.length} fixes (${gpsSpan > 0 ? ((fixes.length - 1) / gpsSpan).toFixed(2) : '-'} per s), accuracy median ${f1(acc?.median)} m, p90 ${f1(acc?.p90)} m.`,
  );
  out.push(
    `        worse than ${PIPELINE.maxGpsAccuracyM} m (ignored by detectors): ${pct(poor, fixes.length)}. No speed: ${pct(noSpeed, fixes.length)}.`,
  );
  if (fixes.length && poor / fixes.length > 0.2)
    warn.push(
      'Over 20% of GPS fixes are too inaccurate to use. Open sky, and wait for a fix before driving.',
    );

  const bg = rec.app.filter((a) => a.state !== 'active').length;
  if (bg) warn.push(`App left the foreground ${bg} time(s). Motion stops while away.`);

  const okFetch = rec.overpass.filter((o) => o.ok).length;
  const errors = [...new Set(rec.overpass.filter((o) => !o.ok).map((o) => o.error))];
  const matched = r.fixes.filter((x) => x.match).length;
  const posted = r.fixes.filter((x) => x.match?.limitConfidence === 'posted').length;
  const inferred = r.fixes.filter((x) => x.match?.limitConfidence === 'inferred').length;
  out.push(
    `Road:   Overpass fetches ok ${okFetch}, failed ${rec.overpass.length - okFetch}${errors.length ? ` (${errors.join('; ')})` : ''}.`,
  );
  out.push(
    `        fixes matched to a street: ${pct(matched, r.fixes.length)}; limit posted ${pct(posted, r.fixes.length)}, inferred ${pct(inferred, r.fixes.length)}.`,
  );
  if (okFetch === 0)
    warn.push(
      'No road data at all: speeding and rolling stops could not be checked on this drive.',
    );

  const base = r.signals.filter((s) => !s.junk && segmentAt(rec.segments, s.rt) === 'baseline');
  if (base.length) {
    const b = (k: 'brake' | 'accel' | 'lat') => Math.max(0, ...base.map((s) => s[k]));
    out.push(
      `Noise:  during "baseline" the largest brake ${f1(b('brake'))}, accel ${f1(b('accel'))}, lateral ${f1(b('lat'))} m/s² (should all be well under ${HARD_BRAKE.coach.start}).`,
    );
  }
  out.push(
    `Markers: ${rec.markers.length}. Segments: ${['baseline', ...rec.segments.map((s) => s.segment)].join(' → ')}.`,
  );
  for (const w of warn) out.push(`  ! ${w}`);

  // --- Detection score -----------------------------------------------------
  h('2. Detection vs your markers');
  out.push(
    `Live on the phone: ${rec.events.length} events. Replayed now: ${r.events.length} events.`,
  );
  if (
    !overrides.length &&
    !input.thresholdDrift.length &&
    Math.abs(rec.events.length - r.events.length) > 1
  ) {
    out.push(
      '  (Replay differs from live by more than one. Usually road events: live had no road data until the first fetch finished.)',
    );
  }
  out.push('');
  out.push('type          markers  caught  missed   events  confirmed  false alarm  unconfirmed');
  for (const type of EVENT_ORDER) {
    const expecting = scoring.markers.filter((m) => def(m.marker.marker).expects?.includes(type));
    const caught = expecting.filter((m) => m.passed).length;
    const evs = scoring.events.filter((e) => e.event.type === type);
    const c = (v: Verdict) => evs.filter((e) => e.verdict === v).length;
    out.push(
      `${type.padEnd(14)}${String(expecting.length).padStart(7)}${String(caught).padStart(8)}${String(expecting.length - caught).padStart(8)}${String(evs.length).padStart(9)}${String(c('confirmed')).padStart(11)}${String(c('false_alarm')).padStart(13)}${String(c('unconfirmed')).padStart(13)}`,
    );
  }
  out.push('');
  out.push(
    'caught/missed: markers that expected this event. false alarm: fired during a "normal ..."',
  );
  out.push(
    'marker, a bump, phone handling, or you tapped "App was wrong". unconfirmed: fired with no',
  );
  out.push(
    'marker nearby; in the baseline and normal_driving segments these are most likely false alarms.',
  );

  const missed = scoring.markers.filter((m) => m.passed === false && def(m.marker.marker).expects);
  if (missed.length) {
    out.push('', 'Missed (you marked it, the app did not fire):');
    for (const m of missed)
      out.push(`  ${clock(m.marker.rt)}  ${def(m.marker.marker).label}  [${m.segment}]`);
  }
  const falseAlarms = scoring.events.filter((e) => e.verdict === 'false_alarm');
  if (falseAlarms.length) {
    out.push('', 'False alarms:');
    for (const e of falseAlarms) out.push(`  ${describeEvent(e)}  ← ${e.reason}`);
  }
  const unconfirmed = scoring.events.filter((e) => e.verdict === 'unconfirmed');
  if (unconfirmed.length) {
    out.push('', 'Unconfirmed (no marker nearby):');
    for (const e of unconfirmed) out.push(`  ${describeEvent(e)}  [${e.segment}]`);
  }

  // --- Tuning data ---------------------------------------------------------
  h('3. Tuning data: signal peaks around each marker');
  out.push('For each marker: the largest filtered signal in its window (same numbers the');
  out.push('thresholds compare against). Good thresholds sit ABOVE every "normal" row and');
  out.push('BELOW every "hard" row of the same kind.');
  const byType = new Map<MarkerType, ScoredMarker[]>();
  for (const m of scoring.markers)
    byType.set(m.marker.marker, [...(byType.get(m.marker.marker) ?? []), m]);
  for (const [type, ms] of byType) {
    const sig = markerSignal(type);
    if (!sig) continue;
    const d = def(type);
    const rows = ms.map((m) => {
      const w = windowAround(
        r,
        m.marker.rt - d.windowS[0] * 1000,
        m.marker.rt + d.windowS[1] * 1000,
      );
      return { m, w, v: sig.get(w) };
    });
    const st = stats(rows.flatMap((x) => (x.v == null ? [] : [x.v])));
    out.push(
      '',
      `${d.label} (${ms.length}): ${sig.name} min ${f1(st?.min)} · median ${f1(st?.median)} · max ${f1(st?.max)}`,
    );
    out.push(`  thresholds now: ${sig.thresholds}`);
    for (const { m, w, v } of rows) {
      const result =
        m.passed === null
          ? ''
          : d.expects
            ? m.passed
              ? 'caught'
              : 'MISSED'
            : m.passed
              ? 'ok'
              : 'FALSE ALARM';
      out.push(
        `  ${clock(m.marker.rt)}  ${f1(v).padStart(5)}  (brake ${f1(w.brake)} accel ${f1(w.accel)} lat ${f1(w.lat)} · ${f1(w.speedMph)} mph${w.junkPct > 0.1 ? ` · ${pct(w.junkPct, 1)} junk` : ''})  ${result}`,
      );
    }
  }

  // --- All events ----------------------------------------------------------
  h('4. Every replayed event');
  if (!scoring.events.length) out.push('None.');
  for (const e of scoring.events) out.push(`  ${describeEvent(e)}  ${e.verdict}`);
  out.push('');
  return out.join('\n');
}
