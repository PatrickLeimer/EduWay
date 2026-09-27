/**
 * ElevenLabs voice (WS4). Master doc §11.
 * `textToSpeechMp3` is shared with scripts/alert-clips so live alerts and the
 * debrief use the same voice and model.
 *
 * OPEN DECISION (WS3 + WS4): where the debrief mp3 lives. Options: serve files
 * from the server (express.static under /audio, built with PUBLIC_BASE_URL), or
 * store in MongoDB GridFS. Pick one before implementing synthesizeDebrief.
 *
 * The SDK is imported lazily: loading it under Vitest takes minutes, and every
 * server test imports this file through service.ts.
 */
/**
 * Flash is the cheaper model (about half the credits per character of
 * eleven_multilingual_v2), used while we are on the free plan. Switch to
 * eleven_multilingual_v2 for higher quality, then regenerate clips with --force.
 */
export const ELEVENLABS_MODEL_ID = 'eleven_flash_v2_5';

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

export async function synthesizeDebrief(
  _script: string,
  _tripId: string,
  _opts: VoiceOptions,
): Promise<string> {
  // TODO(WS4, §11): textToSpeechMp3(script, opts), store the audio (open decision above),
  //   return its public URL.
  throw new Error('TODO(WS4): synthesizeDebrief not implemented');
}
