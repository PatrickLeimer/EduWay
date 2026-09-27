/**
 * Drive recording file format (dev only, master doc §9: "a dev-only recorder can
 * save motion data to a local file on the tester's phone (never uploaded)").
 *
 * Pure, no RN/Expo imports: the phone writes it and scripts/drive-replay reads it.
 *
 * The file is NDJSON: one JSON object per line, appended about once a second so
 * a crash loses at most a second. Lines are NOT in time order (motion is written
 * in chunks); readers sort by time. `rt` is ms since recording start.
 */
import type { DraftEvent, EventType, GpsFix, MotionSample } from '@edudriver/shared';

import type { RoadMatch } from '../contracts';

export const RECORDING_VERSION = 1;

/** Event types the motion detector emits. */
export const MOTION_EVENT_TYPES: readonly EventType[] = [
  'hard_brake',
  'hard_accel',
  'rough_turn',
  'swerve',
];

export interface MarkerDef {
  /** Button text on the recorder screen. */
  label: string;
  /** What the passenger means: the app SHOULD fire one of these. */
  expects?: readonly EventType[];
  /** The app should NOT fire any of these (known-normal driving). */
  rulesOut?: readonly EventType[];
  /**
   * Seconds before and after the tap in which a matching event counts. Taps come
   * after the maneuver (reaction time); road events are timed at their peak or
   * slowest point, which can be well before or after the tap.
   */
  windowS: readonly [before: number, after: number];
}

const MOTION_WINDOW = [10, 3] as const;
const ROAD_WINDOW = [30, 30] as const;

/** Passenger marker buttons, in screen order. */
export const MARKERS = {
  hard_brake: { label: 'Hard brake', expects: ['hard_brake'], windowS: MOTION_WINDOW },
  normal_brake: { label: 'Normal brake', rulesOut: ['hard_brake'], windowS: MOTION_WINDOW },
  hard_accel: { label: 'Hard start', expects: ['hard_accel'], windowS: MOTION_WINDOW },
  normal_accel: { label: 'Normal start', rulesOut: ['hard_accel'], windowS: MOTION_WINDOW },
  sharp_turn: { label: 'Sharp turn', expects: ['rough_turn'], windowS: MOTION_WINDOW },
  normal_turn: { label: 'Normal turn', rulesOut: ['rough_turn'], windowS: MOTION_WINDOW },
  swerve: { label: 'Swerve', expects: ['swerve'], windowS: MOTION_WINDOW },
  lane_change: { label: 'Lane change', rulesOut: ['swerve'], windowS: MOTION_WINDOW },
  bump: { label: 'Bump / pothole', rulesOut: MOTION_EVENT_TYPES, windowS: MOTION_WINDOW },
  phone_moved: {
    label: 'Phone moved / touched',
    rulesOut: MOTION_EVENT_TYPES,
    windowS: MOTION_WINDOW,
  },
  full_stop: { label: 'Full stop at sign', rulesOut: ['rolling_stop'], windowS: ROAD_WINDOW },
  rolling_stop: { label: 'Rolling stop', expects: ['rolling_stop'], windowS: ROAD_WINDOW },
  speeding: { label: 'Over the limit', expects: ['speeding'], windowS: ROAD_WINDOW },
  /** Special: flags the most recent live event as wrong. */
  false_alarm: { label: 'App was wrong (false alarm)', windowS: [15, 0] },
} as const satisfies Record<string, MarkerDef>;

export type MarkerType = keyof typeof MARKERS;
export const MARKER_TYPES = Object.keys(MARKERS) as MarkerType[];

/** What part of the test plan the car is in. Used to break down the report. */
export const SEGMENTS = [
  'baseline',
  'normal_driving',
  'parking_lot',
  'stop_signs',
  'other',
] as const;
export type Segment = (typeof SEGMENTS)[number];

export type Mount = 'mounted' | 'loose';

export interface HeaderLine {
  k: 'header';
  v: number;
  startedAt: string;
  /** Epoch ms of recording start. Every `rt` and motion `t` is relative to it. */
  startMs: number;
  platform: string;
  osVersion: string;
  mount: Mount;
  /** Snapshot of @edudriver/shared thresholds in effect for this recording. */
  thresholds: Record<string, unknown>;
}

/** Motion chunk: [t, ax, ay, az, gx, gy, gz, rx, ry, rz], t in ms since start. */
export interface MotionLine {
  k: 'motion';
  s: number[][];
}

export interface GpsLine {
  k: 'gps';
  /** When the fix reached the app (the detector sees it then). */
  rt: number;
  /** As delivered by expo-location; `fix.t` is epoch ms. */
  fix: GpsFix;
}

export interface EventLine {
  k: 'event';
  rt: number;
  source: 'motion' | 'road';
  event: DraftEvent;
  road: RoadMatch | null;
}

