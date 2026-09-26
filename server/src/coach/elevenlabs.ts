/**
 * ElevenLabs debrief voice (WS4). STUB. Master doc §11.
 * Sends Gemini's debrief_script to ElevenLabs TTS and returns a URL the app can
 * stream.
 *
 * OPEN DECISION (WS3 + WS4): where the mp3 lives. Options: serve files from the
 * server (express.static under /audio, built with PUBLIC_BASE_URL), or store in
 * MongoDB GridFS. Pick one before implementing.
 */
export interface VoiceOptions {
  apiKey: string;
  voiceId: string;
}

export async function synthesizeDebrief(
  _script: string,
  _tripId: string,
  _opts: VoiceOptions,
): Promise<string> {
  // TODO(WS4, §11): new ElevenLabsClient({ apiKey }).textToSpeech.convert(voiceId, { text }),
  //   save the audio, return its public URL. Check current @elevenlabs/elevenlabs-js docs.
  throw new Error('TODO(WS4): synthesizeDebrief not implemented');
}
