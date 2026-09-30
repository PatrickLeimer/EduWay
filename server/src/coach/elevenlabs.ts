/**
 * ElevenLabs voice (WS4). Master doc §11.
 * `textToSpeechMp3` is shared with scripts/alert-clips so live alerts and the
 * debrief use the same voice and model.
 *
 * Debrief audio: the coaching chat is spoken as one track and handed to
 * `save` (wiring stores it in MongoDB GridFS, served by routes/audio.ts at
 * DEBRIEF_AUDIO_ROUTE); without `save` it is written to DEBRIEF_AUDIO_DIR.
 * The URL returned is relative ("/audio/<tripId>.mp3"); the phone resolves it
 * against its API base URL, so it works on a LAN, a tunnel, or a deployed host.
 *
 * The SDK is imported lazily: loading it under Vitest takes minutes, and every
 * server test imports this file through service.ts.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Flash is the cheaper model (about half the credits per character of
 * eleven_multilingual_v2), used while we are on the free plan. Switch to
 * eleven_multilingual_v2 for higher quality, then regenerate clips with --force.
 */
export const ELEVENLABS_MODEL_ID = 'eleven_flash_v2_5';

/** server/audio (gitignored). */
export const DEBRIEF_AUDIO_DIR = fileURLToPath(new URL('../../audio/', import.meta.url));
export const DEBRIEF_AUDIO_ROUTE = '/audio';

export interface VoiceOptions {
  apiKey: string;
  voiceId: string;
}

/** Speaks `text` with the given voice and returns the mp3 bytes. */
export async function textToSpeechMp3(text: string, opts: VoiceOptions): Promise<Buffer> {
  const { ElevenLabsClient } = await import('@elevenlabs/elevenlabs-js');
  const client = new ElevenLabsClient({ apiKey: opts.apiKey });
  const audio = await client.textToSpeech.convert(opts.voiceId, {
    text,
    modelId: ELEVENLABS_MODEL_ID,
    outputFormat: 'mp3_44100_128',
  });
  return Buffer.from(await new Response(audio).arrayBuffer());
}

/** Stores a debrief mp3 under its file name (e.g. "abc123.mp3"). */
export type SaveDebriefAudio = (file: string, mp3: Buffer) => Promise<void>;

export interface DebriefAudio {
  /** Relative URL, e.g. "/audio/abc123.mp3". */
  url: string;
  /** Seconds into the audio where each chat message starts. */
  chatStartsS: number[];
}

/**
 * Voices the coaching chat as one track and saves it (§11). One ElevenLabs call
 * per trip; the character timings say when each message starts, so the app can
 * show each bubble as the coach says it.
 */
export async function synthesizeChat(
  messages: string[],
  tripId: string,
  opts: VoiceOptions & { audioDir?: string; save?: SaveDebriefAudio },
): Promise<DebriefAudio> {
  const { text, offsets } = joinChat(messages);
  const { ElevenLabsClient } = await import('@elevenlabs/elevenlabs-js');
  const client = new ElevenLabsClient({ apiKey: opts.apiKey });
  const res = await client.textToSpeech.convertWithTimestamps(opts.voiceId, {
    text,
    modelId: ELEVENLABS_MODEL_ID,
    outputFormat: 'mp3_44100_128',
  });

  const file = `${tripId.replace(/[^A-Za-z0-9_-]/g, '_')}.mp3`;
  const mp3 = Buffer.from(res.audioBase64, 'base64');
  if (opts.save) {
    await opts.save(file, mp3);
  } else {
    const dir = opts.audioDir ?? DEBRIEF_AUDIO_DIR;
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, file), mp3);
  }

  return {
    url: `${DEBRIEF_AUDIO_ROUTE}/${file}`,
    chatStartsS: messageStartTimes(offsets, text.length, res.alignment),
  };
}

/** Messages joined into one script, with the character offset each one starts at. Pure. */
export function joinChat(messages: string[]): { text: string; offsets: number[] } {
  const offsets: number[] = [];
  let text = '';
  for (const m of messages) {
    if (text) text += ' ';
    offsets.push(text.length);
    text += m.trim();
  }
  return { text, offsets };
}

/**
 * Start time of each message from ElevenLabs' per-character timings. Pure.
 * If the timings don't line up with the text (missing, or a different length),
 * each offset is scaled onto them; with no timings at all, every start is 0 and
 * the app falls back to spacing bubbles over the audio's length.
 */
export function messageStartTimes(
  offsets: number[],
  textLength: number,
  alignment?: { characterStartTimesSeconds: number[] },
): number[] {
  const starts = alignment?.characterStartTimesSeconds ?? [];
  if (starts.length === 0) return offsets.map(() => 0);
  let prev = 0;
  return offsets.map((offset) => {
    const i =
      starts.length === textLength
        ? offset
        : Math.round((offset / Math.max(1, textLength)) * (starts.length - 1));
    const t = Math.max(prev, starts[Math.min(i, starts.length - 1)] ?? prev);
    prev = t;
    return Math.round(t * 100) / 100;
  });
}
