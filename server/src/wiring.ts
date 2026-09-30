/**
 * Server composition root (WS3): picks real or mock per module from the
 * USE_REAL_* env flags. Defaults are all mocks so the server runs with no
 * database or API keys.
 */
import { createCoachService, createDebriefRevoicer, createMockCoachService } from './coach';
import type { Config } from './config';
import {
  connectDb,
  createGridFsAudioStore,
  createInMemoryTripsRepo,
  createMongoTripsRepo,
  type AudioStore,
} from './db';
import type { RouteDeps } from './routes';
import { mockScoreTrip, scoreTrip } from './scoring';
import { createGoogleStreetView } from './streetview';

export async function createDeps(config: Config): Promise<RouteDeps> {
  let repo = createInMemoryTripsRepo();
  // Debrief mp3s in GridFS (DEBRIEF_AUDIO_IN_DB); undefined = files on disk.
  let audioStore: AudioStore | undefined;
  if (config.USE_REAL_DB) {
    if (!config.MONGODB_URI) throw new Error('USE_REAL_DB=true requires MONGODB_URI');
    const db = await connectDb(config.MONGODB_URI, config.MONGODB_DB);
    repo = createMongoTripsRepo(db);
    if (config.DEBRIEF_AUDIO_IN_DB) audioStore = createGridFsAudioStore(db);
  }

  const store = audioStore;
  const coachOptions = {
    geminiApiKey: config.GEMINI_API_KEY,
    geminiModel: config.GEMINI_MODEL,
    elevenLabsApiKey: config.ELEVENLABS_API_KEY,
    elevenLabsVoiceId: config.ELEVENLABS_VOICE_ID,
    saveAudio: store ? (file: string, mp3: Buffer) => store.put(file, mp3) : undefined,
  };
  const coach = config.USE_REAL_COACH ? createCoachService(coachOptions) : createMockCoachService();

  // Street View (§12) is on whenever its server key is set; no mock needed (absent = off).
  const streetView = config.GOOGLE_STREETVIEW_KEY
    ? createGoogleStreetView({
        staticKey: config.GOOGLE_STREETVIEW_KEY,
        mapsJsKey: config.GOOGLE_MAPS_JS_KEY,
      })
    : undefined;

  return {
    repo,
    scoreTrip: config.USE_REAL_SCORING ? scoreTrip : mockScoreTrip,
    coach,
    streetView,
    audio: store
      ? {
          store,
          revoice: config.USE_REAL_COACH ? createDebriefRevoicer(coachOptions) : undefined,
        }
      : undefined,
  };
}
