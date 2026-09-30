/**
 * Real CoachService (WS4): Gemini then ElevenLabs. Failures degrade instead of
 * failing the trip upload: no coaching → coach null; no voice → audioUrl null.
 */
import type { CoachOutput } from '@eduway/shared';

import { generateCoaching } from './gemini';
import { synthesizeChat, type SaveDebriefAudio } from './elevenlabs';
import type { CoachResult, CoachService } from './types';

export interface CoachServiceOptions {
  geminiApiKey?: string;
  geminiModel?: string;
  elevenLabsApiKey?: string;
  elevenLabsVoiceId?: string;
  /** Where debrief mp3s are written when there is no `saveAudio`. Defaults to server/audio. */
  audioDir?: string;
  /** Stores debrief mp3s (wiring: MongoDB GridFS, so they survive restarts). */
  saveAudio?: SaveDebriefAudio;
}

/** The text that gets voiced: the chat, or the short summary when there is none. */
function spokenMessages(coach: CoachOutput): string[] {
  return coach.chat?.length ? coach.chat : [coach.debrief_script];
}

/**
 * Voices a saved debrief again, for a trip whose mp3 was lost (saved through
 * `saveAudio`). Returns when each chat message starts. Undefined without ElevenLabs keys.
 */
export function createDebriefRevoicer(
  opts: CoachServiceOptions,
): ((coach: CoachOutput, tripId: string) => Promise<number[]>) | undefined {
  const { elevenLabsApiKey: apiKey, elevenLabsVoiceId: voiceId } = opts;
  if (!apiKey || !voiceId) return undefined;
  return async (coach, tripId) => {
    const audio = await synthesizeChat(spokenMessages(coach), tripId, {
      apiKey,
      voiceId,
      audioDir: opts.audioDir,
      save: opts.saveAudio,
    });
    return audio.chatStartsS;
  };
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
        const audio = await synthesizeChat(spokenMessages(coach), tripId, {
          apiKey: opts.elevenLabsApiKey,
          voiceId: opts.elevenLabsVoiceId,
          audioDir: opts.audioDir,
          save: opts.saveAudio,
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
