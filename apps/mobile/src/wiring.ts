/**
 * Composition root: picks the real or mock implementation of every module.
 * Owned by WS2; other workstreams ask before editing (root CLAUDE.md).
 *
 * Every module defaults to its mock so the app runs end to end today. Flip one
 * flag to true when that module's real implementation is ready. Flags are
 * independent: e.g. real detection + mock road + mock api is a valid combo.
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

/** One flag per module. false = mock (default), true = real implementation. */
export const USE_REAL: ModuleFlags = {
  detection: false,
  road: false,
  trip: false,
  api: false,
  voice: false,
  /** Real GPS (expo-location) for the real TripSession; false replays the fixture drive. */
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
