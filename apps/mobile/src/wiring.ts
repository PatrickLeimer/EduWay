/**
 * Composition root: picks the real or mock implementation of every module.
 * Owned by WS2; other workstreams ask before editing (root CLAUDE.md).
 *
 * Flags are independent: e.g. real detection + mock road + mock api is a valid
 * combo. WS2's road and trip flags are on; other workstreams flip their own.
 *
 * Note: the trip flag chooses between the self-contained mock drive and the
 * real TripSession. The real session pulls in whichever detection/road/voice/api
 * implementations the other flags select.
 */
import type {
  AlertPlayer,
  ApiClient,
  DebriefPlayer,
  MotionDetector,
  MotionSource,
  PhoneUseMonitor,
  RoadCache,
  RoadEventDetector,
  TripSession,
} from './contracts';
import { createHttpApiClient, createMockApiClient } from './api';
import {
  createExpoMotionSource,
  createMockMotionDetector,
  createMockMotionSource,
  createMockPhoneUseMonitor,
  createMotionDetector,
  createPhoneUseMonitor,
} from './detection';
import {
  createMockRoadCache,
  createMockRoadEventDetector,
  createOverpassRoadCache,
  createRoadEventDetector,
} from './road';
import {
  createExpoLocationSource,
  createFixtureLocationSource,
  createInMemoryUploadQueue,
  createMockTripSession,
  createTripSession,
} from './trip';
import {
  createAlertPlayer,
  createDebriefPlayer,
  createMockAlertPlayer,
  createMockDebriefPlayer,
} from './voice';

export interface ModuleFlags {
  detection: boolean;
  road: boolean;
  trip: boolean;
  api: boolean;
  voice: boolean;
  gps: boolean;
}

/**
 * One flag per module. false = mock, true = real implementation.
 * WS2 owns this file. Real: phone GPS and sensors, road data, the bundled voice
 * clips, and the server API at EXPO_PUBLIC_API_URL (apps/mobile/.env). The phone
 * must be able to reach that URL (eduroam blocks phone-to-laptop traffic; use a
 * tunnel, hotspot, or a deployed server). For a desk demo, turn on "Test drive".
 */
export const USE_REAL: ModuleFlags = {
  detection: true,
  road: true,
  trip: true,
  api: true,
  voice: true,
  /** Real GPS (expo-location) for the real TripSession; false replays the fixture drive. */
  gps: true,
};

/**
 * "Test drive" (Settings / Dev tools): the phone doesn't have to move. GPS replays
 * the fixture drive and detection replays the fixture events; road and voice stay
 * real, so live alerts play. `api` is real too, so the synthetic drive uploads to
 * the server and gets real Gemini coaching (not the fixture). Needs
 * EXPO_PUBLIC_API_URL to reach the server; if it can't, the trip is queued.
 */
export const DEMO_FLAGS: ModuleFlags = {
  detection: false,
  road: true,
  trip: true,
  api: true,
  voice: true,
  gps: false,
};

export interface AppModules {
  motionSource: MotionSource;
  motionDetector: MotionDetector;
  phoneUse: PhoneUseMonitor;
  roadCache: RoadCache;
  roadDetector: RoadEventDetector;
  alerts: AlertPlayer;
  debrief: DebriefPlayer;
  api: ApiClient;
  trip: TripSession;
}

export function createModules(flags: ModuleFlags = USE_REAL): AppModules {
  const motionSource = flags.detection ? createExpoMotionSource() : createMockMotionSource();
  const motionDetector = flags.detection ? createMotionDetector() : createMockMotionDetector();
  const phoneUse = flags.detection ? createPhoneUseMonitor() : createMockPhoneUseMonitor();

  const roadCache = flags.road ? createOverpassRoadCache() : createMockRoadCache();
  const roadDetector = flags.road
    ? createRoadEventDetector(roadCache)
    : createMockRoadEventDetector();

  const alerts = flags.voice ? createAlertPlayer() : createMockAlertPlayer();
  const debrief = flags.voice ? createDebriefPlayer() : createMockDebriefPlayer();

  const api = flags.api ? createHttpApiClient() : createMockApiClient();

  const trip = flags.trip
    ? createTripSession({
        location: flags.gps ? createExpoLocationSource() : createFixtureLocationSource(),
        motionSource,
        motionDetector,
        phoneUse,
        roadCache,
        roadDetector,
        alerts,
        debrief,
        api,
        queue: createInMemoryUploadQueue(),
      })
    : createMockTripSession({ api, alerts });

  return {
    motionSource,
    motionDetector,
    phoneUse,
    roadCache,
    roadDetector,
    alerts,
    debrief,
    api,
    trip,
  };
}

/** The app-wide instance. App.tsx passes it to ui/. */
export const modules: AppModules = createModules();

let demoModules: AppModules | null = null;

/** Modules for the "Test drive" mode (DEMO_FLAGS), created on first use. */
export function getDemoModules(): AppModules {
  demoModules ??= createModules(DEMO_FLAGS);
  return demoModules;
}
