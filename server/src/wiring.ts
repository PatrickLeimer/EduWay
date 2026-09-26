/**
 * Server composition root (WS3): picks real or mock per module from the
 * USE_REAL_* env flags. Defaults are all mocks so the server runs with no
 * database or API keys.
 */
import { createCoachService, createMockCoachService } from './coach';
import type { Config } from './config';
import { connectDb, createInMemoryTripsRepo, createMongoTripsRepo } from './db';
import type { RouteDeps } from './routes';
import { mockScoreTrip, scoreTrip } from './scoring';

export async function createDeps(config: Config): Promise<RouteDeps> {
  let repo = createInMemoryTripsRepo();
  if (config.USE_REAL_DB) {
    if (!config.MONGODB_URI) throw new Error('USE_REAL_DB=true requires MONGODB_URI');
    repo = createMongoTripsRepo(await connectDb(config.MONGODB_URI, config.MONGODB_DB));
  }

  const coach = config.USE_REAL_COACH
    ? createCoachService({
        geminiApiKey: config.GEMINI_API_KEY,
        geminiModel: config.GEMINI_MODEL,
        elevenLabsApiKey: config.ELEVENLABS_API_KEY,
        elevenLabsVoiceId: config.ELEVENLABS_VOICE_ID,
      })
    : createMockCoachService();

  return {
    repo,
    scoreTrip: config.USE_REAL_SCORING ? scoreTrip : mockScoreTrip,
    coach,
  };
}
