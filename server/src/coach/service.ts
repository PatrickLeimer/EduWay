/**
 * Real CoachService (WS4): Gemini then ElevenLabs. Failures degrade instead of
 * failing the trip upload: no coaching → coach null; no voice → audioUrl null.
 */
import { generateCoaching } from './gemini';
import { synthesizeChat } from './elevenlabs';
import type { CoachResult, CoachService } from './types';

export interface CoachServiceOptions {
  geminiApiKey?: string;
  geminiModel?: string;
  elevenLabsApiKey?: string;
  elevenLabsVoiceId?: string;
  /** Where debrief mp3s are written. Defaults to server/audio (served at /audio). */
  audioDir?: string;
}

export function createCoachService(opts: CoachServiceOptions): CoachService {
  return {
    async coachTrip(summary, tripId): Promise<CoachResult> {
      if (!opts.geminiApiKey || !opts.geminiModel) {
        console.warn('[coach] GEMINI_API_KEY / GEMINI_MODEL missing; skipping coaching');
        return { coach: null, audioUrl: null };
      }
      let coach = null;
      try {
        coach = await generateCoaching(summary, {
          apiKey: opts.geminiApiKey,
          model: opts.geminiModel,
        });
      } catch (e) {
        console.error('[coach] Gemini failed:', e);
        return { coach: null, audioUrl: null };
      }
      if (!opts.elevenLabsApiKey || !opts.elevenLabsVoiceId) return { coach, audioUrl: null };
      try {
        // Voice the chat (§11); a reply without one falls back to the short summary.
        const messages = coach.chat?.length ? coach.chat : [coach.debrief_script];
        const audio = await synthesizeChat(messages, tripId, {
          apiKey: opts.elevenLabsApiKey,
          voiceId: opts.elevenLabsVoiceId,
          audioDir: opts.audioDir,
        });
        const timed = coach.chat?.length
          ? { ...coach, chat_audio_starts_s: audio.chatStartsS }
          : coach;
        return { coach: timed, audioUrl: audio.url };
      } catch (e) {
        console.error('[coach] ElevenLabs failed:', e);
        return { coach, audioUrl: null };
      }
    },
    async ask() {
      // TODO(WS4, §10 "Ask the coach", stretch): Gemini answers only from the given context.
      throw new Error('TODO(WS4): ask not implemented');
    },
  };
}
