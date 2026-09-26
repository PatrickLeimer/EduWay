/**
 * Real CoachService (WS4): Gemini then ElevenLabs. Failures degrade instead of
 * failing the trip upload: no coaching → coach null; no voice → audioUrl null.
 */
import { generateCoaching } from './gemini';
import { synthesizeDebrief } from './elevenlabs';
import type { CoachResult, CoachService } from './types';

export interface CoachServiceOptions {
  geminiApiKey?: string;
  geminiModel?: string;
  elevenLabsApiKey?: string;
  elevenLabsVoiceId?: string;
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
        const audioUrl = await synthesizeDebrief(coach.debrief_script, tripId, {
          apiKey: opts.elevenLabsApiKey,
          voiceId: opts.elevenLabsVoiceId,
        });
        return { coach, audioUrl };
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
