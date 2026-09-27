/**
 * Generates the bundled live-alert clips with ElevenLabs (WS4).
 * Master doc §7 "Live ElevenLabs alerts": clips ship inside the app so alerts
 * play instantly and offline.
 *
 * Run from the repo root: `npm run alert-clips` (add `-- --force` to regenerate
 * existing clips, e.g. after changing the voice, model, or a clip's text).
 * Reads ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID from server/.env.
 * Writes apps/mobile/assets/alerts/<id>.mp3 (commit the mp3s; they are small).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

import { ELEVENLABS_MODEL_ID, textToSpeechMp3 } from '../../server/src/coach/elevenlabs';

const here = dirname(fileURLToPath(import.meta.url));

export const ManifestSchema = z.object({
  clips: z.array(z.object({ id: z.string().regex(/^[a-z0-9_]+$/), text: z.string().min(1) })),
});

export const OUT_DIR = join(here, '../../apps/mobile/assets/alerts');

export function loadManifest() {
  return ManifestSchema.parse(JSON.parse(readFileSync(join(here, 'clips.manifest.json'), 'utf8')));
}

async function main() {
  const force = process.argv.includes('--force');
  loadEnv({ path: join(here, '../../server/.env'), quiet: true });
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) {
    throw new Error('Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID in server/.env');
  }

  const { clips } = loadManifest();
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Voice ${voiceId}, model ${ELEVENLABS_MODEL_ID}, ${clips.length} clips → ${OUT_DIR}`);
  for (const { id, text } of clips) {
    const file = join(OUT_DIR, `${id}.mp3`);
    if (!force && existsSync(file)) {
      console.log(`  skip ${id} (exists)`);
      continue;
    }
    writeFileSync(file, await textToSpeechMp3(text, { apiKey, voiceId }));
    console.log(`  wrote ${id}.mp3  "${text}"`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  // No top-level await: the repo root is not "type": "module", so tsx runs this as CommonJS.
  main().catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  });
}
