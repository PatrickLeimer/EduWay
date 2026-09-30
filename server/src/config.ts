/**
 * Server configuration from environment (server/.env, never committed).
 * Parsed once at startup; everything else imports `config` instead of reading
 * process.env directly. Keep server/.env.example in sync with this schema.
 */
import 'dotenv/config';
import { z } from 'zod';

const flag = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),

  MONGODB_URI: z.string().optional(),
  MONGODB_DB: z.string().default('edudriver'),

  GEMINI_API_KEY: z.string().optional(),
  /** TODO(WS4): pick the Gemini model at the event; check current model ids in the Gemini docs. */
  GEMINI_MODEL: z.string().optional(),

  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().optional(),

  /** Street View (§12). Static API + metadata; without it the feature is off. */
  GOOGLE_STREETVIEW_KEY: z.string().optional(),
  /** Maps JavaScript API for the Street View panorama page; referrer-restricted to this backend. */
  GOOGLE_MAPS_JS_KEY: z.string().optional(),

  /** Public base URL used to build debrief audio links, e.g. https://api.example.com. */
  PUBLIC_BASE_URL: z.string().optional(),

  // One flag per module: false = mock (default), true = real implementation.
  USE_REAL_DB: flag,
  USE_REAL_SCORING: flag,
  USE_REAL_COACH: flag,

  /**
   * Keep debrief mp3s in MongoDB GridFS (survives Render restarts) and re-voice
   * lost ones. Needs USE_REAL_DB. Set false to go back to files on disk.
   */
  DEBRIEF_AUDIO_IN_DB: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
});

export type Config = z.infer<typeof EnvSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid server environment:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