export interface MarkerLine {
  k: 'marker';
  rt: number;
  marker: MarkerType;
}

export interface SegmentLine {
  k: 'segment';
  rt: number;
  segment: Segment;
}

export interface OverpassLine {
  k: 'overpass';
  rt: number;
  query: string;
  ok: boolean;
  error?: string;
  response?: unknown;
}

export interface AppStateLine {
  k: 'app';
  rt: number;
  state: string;
}

export interface EndLine {
  k: 'end';
  rt: number;
}

export type RecordingLine =
  | HeaderLine
  | MotionLine
  | GpsLine
  | EventLine
  | MarkerLine
  | SegmentLine
  | OverpassLine
  | AppStateLine
  | EndLine;

const round4 = (n: number) => Math.round(n * 1e4) / 1e4;

export function encodeSample(s: MotionSample, startMs: number): number[] {
  return [
    Math.round(s.t - startMs),
    round4(s.acc.x),
    round4(s.acc.y),
    round4(s.acc.z),
    round4(s.accG.x),
    round4(s.accG.y),
    round4(s.accG.z),
    round4(s.rot.x),
    round4(s.rot.y),
    round4(s.rot.z),
  ];
}

export function decodeSample(row: number[], startMs: number): MotionSample {
  const [t = 0, ax = 0, ay = 0, az = 0, gx = 0, gy = 0, gz = 0, rx = 0, ry = 0, rz = 0] = row;
  return {
    t: startMs + t,
    acc: { x: ax, y: ay, z: az },
    accG: { x: gx, y: gy, z: gz },
    rot: { x: rx, y: ry, z: rz },
  };
}

export interface Recording {
  header: HeaderLine;
  /** Sorted by t, absolute epoch ms. */
  samples: MotionSample[];
  gps: GpsLine[];
  events: EventLine[];
  markers: MarkerLine[];
  segments: SegmentLine[];
  overpass: OverpassLine[];
  app: AppStateLine[];
  /** ms since start of the last thing recorded. */
  durationMs: number;
  /** False when the file has no end line (app crashed or was killed). */
  complete: boolean;
  /** Lines that could not be parsed (a torn last line after a crash is normal). */
  badLines: number;
}

export function parseRecording(text: string): Recording {
  let header: HeaderLine | null = null;
  const rows: number[][] = [];
  const out = {
    gps: [] as GpsLine[],
    events: [] as EventLine[],
    markers: [] as MarkerLine[],
    segments: [] as SegmentLine[],
    overpass: [] as OverpassLine[],
    app: [] as AppStateLine[],
  };
  let end: EndLine | null = null;
  let badLines = 0;

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    let rec: RecordingLine;
    try {
      rec = JSON.parse(line) as RecordingLine;
    } catch {
      badLines++;
      continue;
    }
    switch (rec.k) {
      case 'header':
        header = rec;
        break;
      case 'motion':
        rows.push(...rec.s);
        break;
      case 'gps':
        out.gps.push(rec);
        break;
      case 'event':
        out.events.push(rec);
        break;
      case 'marker':
        out.markers.push(rec);
        break;
      case 'segment':
        out.segments.push(rec);
        break;
      case 'overpass':
        out.overpass.push(rec);
        break;
      case 'app':
        out.app.push(rec);
        break;
      case 'end':
        end = rec;
        break;
      default:
        badLines++;
    }
  }
  if (!header) throw new Error('Not a drive recording: no header line');
  if (header.v !== RECORDING_VERSION) {
    throw new Error(`Recording version ${header.v}; this reader handles ${RECORDING_VERSION}`);
  }

  const startMs = header.startMs;
  const samples = rows.map((r) => decodeSample(r, startMs)).sort((a, b) => a.t - b.t);
  const byRt = <T extends { rt: number }>(xs: T[]) => xs.sort((a, b) => a.rt - b.rt);
  const lastSample = samples.at(-1);
  const durationMs = Math.max(
    end?.rt ?? 0,
    lastSample ? lastSample.t - startMs : 0,
    ...out.gps.map((g) => g.rt),
  );

  return {
    header,
    samples,
    gps: byRt(out.gps),
    events: byRt(out.events),
    markers: byRt(out.markers),
    segments: byRt(out.segments),
    overpass: byRt(out.overpass),
    app: byRt(out.app),
    durationMs,
    complete: end !== null,
    badLines,
  };
}

/** Segment in effect at `rt` (the recording starts in `baseline`). */
export function segmentAt(segments: readonly SegmentLine[], rt: number): Segment {
  let seg: Segment = 'baseline';
  for (const s of segments) {
    if (s.rt > rt) break;
    seg = s.segment;
  }
  return seg;
}

/** "mm:ss" from ms since start. */
export function clock(rtMs: number): string {
  const s = Math.max(0, Math.round(rtMs / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
