/**
 * Expo wiring for the drive recorder: real sensors, the recording file, and the
 * share sheet. Always uses the REAL detection and road modules, whatever the
 * USE_REAL flags in wiring.ts say, because that is the point of a test drive.
 *
 * Files live in the app's document directory under drives/ and never leave the
 * phone unless the tester shares them (master doc §9).
 *
 * Docs (SDK 57): https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/
 *                https://docs.expo.dev/versions/v57.0.0/sdk/sharing/
 */
import {
  HARD_ACCEL,
  HARD_BRAKE,
  PHONE_USE,
  PIPELINE,
  ROAD,
  ROLLING_STOP,
  ROUGH_TURN,
  SPEEDING,
  SWERVE,
} from '@edudriver/shared';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { AppState, Platform } from 'react-native';

import { createExpoMotionSource, createMotionDetector } from '../detection';
import { createOverpassRoadCache, createRoadEventDetector } from '../road';
import { createExpoLocationSource } from '../trip';

import { createDriveRecorder, type DriveRecorder, type OverpassFetch } from './DriveRecorder';
import type { Mount } from './format';

/**
 * Same endpoint and request as road/OverpassRoadCache. Duplicated because road/
 * does not export its fetcher; keep the two in sync.
 */
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

const fetchOverpass: OverpassFetch = async (query) => {
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams({ data: query }).toString(),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  const json: unknown = await res.json();
  if (
    !json ||
    typeof json !== 'object' ||
    !Array.isArray((json as { elements?: unknown }).elements)
  ) {
    throw new Error('Overpass response missing elements');
  }
  return json;
};

type RoadCacheFetcher = Parameters<typeof createOverpassRoadCache>[0];

const drivesDir = () => new Directory(Paths.document, 'drives');

function fileName(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
  return `drive-${stamp}-${Platform.OS}.ndjson`;
}

export interface PhoneRecording {
  recorder: DriveRecorder;
  fileName: string;
  /** Start recording. Rejects are reported through getStatus(). */
  start(mount: Mount): Promise<void>;
  /** Stop, save, and release sensors and the AppState listener. */
  stop(): void;
}

export function createPhoneRecording(): PhoneRecording {
  const dir = drivesDir();
  dir.create({ idempotent: true, intermediates: true });
  const name = fileName(new Date());
  const file = new File(dir, name);
  file.create();

  const recorder = createDriveRecorder({
    motionSource: createExpoMotionSource(),
    location: createExpoLocationSource(),
    motionDetector: createMotionDetector(),
    createRoadCache: (fetcher) => createOverpassRoadCache(fetcher as RoadCacheFetcher),
    fetchOverpass,
    createRoadDetector: createRoadEventDetector,
    sink: { append: (text) => file.write(text, { append: true }) },
    now: Date.now,
    flushEveryMs: 1000,
  });

  const appState = AppState.addEventListener('change', (s) => recorder.onAppState(s));

  return {
    recorder,
    fileName: name,
    start: (mount) =>
      recorder.start({
        platform: Platform.OS,
        osVersion: String(Platform.Version),
        mount,
        thresholds: {
          PIPELINE,
          HARD_BRAKE,
          HARD_ACCEL,
          ROUGH_TURN,
          SWERVE,
          SPEEDING,
          ROLLING_STOP,
          PHONE_USE,
          ROAD,
        },
      }),
    stop() {
      recorder.stop();
      appState.remove();
    },
  };
}

export interface SavedRecording {
  name: string;
  sizeBytes: number;
  uri: string;
}

/** Saved recordings, newest first. */
export function listRecordings(): SavedRecording[] {
  const dir = drivesDir();
  if (!dir.exists) return [];
  return dir
    .list()
    .filter((f): f is File => f instanceof File && f.name.endsWith('.ndjson'))
    .map((f) => ({ name: f.name, sizeBytes: f.size, uri: f.uri }))
    .sort((a, b) => b.name.localeCompare(a.name));
}

/** Opens the share sheet (AirDrop, email, Google Drive, Files...). */
export async function shareRecording(rec: SavedRecording): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available here');
  await Sharing.shareAsync(rec.uri, {
    mimeType: 'text/plain',
    UTI: 'public.plain-text',
    dialogTitle: rec.name,
  });
}

export function deleteRecording(rec: SavedRecording): void {
  new File(rec.uri).delete();
}
