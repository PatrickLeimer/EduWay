/**
 * Generates the bundled live-alert clips with ElevenLabs (WS4). STUB.
 * Master doc §7 "Live ElevenLabs alerts": clips ship inside the app so alerts
 * play instantly and offline.
 *
 * Run from the repo root: `npm run alert-clips`
 * Reads ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID from server/.env.
 * Writes apps/mobile/assets/alerts/<id>.mp3 (commit the mp3s; they are small).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

const here = dirname(fileURLToPath(import.meta.url));

export const ManifestSchema = z.object({
  clips: z.array(z.object({ id: z.string().regex(/^[a-z0-9_]+$/), text: z.string().min(1) })),
});

export const OUT_DIR = join(here, '../../apps/mobile/assets/alerts');

export function loadManifest() {
  return ManifestSchema.parse(JSON.parse(readFileSync(join(here, 'clips.manifest.json'), 'utf8')));
}

async function main() {
  const manifest = loadManifest();
  // TODO(WS4, §7): load server/.env with dotenv, then for each clip call ElevenLabs TTS
  //   (@elevenlabs/elevenlabs-js textToSpeech.convert(voiceId, { text })) and write
  //   `${OUT_DIR}/${id}.mp3`. Skip clips that already exist unless --force is passed.
  console.log(`TODO(WS4): would generate ${manifest.clips.length} clips into ${OUT_DIR}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
