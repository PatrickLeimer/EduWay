/**
 * Gemini coaching call (WS4). Master doc §10.
 * JSON mode: responseMimeType 'application/json' plus a JSON schema derived from
 * CoachOutputSchema (shared), and the reply is validated against it again.
 *
 * The SDK is imported lazily, like elevenlabs.ts: loading it under Vitest is
 * slow and every server test imports this file through service.ts.
 */
import { COACH, CoachOutputSchema, type CoachOutput, type TripSummary } from '@edudriver/shared';
import { z } from 'zod';

import { buildSystemPrompt } from './prompt';

export interface GeminiOptions {
  apiKey: string;
  model: string;
}

/** What Gemini must return, generated from the shared schema so the two cannot drift. */
export const COACH_RESPONSE_JSON_SCHEMA = z.toJSONSchema(CoachOutputSchema);

/**
 * The student is waiting at trip end, so keep the worst case bounded.
 * Retries cover the free tier's frequent 503 "high demand" and 429 replies
 * (the SDK's default retryable codes: 408, 429, 5xx).
 */
export const GEMINI_HTTP = {
  /** Per attempt, not total. */
  timeoutMs: 20_000,
  /** Including the first call. */
  attempts: 3,
  initialDelayS: 1,
  maxDelayS: 4,
} as const;

export async function generateCoaching(
  summary: TripSummary,
  opts: GeminiOptions,
): Promise<CoachOutput> {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({
    apiKey: opts.apiKey,
    httpOptions: {
      timeout: GEMINI_HTTP.timeoutMs,
      retryOptions: {
        attempts: GEMINI_HTTP.attempts,
        initialDelay: GEMINI_HTTP.initialDelayS,
        maxDelay: GEMINI_HTTP.maxDelayS,
      },
    },
  });
  const res = await ai.models.generateContent({
    model: opts.model,
    contents: JSON.stringify(summary),
    config: {
      systemInstruction: buildSystemPrompt(),
      responseMimeType: 'application/json',
      responseJsonSchema: COACH_RESPONSE_JSON_SCHEMA,
    },
  });
  return parseCoachReply(res.text);
}

/** Validates Gemini's JSON text. Throws on empty, non-JSON, or off-schema replies. */
export function parseCoachReply(text: string | undefined): CoachOutput {
  if (!text) throw new Error('Gemini returned no text');
  const coach = CoachOutputSchema.parse(JSON.parse(text));
  // The prompt asks for at most COACH.maxFocusAreas (§10); enforce it rather than trust it.
  return { ...coach, focus_areas: coach.focus_areas.slice(0, COACH.maxFocusAreas) };
}
