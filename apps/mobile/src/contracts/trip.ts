/**
 * WS2 Trip session boundary. Master doc §4 (lifecycle), §7 (pipeline), §9 (trace).
 * PROTECTED CONTRACT (see root CLAUDE.md).
 *
 * The trip session is the conductor: it owns the GPS subscription and wires
 * MotionDetector, PhoneUseMonitor, RoadCache/RoadEventDetector, AlertPlayer and
 * ApiClient together. UI screens talk only to this (and to ApiClient for
 * history screens).
 */
import type {
  CreateTripRequest,
  CreateTripResponse,
  GpsFix,
  RecordedEvent,
  TraceUpload,
} from '@eduway/shared';

import type { Subscribable } from './common';
import type { RoadMatch } from './road';

export type TripStatus =
  | 'idle' // no trip
  | 'starting' // permissions, clip preload, first road fetch
  | 'driving'
  | 'uploading' // ended, sending to backend
  | 'queued' // ended, upload failed or offline; will retry (§4 "Offline")
  | 'done' // coaching received
  | 'error';

export interface StartTripOptions {
  /** "I'm a passenger": record but skip scoring (§4). */
  passenger: boolean;
  /** Full-screen driving lock (§4, default on). */
  lockEnabled: boolean;
}

/** Whether End Trip is allowed right now (§4: stopped for 30+ s). */
export interface CanEndResult {
  ok: boolean;
  /** Human-readable reason when !ok, e.g. "Stop for 12 more seconds". */
  reason?: string;
}

/** Snapshot rendered by the UI. Treat as immutable: a new object is emitted on every change. */
export interface TripState {
  status: TripStatus;
  tripStartedAt: string | null;
  options: StartTripOptions | null;
  /** Events so far, with road context and alert status. */
  events: RecordedEvent[];
  latestFix: GpsFix | null;
  latestRoad: RoadMatch | null;
  /** Number of fixes in the route trace so far. */
  traceLength: number;
  distanceMi: number;
  /** Seconds the car has been continuously stopped (drives canEnd). */
  stoppedForS: number;
  /** Set when status is 'done'. */
  result: CreateTripResponse | null;
  error: string | null;
}

export interface TripSession extends Subscribable<TripState> {
  start(opts: StartTripOptions): Promise<void>;
  canEnd(): CanEndResult;
  /** Stop sensors, build the upload and send it (or queue it when offline). */
  end(): Promise<CreateTripResponse | null>;
  /** Back to idle after the user leaves the result screen. */
  reset(): void;
  getState(): TripState;
  /** Route trace recorded so far (debug screens and upload). */
  getTrace(): TraceUpload;
  /**
   * The driving screen calls this from its root touch handler. Forwarded to
   * PhoneUseMonitor.reportTouch so ui/ never talks to detection/ directly.
   */
  reportTouch(): void;
  /**
   * The driving screen calls this right before opening navigation or an
   * emergency call. Forwarded to PhoneUseMonitor.reportSafeExit.
   */
  reportSafeExit(): void;
}

/** A trip upload waiting for connectivity (§4 "Offline"). */
export interface QueuedUpload {
  id: string;
  createdAt: string;
  /** The exact POST /trips body, ready to resend. */
  body: CreateTripRequest;
}

/**
 * Storage for uploads that could not be sent. The scaffold ships an in-memory
 * store; a persistent one needs an approved dependency (open decision, see
 * docs/workstreams.md).
 */
export interface UploadQueueStore {
  enqueue(item: QueuedUpload): Promise<void>;
  peekAll(): Promise<QueuedUpload[]>;
  remove(id: string): Promise<void>;
}
